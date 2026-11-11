import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScriptError } from './index';
import { failure, logged } from './test-utils';

/** The things a page could reach that a script must never touch. Each one counts how often it is used. */
const HOST_NAMES = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document',
  'window',
  'navigator',
] as const;

const stubs = new Map<string, ReturnType<typeof vi.fn>>();

beforeEach(() => {
  for (const name of HOST_NAMES) {
    const stub = vi.fn();
    stubs.set(name, stub);
    vi.stubGlobal(name, stub);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  stubs.clear();
});

const refusal = /Line \d: .*(is not defined|Unknown command|Unsupported syntax|Property not allowed|is not a function)/;

describe('a script cannot reach the network, the storage or the page', () => {
  it.each([
    ['fetch', "fetch('https://example.com');"],
    ['fetch with the result used', "const r = fetch('https://example.com');\nlog(r);"],
    ['XMLHttpRequest', 'const x = new XMLHttpRequest();'],
    ['WebSocket', "const w = new WebSocket('wss://example.com');"],
    ['localStorage, writing', "localStorage.setItem('a', 'b');"],
    ['localStorage, reading', "log(localStorage.getItem('a'));"],
    ['sessionStorage', "sessionStorage.setItem('a', 'b');"],
    ['indexedDB', "indexedDB.open('db');"],
    ['document', 'log(document.cookie);'],
    ['window', 'window.alert(1);'],
    ['navigator', "navigator.sendBeacon('https://example.com');"],
    ['location', "location.href = 'https://example.com';"],
    ['self', 'self.postMessage(1);'],
    ['globalThis', 'log(globalThis);'],
    ['globalThis, with a member', 'globalThis.fetch;'],
    ['process', 'log(process.cwd());'],
    ['require', "require('fs');"],
    ['eval', "eval('1 + 1');"],
    ['Function', "Function('return 1')();"],
    ['new Function', "const f = new Function('return 1');"],
    ['setTimeout', 'setTimeout(() => 1, 10);'],
    ['setInterval', 'setInterval(() => 1, 10);'],
    ['a dynamic import', "import('fs');"],
    ['this', 'log(this);'],
    ['Math', 'log(Math.random());'],
    ['Object', 'log(Object.keys({}));'],
    ['JSON', 'log(JSON.stringify({}));'],
  ])('refuses %s', (_label, source) => {
    const error = failure(source);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(refusal);
    for (const stub of stubs.values()) expect(stub).not.toHaveBeenCalled();
  });

  it('does not let a name be reached by building it from pieces', () => {
    const error = failure("const name = 'fe' + 'tch';\nlog(name);\nname('x');");

    expect(error).toBeInstanceOf(ScriptError);
    expect(stubs.get('fetch')).not.toHaveBeenCalled();
  });
});

describe('a script cannot climb out of its own values into the host JavaScript', () => {
  it.each([
    ['the constructor of a list', '[].constructor;'],
    ['the constructor of a constructor', "[].constructor.constructor('return 1')();"],
    ['the constructor of an object', '({}).constructor;'],
    ['the prototype of an object', '({}).__proto__;'],
    ['the prototype of a list', '[].__proto__;'],
    ['the constructor of a text', "'abc'.constructor;"],
    ['the constructor of a function', '(() => 1).constructor;'],
    ['a constructor looked up with brackets', "[]['constructor'];"],
    ['a constructor name built from pieces', "const k = 'constr' + 'uctor';\n[][k];"],
    ['writing the prototype', 'const o = {};\no.__proto__.x = 1;'],
    ['replacing the prototype', "const o = {};\no['__proto__'] = {};"],
    ['the prototype key in an object literal', 'const o = { __proto__: {} };'],
    ['a prototype property', "const o = {};\no.prototype = 1;"],
    ['the constructor of a value a command gave', 'log(getPos().constructor);'],
    ['the constructor of a constant', 'log(Dir.NORTH.constructor);'],
  ])('refuses %s', (_label, source) => {
    const error = failure(source);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line \d: .*Property not allowed/);
  });

  it('leaves the host JavaScript untouched after all those attempts', () => {
    failure('const o = {};\no.__proto__.polluted = 1;');
    failure("[]['constructor'].prototype.polluted = 1;");

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(([] as unknown as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });

  it('finds nothing it was not given: the methods of the host are just missing', () => {
    expect(logged('const o = {};\nlog(o.toString, o.hasOwnProperty, o.valueOf, [].map, [].length);').values).toEqual([
      [undefined, undefined, undefined, undefined, 0],
    ]);
  });

  it('cannot call a host method on a list or a text', () => {
    expect((failure('[1].map((x) => x);') as Error).message).toMatch(/Line 1: map is not a function/);
    expect((failure("'abc'.toUpperCase();") as Error).message).toMatch(/Line 1: toUpperCase is not a function/);
  });

  it('cannot call anything that is not a function the player wrote, a command or a list method', () => {
    expect((failure("const o = { f: 'text' };\no.f();") as Error).message).toMatch(/Line 2: f is not a function/);
    expect((failure('(1)();') as Error).message).toMatch(/is not a function/);
  });
});

describe('what a command gives back can be read like any other value', () => {
  it('reads the properties of the position and of the size', () => {
    expect(logged('log(getPos().x, getPos().y, getSize().width, getSize().height);').values).toEqual([[0, 0, 3, 2]]);
  });

  it('keeps it in a variable and uses it', () => {
    expect(logged('move(Dir.EAST);\nconst p = getPos();\nlog(p.x, p.y);').values).toEqual([[1, 0]]);
  });

  it('is a copy: changing it never changes the farm', () => {
    const { values, farm } = logged('const p = getPos();\np.x = 99;\nlog(getPos().x, p.x);');

    expect(values).toEqual([[0, 99]]);
    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
  });

  it('is logged as a plain object', () => {
    expect(logged('log(getPos());').values).toStrictEqual([[{ x: 0, y: 0 }]]);
  });
});

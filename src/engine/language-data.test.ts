import { describe, expect, it } from 'vitest';
import { ScriptError } from './index';
import { failure, logged } from './test-utils';

describe('template strings', () => {
  it('puts the value of each ${} into the text', () => {
    expect(logged('const n = 2;\nlog(`a${1 + 2}b${n}c`, `plain`);').values).toEqual([['a3b2c', 'plain']]);
  });

  it('turns every kind of value into text the way JavaScript does', () => {
    const source = 'function f() {}\nlog(`${"x"}-${true}-${undefined}-${null}-${[1, [2, 3]]}-${{}}-${f}`);';

    expect(logged(source).values).toEqual([['x-true-undefined-null-1,2,3-[object Object]-[function]']]);
  });

  it('can nest and span lines', () => {
    expect(logged('log(`a${`b${1}`}\nc`);').values).toEqual([['ab1\nc']]);
  });

  it('refuses a tagged template', () => {
    expect((failure('log(String`a`);') as Error).message).toMatch(/Line 1: .*(Unsupported syntax: TaggedTemplateExpression|not defined)/);
  });
});

describe('lists', () => {
  it('reads items by position, and the length', () => {
    expect(logged('const a = [10, 20, 30];\nlog(a, a.length, a[0], a[2], a[3], [].length);').values).toEqual([
      [[10, 20, 30], 3, 10, 30, undefined, 0],
    ]);
  });

  it('holds lists inside lists', () => {
    expect(logged('const grid = [[1, 2], [3, 4]];\nlog(grid[1][0], grid.length, grid[0].length);').values).toEqual([[3, 2, 2]]);
  });

  it('changes items, and adds one at the end by writing at the length', () => {
    const source = 'const a = [1, 2, 3];\na[1] = 9;\na[3] = 4;\na[0] += 5;\na[2]++;\nlog(a);';

    expect(logged(source).values).toEqual([[[6, 9, 4, 4]]]);
  });

  it('refuses to write beyond the end, before the start, or at a position that is not a number', () => {
    for (const write of ['a[5] = 1;', 'a[-1] = 1;', 'a[1.5] = 1;']) {
      const error = failure(`const a = [1];\n${write}`);

      expect(error).toBeInstanceOf(ScriptError);
      expect((error as Error).message).toMatch(/Line 2: Invalid list position/);
    }
  });

  it('adds and removes at the end', () => {
    const source =
      'const a = [1];\nconst length = a.push(2, 3);\nconst last = a.pop();\nconst none = [].pop();\nlog(length, last, none, a);';

    expect(logged(source).values).toEqual([[3, 3, undefined, [1, 2]]]);
  });

  it('is shared by every name that points at it, and compared by identity', () => {
    expect(logged('const a = [];\nconst b = a;\nb.push(1);\nlog(a.length, a === b, [] === []);').values).toEqual([[1, true, false]]);
  });

  it('cannot have its length written', () => {
    expect((failure('const a = [1];\na.length = 0;') as Error).message).toMatch(/Line 2: Invalid list position/);
  });

  it('is walked with a loop', () => {
    const source = 'const a = [3, 4, 5];\nlet sum = 0;\nfor (let i = 0; i < a.length; i++) {\n  sum += a[i];\n}\nlog(sum);';

    expect(logged(source).values).toEqual([[12]]);
  });

  it('gives the letters and the length of a text', () => {
    expect(logged("log('abc'.length, 'abc'[1], 'abc'[5]);").values).toEqual([[3, 'b', undefined]]);
  });

  it('refuses a method it does not have, pointing at the line', () => {
    expect((failure('const a = [1];\na.flat();') as Error).message).toMatch(/Line 2: flat is not a function/);
  });
});

describe('objects', () => {
  it('reads properties with a dot, with brackets, and with a key that is a variable', () => {
    const source = "const o = { x: 1, 'y z': 2, 3: 'three' };\nconst k = 'x';\nlog(o.x, o['y z'], o[3], o[k], o.missing);";

    expect(logged(source).values).toEqual([[1, 2, 'three', 1, undefined]]);
  });

  it('has shorthand properties and nests', () => {
    expect(logged('const x = 1;\nconst o = { x, inner: { y: 2 } };\nlog(o.x, o.inner.y);').values).toEqual([[1, 2]]);
  });

  it('changes properties and adds new ones', () => {
    const source = 'const o = { x: 1 };\no.x = 5;\no.n = 7;\no.x += 1;\no["m"] = 0;\nlog(o);';

    expect(logged(source).values).toEqual([[{ x: 6, n: 7, m: 0 }]]);
  });

  it('can hold functions, which are called with a dot', () => {
    expect(logged('const o = { inc: (n) => n + 1 };\nlog(o.inc(1));').values).toEqual([[2]]);
  });

  it('reaches the farm through its values', () => {
    const source = 'const plan = { dir: Dir.EAST, wait: 2 };\nmove(plan.dir);\nwait(plan.wait);';

    expect(logged(source).farm.getState().drone).toEqual({ x: 1, y: 0 });
  });

  it('is logged as a plain object, with no trace of the interpreter', () => {
    const { values } = logged('log({ a: 1, b: [2, { c: 3 }] });');

    expect(values).toStrictEqual([[{ a: 1, b: [2, { c: 3 }] }]]);
  });

  it('refuses to read a property of undefined or null, pointing at the line', () => {
    expect((failure('let o;\nlog(o.x);') as Error).message).toMatch(/Line 2: Cannot read properties of undefined \(reading 'x'\)/);
    expect((failure('log(null.x);') as Error).message).toMatch(/Line 1: Cannot read properties of null/);
  });

  it('refuses to write a property of something that is not a list or an object', () => {
    expect((failure('const n = 1;\nn.x = 2;') as Error).message).toMatch(/Line 2: Cannot set properties/);
  });

  it.each([
    ['a spread', 'log({ ...{} });', 'SpreadElement'],
    ['a computed key', 'const k = "a";\nlog({ [k]: 1 });', 'computed property name'],
    ['a method', 'log({ f() {} });', 'method'],
    ['for...of', 'for (const a of [1]) {}', 'ForOfStatement'],
    ['optional chaining', 'const o = {};\nlog(o?.x);', 'ChainExpression'],
    ['a list spread', 'log([...[1]]);', 'SpreadElement'],
    ['a hole in a list', 'log([1, , 2]);', 'hole'],
  ])('refuses %s', (_label, source, what) => {
    expect((failure(source) as Error).message).toMatch(new RegExp(`Unsupported syntax: ${what}`));
  });
});

import { describe, expect, it } from 'vitest';
import { ScriptError } from './index';
import { failure, logged } from './test-utils';

describe('function declarations', () => {
  it('runs the body each time it is called, paying for its commands', () => {
    const { run } = logged('function twice() {\n  wait(1);\n  wait(1);\n}\ntwice();\ntwice();');

    // four ticks of waiting and two calls at half a tick each
    expect(run.getMeter().deciticks).toBe(40 + 2 * 5);
  });

  it('can be called before the line that declares it', () => {
    expect(logged('hello();\nfunction hello() {\n  log("hi");\n}').values).toEqual([['hi']]);
  });

  it('takes parameters and returns a value', () => {
    expect(logged('function add(a, b) {\n  return a + b;\n}\nlog(add(2, 3));').values).toEqual([[5]]);
  });

  it('returns undefined when it returns nothing, and ignores extra arguments', () => {
    expect(logged('function nothing() {}\nfunction bare() { return; }\nlog(nothing(), bare(), nothing(1, 2));').values).toEqual([
      [undefined, undefined, undefined],
    ]);
  });

  it('gives undefined to the parameters that were not passed', () => {
    expect(logged('function show(a, b) { log(a, b); }\nshow(1);').values).toEqual([[1, undefined]]);
  });

  it('stops at the first return, even from inside a loop', () => {
    const source = 'function firstOver(limit) {\n  for (let i = 0; i < 10; i++) {\n    if (i * i > limit) return i;\n  }\n  return -1;\n}\nlog(firstOver(20), firstOver(1000));';

    expect(logged(source).values).toEqual([[5, -1]]);
  });

  it('wraps the farm commands, so a routine can be reused', () => {
    const source = 'function tend() {\n  plant(Plant.GRASS);\n  wait(120);\n  harvest();\n}\ntend();\ntend();';
    const { farm, run } = logged(source);

    expect(farm.getState().stock.hay).toBe(2);
    expect(run.getMeter().deciticks).toBe(2 * (60 + 1200 + 60) + 2 * 5);
  });

  it('can call itself', () => {
    const source = 'function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nlog(fact(5), fact(1));';

    expect(logged(source).values).toEqual([[120, 1]]);
  });

  it('keeps its variables to itself', () => {
    expect((failure('function f() {\n  let secret = 1;\n}\nf();\nlog(secret);') as Error).message).toMatch(
      /Line 5: secret is not defined/,
    );
  });
});

describe('arrow functions', () => {
  it('has an expression body', () => {
    expect(logged('const square = (x) => x * x;\nconst inc = x => x + 1;\nconst two = () => 2;\nlog(square(4), inc(1), two());').values).toEqual([
      [16, 2, 2],
    ]);
  });

  it('has a block body', () => {
    expect(logged('const sum = (a, b) => {\n  const total = a + b;\n  return total;\n};\nlog(sum(1, 2));').values).toEqual([[3]]);
  });

  it('can be called right where it is written', () => {
    expect(logged('log(((x) => x + 1)(1));').values).toEqual([[2]]);
  });

  it('also works as a function expression', () => {
    expect(logged('const f = function (x) { return x * 2; };\nlog(f(4));').values).toEqual([[8]]);
  });
});

describe('closures', () => {
  it('remember the variables around where they were written', () => {
    const source = 'function counter() {\n  let n = 0;\n  return () => {\n    n++;\n    return n;\n  };\n}\nconst next = counter();\nnext();\nlog(next(), counter()());';

    expect(logged(source).values).toEqual([[2, 1]]);
  });

  it('see the loop variable of the round they were created in', () => {
    const source = 'let keep;\nfor (let i = 0; i < 3; i++) {\n  if (i === 1) keep = () => i;\n}\nlog(keep());';

    expect(logged(source).values).toEqual([[1]]);
  });
});

describe('function errors', () => {
  it('rejects calling something that is not a function, pointing at the line', () => {
    expect((failure('const a = 1;\na();') as Error).message).toMatch(/Line 2: a is not a function/);
    expect((failure('(1)();') as Error).message).toMatch(/Line 1: .* is not a function/);
  });

  it('rejects a function that calls itself forever', () => {
    const error = failure('function f() {\n  f();\n}\nf();');

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 2: Maximum call depth exceeded/);
  });

  it('allows a reasonably deep recursion', () => {
    const source = 'function down(n) {\n  if (n === 0) return 0;\n  return down(n - 1);\n}\nlog(down(150));';

    expect(logged(source).values).toEqual([[0]]);
  });

  it('is a syntax error to return outside a function, pointing at the line', () => {
    expect((failure('log(1);\nreturn 1;') as Error).message).toMatch(/Line 2/);
  });

  it('does not support parameters other than plain names', () => {
    expect((failure('function f(a = 1) {}\nf();') as Error).message).toMatch(/Line 1: Unsupported syntax/);
  });
});

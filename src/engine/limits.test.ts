import { describe, expect, it } from 'vitest';
import { createFarm, DEFAULT_LIMITS, ScriptError } from './index';
import type { Limits } from './index';
import { config } from './test-utils';

/** Runs a script on a farm with the given limits and returns the error it stops with (or `undefined`), and the run. */
function runWith(source: string, limits: Partial<Limits>, budget = 100_000) {
  const farm = createFarm({ ...config, limits });
  const run = farm.run(source);
  let error: unknown;
  try {
    run.step(budget);
  } catch (caught) {
    error = caught;
  }
  return { error, run, farm };
}

describe('default limits', () => {
  it('are the ones the game documents', () => {
    expect(DEFAULT_LIMITS).toEqual({
      computeTicksWithoutCommand: 5_000,
      roundsWithoutTime: 10_000,
      callDepth: 200,
      collectionSize: 10_000,
    });
  });
});

describe('computing without a command', () => {
  it('stops a loop that only calculates, pointing at the loop, after the configured ticks', () => {
    const { error, run } = runWith('let x = 0;\nwhile (true) {\n  x = x + 1;\n}', { computeTicksWithoutCommand: 100 });

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 2: .*infinite loop/);
    expect(run.isFinished).toBe(true);
    expect(run.getMeter().ticks).toBeGreaterThan(100);
    expect(run.getMeter().ticks).toBeLessThan(101);
  });

  it('applies with the default limit too', () => {
    const { error } = runWith('let a = 0;\nwhile (a < 1) {\n  a = 0;\n}', {});

    expect((error as Error).message).toMatch(/Line 2: .*infinite loop/);
  });

  it('does not count a free command as progress', () => {
    const { error } = runWith('let x = 0;\nwhile (true) {\n  x++;\n  log(x);\n}', { computeTicksWithoutCommand: 100 });

    expect((error as Error).message).toMatch(/infinite loop/);
  });

  it('counts a command that spends ticks as progress, and starts counting again after it', () => {
    const calculate = 'for (let i = 0; i < 300; i++) {}';

    expect(runWith(`${calculate}\ngetPos();\n${calculate}`, { computeTicksWithoutCommand: 100 }).error).toBeUndefined();
    expect(runWith(`${calculate}\n${calculate}`, { computeTicksWithoutCommand: 100 }).error).toBeInstanceOf(ScriptError);
  });

  it('lets a loop that keeps giving commands run for as long as it is allowed to', () => {
    const { error, run } = runWith('while (true) {\n  wait(1);\n}', { computeTicksWithoutCommand: 10 }, 1000);

    expect(error).toBeUndefined();
    expect(run.isFinished).toBe(false);
    expect(run.getMeter().ticks).toBe(1000);
  });

  it('stops a function that calls itself twice every time, which would never end', () => {
    const source = 'function f(n) {\n  if (n > 0) {\n    f(n - 1);\n    f(n - 1);\n  }\n}\nf(30);';
    const { error } = runWith(source, {});

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/infinite loop/);
  });
});

describe('rounds without time', () => {
  it.each([
    ['an empty loop', 'while (true) {}'],
    ['an empty for', 'for (;;) {}'],
    ['a loop of free commands', 'while (true) {\n  log(1);\n}'],
  ])('stops %s', (_label, source) => {
    const { error, run } = runWith(source, { roundsWithoutTime: 50 });

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line \d: .*infinite loop/);
    expect(run.getMeter().deciticks).toBe(0);
  });

  it('lets a loop go on as long as its rounds spend any time', () => {
    expect(runWith('for (let i = 0; i < 1000; i++) {\n  log(i);\n}', { roundsWithoutTime: 50 }).error).toBeUndefined();
  });
});

describe('how deep functions may call one another', () => {
  const down = 'function down(n) {\n  if (n === 0) return 0;\n  return down(n - 1);\n}\n';

  it('allows exactly the configured number of nested calls', () => {
    expect(runWith(`${down}down(4);`, { callDepth: 5 }).error).toBeUndefined();

    const { error } = runWith(`${down}down(5);`, { callDepth: 5 });
    expect((error as Error).message).toMatch(/Line 3: Maximum call depth exceeded/);
  });

  it('holds at the default depth without running out of the machine stack', () => {
    const last = DEFAULT_LIMITS.callDepth - 1;

    expect(runWith(`${down}log(down(${last}));`, {}).error).toBeUndefined();
    expect((runWith(`${down}down(${last + 1});`, {}).error as Error).message).toMatch(/Maximum call depth exceeded/);
  });
});

describe('how big values may get', () => {
  it('stops a list that grows without end', () => {
    const { error } = runWith('const a = [];\nwhile (true) {\n  a.push(1);\n}', { collectionSize: 100 });

    expect((error as Error).message).toMatch(/Line 3: The list is too big/);
  });

  it('allows a list to reach the limit and no further', () => {
    const fill = 'const a = [];\nfor (let i = 0; i < 100; i++) {\n  a.push(i);\n}\n';

    expect(runWith(fill, { collectionSize: 100 }).error).toBeUndefined();
    expect((runWith(`${fill}a.push(1);`, { collectionSize: 100 }).error as Error).message).toMatch(/The list is too big/);
    expect((runWith(`${fill}a[100] = 1;`, { collectionSize: 100 }).error as Error).message).toMatch(/The list is too big/);
  });

  it('stops a text that doubles every round', () => {
    const { error } = runWith("let s = 'ab';\nwhile (true) {\n  s = s + s;\n}", { collectionSize: 100 });

    expect((error as Error).message).toMatch(/Line 3: The text is too long/);
  });

  it('stops a template string that is too long', () => {
    const source = "const t = 'abcdefghij';\nlog(`${t}${t}${t}`);";
    const { error } = runWith(source, { collectionSize: 25 });

    expect((error as Error).message).toMatch(/Line 2: The text is too long/);
  });

  it('stops an object that gets too many properties', () => {
    const source = "const o = {};\nfor (let i = 0; i < 1000; i++) {\n  o['k' + i] = i;\n}";
    const { error } = runWith(source, { collectionSize: 100 });

    expect((error as Error).message).toMatch(/Line 3: The object has too many properties/);
  });

  it('refuses a list or an object written too big in the script', () => {
    expect((runWith('log([1, 2, 3]);', { collectionSize: 2 }).error as Error).message).toMatch(/The list is too big/);
    expect((runWith('log({ a: 1, b: 2, c: 3 });', { collectionSize: 2 }).error as Error).message).toMatch(
      /The object has too many properties/,
    );
  });
});

describe('values that are not numbers or text', () => {
  it('turn into text when added to a text, the way JavaScript does', () => {
    const farm = createFarm(config);
    farm.run("log('a' + {}, 'a' + [1, 2], [1] + [2]);").step(100);

    expect(farm.drainEvents()).toMatchObject([{ values: ['a[object Object]', 'a1,2', '12'] }]);
  });

  it('are refused by the operators that cannot use them, pointing at the line', () => {
    for (const source of ['log({} < 1);', 'log(-{});', 'const o = {};\no *= 2;']) {
      const { error } = runWith(source, {});

      expect(error).toBeInstanceOf(ScriptError);
      expect((error as Error).message).toMatch(/Invalid operation/);
    }
  });
});

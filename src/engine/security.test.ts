import { describe, expect, it } from 'vitest';
import { createFarm, DEFAULT_LIMITS, ScriptError } from './index';
import type { Limits } from './index';
import { config, failure, logged } from './test-utils';

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

/** A list that holds itself twice, `depth` times over: tiny to build, astronomically big to walk. */
const sharedList = (depth: number) => `let a = [1];\nfor (let i = 0; i < ${depth}; i++) {\n  a = [a, a];\n}\n`;

describe('running out of the machine stack never escapes as a raw error', () => {
  it('stops a recursion whose every level nests many expressions', () => {
    const nested = `${'1 + ('.repeat(60)}f(n - 1)${')'.repeat(60)}`;
    const error = failure(`function f(n) {\n  if (n > 0) {\n    return ${nested};\n  }\n  return 0;\n}\nf(190);`);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line \d+: .*(stack|nested)/);
  });

  it('stops a value nested far too deep to be walked', () => {
    const { error } = runWith('let a = [];\nfor (let i = 0; i < 20000; i++) {\n  a = [a];\n}\nlog(a);', {
      computeTicksWithoutCommand: 100_000,
    });

    expect(error).toBeInstanceOf(ScriptError);
  });

  it('leaves the run finished, so nothing half-done can be resumed', () => {
    const nested = `${'1 + ('.repeat(60)}f(n - 1)${')'.repeat(60)}`;
    const { run } = runWith(`function f(n) {\n  if (n > 0) {\n    return ${nested};\n  }\n  return 0;\n}\nf(190);`, {});

    expect(run.isFinished).toBe(true);
  });
});

describe('a value shared with itself cannot be used to make the machine work forever', () => {
  it('is refused as a template string, quickly, because the text would be too long', () => {
    const error = failure(`${sharedList(25)}log(\`\${a}\`);`);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/The text is too long/);
  });

  it('is refused when added to a text', () => {
    expect((failure(`${sharedList(25)}log('x' + a);`) as Error).message).toMatch(/The text is too long/);
  });

  it('is refused when logged, because what is logged must stay a small plain tree', () => {
    const error = failure(`${sharedList(25)}log(a);`);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 5: The value is too big/);
  });

  it('logs a list that holds itself as a plain value that can be sent as JSON', () => {
    const { values } = logged('const a = [1];\na.push(a);\nlog(a);');

    expect(values).toEqual([[[1, '[circular]']]]);
    expect(() => JSON.stringify(values)).not.toThrow();
  });

  it('logs a list that appears twice as two copies, not as one shared object', () => {
    const { values } = logged('const x = [1];\nlog([x, x]);');
    const [logged_] = values[0] as [[number[], number[]]];

    expect(logged_[0]).toEqual([1]);
    expect(logged_[0]).not.toBe(logged_[1]);
  });
});

describe('numbers that are not plain numbers', () => {
  it.each([
    ['a big integer', 'log(1n);', 'bigint'],
    ['a big integer in a power', 'log(7n ** 200000000n > 0n);', 'bigint'],
    ['a regular expression', 'log(/a+/);', 'regular expression'],
  ])('refuses %s', (_label, source, what) => {
    const error = failure(source);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(new RegExp(`Line 1: Unsupported syntax: ${what}`));
  });
});

describe('++ and --', () => {
  it('turn their value into a number first, the way JavaScript does', () => {
    expect(logged("let s = '5';\ns++;\nlet t = 'ab';\nt--;\nlog(s, t);").values).toEqual([[6, Number.NaN]]);
  });

  it('give the old value as a number when used after the name', () => {
    expect(logged("let s = '5';\nlog(s++, s);").values).toEqual([[5, 6]]);
  });

  it('refuse what cannot be turned into a number, pointing at the line', () => {
    const error = failure('let o = {};\no++;');

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 2: Invalid operation/);
  });
});

describe('the limits themselves', () => {
  it.each([
    ['not a number', { computeTicksWithoutCommand: Number.NaN }],
    ['infinite', { collectionSize: Number.POSITIVE_INFINITY }],
    ['zero', { roundsWithoutTime: 0 }],
    ['negative', { callDepth: -1 }],
    ['fractional', { memoryUnits: 1.5 }],
  ])('refuse a value that is %s, so no limit can be switched off by accident', (_label, limits) => {
    expect(() => createFarm({ ...config, limits })).toThrow(RangeError);
  });

  it('include a ceiling on what stays in memory', () => {
    expect(DEFAULT_LIMITS.memoryUnits).toBe(1_000_000);
  });
});

describe('memory', () => {
  const growing =
    'const rows = [];\nwhile (true) {\n  const row = [];\n  for (let j = 0; j < 50; j++) {\n    row.push(j);\n  }\n  rows.push(row);\n}';
  const roomy = { collectionSize: 1000, computeTicksWithoutCommand: 1_000_000, memoryUnits: 5000 };

  it('stops a script whose lists of lists keep growing, even though each one is small', () => {
    const { error } = runWith(growing, roomy);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/The script is using too much memory/);
  });

  it('counts texts by their length', () => {
    const { error } = runWith("const texts = [];\nwhile (true) {\n  texts.push('abcdefghij');\n}", {
      ...roomy,
      memoryUnits: 500,
    });

    expect((error as Error).message).toMatch(/too much memory/);
  });

  it('does not count what the script no longer holds', () => {
    const { error, run } = runWith('while (true) {\n  const garbage = [1, 2, 3, 4, 5];\n  wait(1);\n}', { memoryUnits: 100 }, 5000);

    expect(error).toBeUndefined();
    expect(run.isFinished).toBe(false);
  });

  it('counts what a function kept alive in its scope', () => {
    const source =
      'const keep = [];\nfunction remember() {\n  const big = [];\n  for (let i = 0; i < 100; i++) {\n    big.push(i);\n  }\n  keep.push(() => big);\n}\nwhile (true) {\n  remember();\n}';
    const { error } = runWith(source, { ...roomy, memoryUnits: 2000 });

    expect((error as Error).message).toMatch(/too much memory/);
  });
});

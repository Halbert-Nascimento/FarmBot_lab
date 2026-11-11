import { describe, expect, it } from 'vitest';
import { ScriptError } from './index';
import { failure, logged } from './test-utils';

describe('variables', () => {
  it('declares and reads let and const', () => {
    expect(logged("let a = 2;\nconst b = 'x';\nlog(a, b);").values).toEqual([[2, 'x']]);
  });

  it('lets a let variable be reassigned', () => {
    expect(logged('let a = 1;\na = 5;\nlog(a);').values).toEqual([[5]]);
  });

  it('refuses to reassign a const, pointing at the line', () => {
    const error = failure('const c = 1;\nc = 2;');

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 2: Assignment to constant variable: c/);
  });

  it('rejects a variable that does not exist, pointing at the line', () => {
    expect((failure('log(1);\nlog(zzz);') as Error).message).toMatch(/Line 2: zzz is not defined/);
  });

  it('rejects the use of a variable before its declaration', () => {
    expect((failure('log(a);\nlet a = 1;') as Error).message).toMatch(/Line 1: a is not defined/);
  });

  it('keeps block variables inside their block', () => {
    expect((failure('{\n  let a = 1;\n}\nlog(a);') as Error).message).toMatch(/Line 4: a is not defined/);
  });

  it('lets an inner block read and change an outer variable, and shadow it with its own', () => {
    expect(logged('let a = 1;\n{\n  a = 2;\n  let b = 3;\n  log(a, b);\n}\nlog(a);').values).toEqual([[2, 3], [2]]);
    expect(logged('let a = 1;\n{\n  let a = 9;\n  log(a);\n}\nlog(a);').values).toEqual([[9], [1]]);
  });

  it('lets variables feed the commands', () => {
    const { farm, run } = logged('const direction = Dir.EAST;\nlet n = 3;\nmove(direction);\nwait(n);');

    expect(farm.getState().drone).toEqual({ x: 1, y: 0 });
    expect(run.getMeter().ticks).toBe(11);
  });
});

describe('expressions', () => {
  it('does arithmetic with the usual precedence', () => {
    expect(logged('log(1 + 2 * 3, 7 % 4, 10 / 4, (1 + 2) * 3, 2 ** 3);').values).toEqual([[7, 3, 2.5, 9, 8]]);
  });

  it('compares values', () => {
    expect(logged('log(1 < 2, 2 <= 1, 3 > 2, 2 >= 2, 2 === 2, 3 !== 3, 1 == 1, 1 != 1);').values).toEqual([
      [true, false, true, true, true, false, true, false],
    ]);
  });

  it('combines conditions, keeping the value of the deciding side', () => {
    expect(logged("log(true && false, false || 'x', 0 && 5, 0 || 5);").values).toEqual([[false, 'x', 0, 5]]);
  });

  it('does not evaluate the right side of && and || when the left decides', () => {
    const { run } = logged('false && wait(10);\ntrue || wait(10);');

    expect(run.getMeter().deciticks).toBe(0);
  });

  it('negates and flips signs', () => {
    expect(logged('log(!true, !0, -5, +3);').values).toEqual([[false, true, -5, 3]]);
  });

  it('updates variables with compound assignment and increments', () => {
    expect(logged('let a = 1;\na += 2;\na *= 3;\na -= 1;\na++;\na--;\n++a;\nlog(a);').values).toEqual([[9]]);
  });

  it('gives the value of an assignment and of a post-increment', () => {
    expect(logged('let a = 1;\nlog(a++, a, a = 7, a);').values).toEqual([[1, 2, 7, 7]]);
  });

  it('knows undefined', () => {
    expect(logged('let a;\nlog(a, undefined);').values).toEqual([[undefined, undefined]]);
  });
});

describe('if and else', () => {
  it('runs the branch the condition picks', () => {
    expect(logged('if (true) log(1);\nelse log(2);\nif (false) log(3);\nelse log(4);').values).toEqual([[1], [4]]);
  });

  it('chains else if', () => {
    const source = (n: number) =>
      `const n = ${n};\nif (n < 0) { log('neg'); } else if (n === 0) { log('zero'); } else { log('pos'); }`;

    expect(logged(source(-1)).values).toEqual([['neg']]);
    expect(logged(source(0)).values).toEqual([['zero']]);
    expect(logged(source(1)).values).toEqual([['pos']]);
  });

  it('decides with the farm: harvests only what is ready, paying the sensor and the action', () => {
    const waiting = logged("if (isReady()) { harvest(); } else { log('not yet'); }");

    expect(waiting.values).toEqual([['not yet']]);
    expect(waiting.run.getMeter().ticks).toBe(1);

    const ripe = logged('plant(Plant.GRASS);\nwait(120);\nif (isReady()) { harvest(); }');

    expect(ripe.farm.getState().stock.hay).toBe(1);
    expect(ripe.run.getMeter().ticks).toBe(6 + 120 + 1 + 6);
  });
});

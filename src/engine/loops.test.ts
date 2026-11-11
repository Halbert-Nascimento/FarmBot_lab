import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';
import { config, failure, logged } from './test-utils';

describe('for', () => {
  it('repeats the body while the condition holds', () => {
    expect(logged('for (let i = 0; i < 3; i++) {\n  log(i);\n}').values).toEqual([[0], [1], [2]]);
  });

  it('runs no iteration when the condition starts false', () => {
    expect(logged('for (let i = 5; i < 3; i++) { log(i); }\nlog(\'done\');').values).toEqual([['done']]);
  });

  it('takes the loop variable out of the loop scope', () => {
    expect((failure('for (let i = 0; i < 1; i++) {}\nlog(i);') as Error).message).toMatch(/Line 2: i is not defined/);
  });

  it('lets the body change outer variables', () => {
    expect(logged('let total = 0;\nfor (let i = 1; i <= 4; i++) { total += i; }\nlog(total);').values).toEqual([[10]]);
  });

  it('accepts an init, test and update that are expressions or missing', () => {
    expect(logged('let i = 0;\nfor (; i < 2; ) { i++; }\nlog(i);').values).toEqual([[2]]);
  });

  it('pays for the commands in every iteration', () => {
    const { run } = logged('for (let i = 0; i < 3; i++) {\n  wait(2);\n}');

    expect(run.getMeter().ticks).toBe(6);
  });

  it('refuses to change a const loop variable', () => {
    expect((failure('for (const i = 0; i < 2; i++) {}') as Error).message).toMatch(
      /Line 1: Assignment to constant variable: i/,
    );
  });
});

describe('while', () => {
  it('repeats the body while the condition holds', () => {
    expect(logged('let n = 0;\nwhile (n < 3) {\n  n++;\n}\nlog(n);').values).toEqual([[3]]);
  });

  it('waits for a plant to ripen by asking the sensor, then harvests it', () => {
    const { farm, run } = logged('plant(Plant.GRASS);\nwhile (!isReady()) {\n  wait(10);\n}\nharvest();');

    expect(farm.getState().stock.hay).toBe(1);
    // plant 6 + 11 rounds of (sensor 1 + wait 10) + the sensor that finds it ripe 1 + harvest 6
    expect(run.getMeter().ticks).toBe(6 + 11 * 11 + 1 + 6);
  });
});

describe('break', () => {
  it('leaves a for loop', () => {
    expect(logged('for (let i = 0; i < 10; i++) {\n  if (i === 3) break;\n  log(i);\n}').values).toEqual([[0], [1], [2]]);
  });

  it('leaves a while loop', () => {
    expect(logged('let n = 0;\nwhile (true) {\n  n++;\n  if (n === 4) { break; }\n}\nlog(n);').values).toEqual([[4]]);
  });

  it('leaves only the innermost loop', () => {
    const source = 'for (let i = 0; i < 2; i++) {\n  for (let j = 0; j < 5; j++) {\n    if (j === 1) break;\n    log(i, j);\n  }\n}';

    expect(logged(source).values).toEqual([[0, 0], [1, 0]]);
  });

  it('is a syntax error outside a loop, pointing at the line', () => {
    const error = failure('log(1);\nbreak;');

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 2/);
  });
});

describe('nested loops', () => {
  it('visits every pair', () => {
    const { values } = logged('for (let i = 0; i < 2; i++) {\n  for (let j = 0; j < 3; j++) {\n    log(i, j);\n  }\n}');

    expect(values).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
  });
});

describe('pausing inside loops', () => {
  it('pauses between two actions of a loop and resumes where it stopped', () => {
    const farm = createFarm(config);
    const run = farm.run('for (let i = 0; i < 2; i++) {\n  move(Dir.EAST);\n}');

    run.step(8);

    expect(farm.getState().drone).toEqual({ x: 1, y: 0 });
    expect(run.isFinished).toBe(false);

    run.step(8);

    expect(farm.getState().drone).toEqual({ x: 2, y: 0 });
  });

  it('keeps an endless loop that spends ticks going, one budget at a time', () => {
    const run = createFarm(config).run('while (true) {\n  wait(1);\n}');

    run.step(10);
    expect(run.isFinished).toBe(false);
    expect(run.getMeter().ticks).toBe(10);

    run.step(10);
    expect(run.isFinished).toBe(false);
    expect(run.getMeter().ticks).toBe(20);
  });
});

describe('endless loops that spend no ticks', () => {
  it.each(['while (true) {}', 'for (;;) {}', 'let a = 0;\nwhile (a < 1) { a = 0; }'])('are interrupted: %s', (source) => {
    const farm = createFarm(config);
    const run = farm.run(source);

    expect(() => run.step(100)).toThrow(ScriptError);
    expect(() => createFarm(config).run(source).step(100)).toThrow(/infinite loop/);
    expect(run.isFinished).toBe(true);
  });

  it('point at the line of the loop', () => {
    expect((failure('log(1);\nwhile (true) {}') as Error).message).toMatch(/Line 2: .*infinite loop/);
  });

  it('do not stop a long loop that keeps spending ticks', () => {
    const { run } = logged('for (let i = 0; i < 20000; i++) {\n  getPos();\n}');

    expect(run.getMeter().ticks).toBe(20000);
  });
});

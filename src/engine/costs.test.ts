import { describe, expect, it } from 'vitest';
import { createFarm } from './index';
import { config, logged } from './test-utils';

/** What the script costs, in deciticks (tenths of a tick). */
function cost(source: string): number {
  return logged(source).run.getMeter().deciticks;
}

describe('operations cost 0.1 tick', () => {
  it.each([
    ['an addition', '1 + 2;', 1],
    ['two operations', '1 + 2 * 3;', 2],
    ['a comparison', '1 < 2;', 1],
    ['an equality', '1 === 1;', 1],
    ['a negation', '!true;', 1],
    ['a sign', '-5;', 1],
    ['a literal', '5;', 0],
    ['reading a variable', 'const a = 1;\na;', 1],
    ['reading a list item and its length', 'const a = [1];\na[0];\na.length;', 1],
    ['a template string, only for what is inside it', '`${1 + 2}`;', 1],
  ])('%s', (_label, source, deciticks) => {
    expect(cost(source)).toBe(deciticks);
  });

  it('charges && and || once, and only evaluates the side it needs', () => {
    expect(cost('true && false;')).toBe(1);
    expect(cost('false && (1 + 2);')).toBe(1);
    expect(cost('true && (1 + 2);')).toBe(2);
    expect(cost('true || (1 + 2);')).toBe(1);
    expect(cost('false || (1 + 2);')).toBe(2);
  });
});

describe('assignments cost 0.1 tick', () => {
  it.each([
    ['a declaration without a value', 'let a;', 0],
    ['a declaration with a value', 'let a = 1;', 1],
    ['a declaration with an operation in it', 'const b = 1 + 2;', 2],
    ['two declarations', 'let a = 1, b = 2;', 2],
    ['a plain assignment', 'let a = 1;\na = 2;', 2],
    ['a compound assignment, which is an operation and an assignment', 'let a = 1;\na += 2;', 3],
    ['an increment', 'let a = 1;\na++;', 3],
    ['a prefix increment', 'let a = 1;\n++a;', 3],
    ['a decrement', 'let a = 1;\na--;', 3],
    ['writing a list item', 'const a = [1];\na[0] = 5;', 2],
    ['updating a list item', 'const a = [1];\na[0] += 5;\na[0]++;', 1 + 2 + 2],
    ['writing an object property', 'const o = {};\no.x = 1;', 2],
    ['a function declaration', 'function f() {}', 0],
  ])('%s', (_label, source, deciticks) => {
    expect(cost(source)).toBe(deciticks);
  });
});

describe('calls', () => {
  it.each([
    ['a function the player wrote', 'function f() {}\nf();', 5],
    ['an arrow function, with its own operation', 'const g = () => 1 + 2;\ng();', 1 + 5 + 1],
    ['calls inside a call', 'function f() {}\nfunction g() { f(); f(); }\ng();', 5 + 5 + 5],
    ['a function kept in an object', 'const o = { f: () => 0 };\no.f();', 1 + 5],
    ['push on a list', 'const a = [];\na.push(1);', 1 + 5],
    ['pop on a list', 'const a = [1];\na.pop();', 1 + 5],
  ])('%s cost 0.5 tick', (_label, source, deciticks) => {
    expect(cost(source)).toBe(deciticks);
  });

  it('costs only what the table says for a command, with no extra for the call', () => {
    expect(cost('move(Dir.EAST);')).toBe(80);
    expect(cost('plant(Plant.GRASS);')).toBe(60);
    expect(cost('getPos();')).toBe(10);
    expect(cost('log(1);')).toBe(0);
    expect(cost('log(1 + 2);')).toBe(1);
  });
});

describe('loops', () => {
  it('charges the setup, every test and every update of a for loop', () => {
    expect(cost('for (let i = 0; i < 3; i++) {}')).toBe(1 + 4 + 3 * 2);
  });

  it('charges the test and the body of a while loop', () => {
    expect(cost('let n = 0;\nwhile (n < 3) {\n  n++;\n}')).toBe(1 + 4 + 3 * 2);
  });

  it('adds up with the commands inside the loop', () => {
    expect(cost('for (let i = 0; i < 2; i++) {\n  wait(2);\n}')).toBe(1 + 3 + 2 * 2 + 2 * 20);
  });
});

describe('time passes while the script computes', () => {
  it('stamps an event with the time the computation before it took', () => {
    const farm = createFarm(config);

    farm.run('1 + 1;\n1 + 1;\nlog(1);').step(100);

    expect(farm.drainEvents()).toEqual([{ type: 'logged', timeDeciticks: 2, values: [1] }]);
  });

  it('lets a plant grow while the script only calculates', () => {
    // planted at 60; the loop costs 1 + 501 + 1000 = 1502, longer than the 1200 the grass needs
    expect(logged('plant(Plant.GRASS);\nfor (let i = 0; i < 500; i++) {}\nlog(isReady());').values).toEqual([[true]]);
    // a loop of 302 is not
    expect(logged('plant(Plant.GRASS);\nfor (let i = 0; i < 100; i++) {}\nlog(isReady());').values).toEqual([[false]]);
  });

  it('can be paused in the middle of a calculation', () => {
    const run = createFarm(config).run('for (let i = 0; i < 1000; i++) {}');

    run.step(1);

    expect(run.isFinished).toBe(false);
    expect(run.getMeter().deciticks).toBeGreaterThanOrEqual(10);
    expect(run.getMeter().deciticks).toBeLessThan(20);
  });

  it('ends in the same state however the steps are cut', () => {
    const source =
      'let total = 0;\nfor (let i = 0; i < 5; i++) {\n  total += i * 2;\n  move(Dir.EAST);\n  const t = `${total}`;\n}\nplant(Plant.GRASS);\nlog(total);';
    const whole = createFarm(config);
    const wholeRun = whole.run(source);
    wholeRun.step(10_000);

    const piecewise = createFarm(config);
    const run = piecewise.run(source);
    for (let guard = 0; !run.isFinished && guard < 10_000; guard++) run.step(1);

    expect(run.isFinished).toBe(true);
    expect(piecewise.getStateHash()).toBe(whole.getStateHash());
    expect(run.getMeter().deciticks).toBe(wholeRun.getMeter().deciticks);
    expect(piecewise.drainEvents()).toEqual(whole.drainEvents());
  });
});

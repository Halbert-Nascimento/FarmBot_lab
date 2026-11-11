import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';

const config = { width: 3, height: 2, seed: 1 };

describe('command arguments', () => {
  it.each([
    ['move()', /Line 1: move expects a direction/],
    ['move(5)', /Line 1: move expects a direction/],
    ['move(move(Dir.EAST))', /Line 1: move expects a direction/],
    ['plant()', /Line 1: plant expects a plant species/],
    ['plant(Dir.EAST)', /Line 1: plant expects a plant species/],
    ['harvest(Dir.EAST)', /Line 1: harvest takes no arguments/],
  ])('rejects %s with a script error that points at the line', (source, message) => {
    const run = createFarm(config).run(source);

    expect(() => run.step(100)).toThrow(ScriptError);
    expect(() => createFarm(config).run(source).step(100)).toThrow(message);
  });

  it('charges nothing and changes nothing when the arguments are invalid', () => {
    const farm = createFarm(config);
    const run = farm.run('move(5);');

    expect(() => run.step(100)).toThrow(ScriptError);

    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
    expect(run.getMeter().deciticks).toBe(0);
    expect(farm.drainEvents()).toEqual([]);
  });

  it('ends the run when the script fails', () => {
    const run = createFarm(config).run('move(5);');

    expect(() => run.step(100)).toThrow(ScriptError);

    expect(run.isFinished).toBe(true);
  });
});

describe('step budget', () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects the budget %s', (budget) => {
    const run = createFarm(config).run('move(Dir.EAST);');

    expect(() => run.step(budget)).toThrow(RangeError);
  });
});

describe('meter', () => {
  it('shows the run time with exactly one decimal place', () => {
    const run = createFarm(config).run('plant(Plant.GRASS);');
    run.step(100);

    expect(run.getMeter().formatted).toBe('6.0');
  });
});

describe('state hash and seed', () => {
  it('tells apart farms that differ only by seed', () => {
    const a = createFarm({ ...config, seed: 1 });
    const b = createFarm({ ...config, seed: 2 });

    expect(a.getStateHash()).not.toBe(b.getStateHash());
  });
});

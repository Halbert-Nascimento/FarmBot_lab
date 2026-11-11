import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';

const config = { width: 3, height: 2, seed: 1 };

function randoms(seed: number, calls: number) {
  const farm = createFarm({ ...config, seed });
  farm.run('log(random());\n'.repeat(calls)).step(10_000);
  return farm.drainEvents().flatMap((event) => (event.type === 'logged' ? [event.values[0]] : []));
}

// Reference values from an independent implementation of the mulberry32 generator.
describe('random()', () => {
  it('gives the reference sequence for seed 1', () => {
    expect(randoms(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('gives a different sequence for another seed', () => {
    expect(randoms(2, 2)).toEqual([0.7342509443406016, 0.32499843230471015]);
  });

  it('keeps the sequence going across runs of the same farm', () => {
    const farm = createFarm(config);

    farm.run('log(random());').step(100);
    farm.run('log(random());').step(100);

    const values = farm.drainEvents().flatMap((event) => (event.type === 'logged' ? [event.values[0]] : []));
    expect(values).toEqual([0.6270739405881613, 0.002735721180215478]);
  });

  it('costs one tick', () => {
    const run = createFarm(config).run('random();');
    run.step(100);

    expect(run.getMeter().ticks).toBe(1);
  });

  it('takes no arguments', () => {
    expect(() => createFarm(config).run('random(1);').step(100)).toThrow(ScriptError);
    expect(() => createFarm(config).run('random(1);').step(100)).toThrow(/Line 1: random takes no arguments/);
  });

  it('leaves farms that drew the same numbers in the same state', () => {
    const a = createFarm(config);
    const b = createFarm(config);
    a.run('random();').step(100);
    b.run('random();').step(100);
    const c = createFarm(config);
    c.run('wait(1);').step(100);

    expect(a.getStateHash()).toBe(b.getStateHash());
    expect(a.getStateHash()).not.toBe(c.getStateHash());
  });
});

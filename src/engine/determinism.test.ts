import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';

const config = { width: 3, height: 2, seed: 1 };

describe('state hash', () => {
  it('is the same for the same script and seed on two farms', () => {
    const a = createFarm(config);
    const b = createFarm(config);

    a.run('plant(Plant.GRASS);\nmove(Dir.EAST);').step(100);
    b.run('plant(Plant.GRASS);\nmove(Dir.EAST);').step(100);

    expect(a.getStateHash()).toBe(b.getStateHash());
  });

  it('changes when the final state changes', () => {
    const a = createFarm(config);
    const b = createFarm(config);

    a.run('plant(Plant.GRASS);').step(100);
    b.run('move(Dir.EAST);').step(100);

    expect(a.getStateHash()).not.toBe(b.getStateHash());
  });
});

describe('state snapshot', () => {
  it('cannot be used to change the farm from outside the engine', () => {
    const farm = createFarm(config);

    const snapshot = farm.getState();
    (snapshot.field.cells[0] as { plant: unknown }).plant = { species: 'grass', stage: 'ready', progress: 100 };

    expect(farm.getState().field.cells[0]?.plant).toBeNull();
  });
});

describe('script errors', () => {
  it('rejects a script with a syntax error, pointing at the line', () => {
    const farm = createFarm(config);

    expect(() => farm.run('move(Dir.EAST);\nmove(;')).toThrow(ScriptError);
    expect(() => farm.run('move(Dir.EAST);\nmove(;')).toThrow(/Line 2/);
  });

  it('stops the run on an unknown command, pointing at the line', () => {
    const farm = createFarm(config);
    const run = farm.run('move(Dir.EAST);\ndance();');

    expect(() => run.step(100)).toThrow(/Line 2: Unknown command: dance/);
  });
});

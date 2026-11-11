import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';

const config = { width: 3, height: 2, seed: 1 };

/** Plants grass at tick 6 (the plant cost), then waits, and returns the farm. */
function grassAfterWaiting(ticks: number) {
  const farm = createFarm(config);
  farm.run(`plant(Plant.GRASS);\nwait(${ticks});`).step(1000);
  return farm;
}

const plantOf = (farm: ReturnType<typeof createFarm>) => farm.getState().field.cells[0]?.plant;

describe('growing grass (120 ticks to ripen)', () => {
  it.each([
    [0, 'sprout', 0],
    [30, 'sprout', 25],
    [40, 'growing', 33],
    [119, 'growing', 99],
    [120, 'ready', 100],
    [500, 'ready', 100],
  ])('after %i ticks it is %s at %i%% progress', (waited, stage, progress) => {
    expect(plantOf(grassAfterWaiting(waited))).toEqual({ species: 'grass', stage, progress });
  });
});

describe('waiting', () => {
  it('spends the given number of ticks and does nothing else', () => {
    const farm = createFarm(config);
    const run = farm.run('wait(25);');

    run.step(1000);

    expect(run.getMeter().ticks).toBe(25);
    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
  });

  it.each(['wait()', 'wait(1.5)', 'wait(Dir.EAST)', 'wait(1, 2)'])('rejects %s', (source) => {
    const run = createFarm(config).run(source);

    expect(() => run.step(100)).toThrow(ScriptError);
    expect(() => createFarm(config).run(source).step(100)).toThrow(/Line 1: wait expects a whole number of ticks/);
  });
});

describe('harvesting', () => {
  it('rewards one hay for ripe grass and clears the cell', () => {
    const farm = createFarm(config);

    farm.run('plant(Plant.GRASS);\nwait(120);\nharvest();').step(1000);

    expect(plantOf(farm)).toBeNull();
    expect(farm.getState().stock.hay).toBe(1);
    expect(farm.drainEvents().at(-1)).toEqual({
      type: 'harvested',
      timeDeciticks: 60 + 1200 + 60,
      at: { x: 0, y: 0 },
      species: 'grass',
      item: 'hay',
      quantity: 1,
    });
  });

  it('destroys a plant that is not ripe yet and rewards nothing', () => {
    const farm = createFarm(config);

    farm.run('plant(Plant.GRASS);\nwait(119);\nharvest();').step(1000);

    expect(plantOf(farm)).toBeNull();
    expect(farm.getState().stock.hay).toBe(0);
    expect(farm.drainEvents().at(-1)).toEqual({
      type: 'destroyed',
      timeDeciticks: 60 + 1190 + 60,
      at: { x: 0, y: 0 },
      species: 'grass',
    });
  });

  it('starts with an empty stock', () => {
    expect(createFarm(config).getState().stock).toEqual({ hay: 0, wheat: 0 });
  });
});

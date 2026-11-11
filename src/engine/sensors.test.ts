import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';

const config = { width: 3, height: 2, seed: 1 };

/** Runs the script to the end and returns what it logged, one list of values per `log` call. */
function logged(source: string) {
  const farm = createFarm(config);
  const run = farm.run(source);
  run.step(10_000);
  const values = farm.drainEvents().flatMap((event) => (event.type === 'logged' ? [event.values] : []));
  return { values, run, farm };
}

describe('log', () => {
  it('records the values it receives as an event, at no cost', () => {
    const { values, run, farm } = logged("log(1, 'two', Dir.EAST);");

    expect(values).toEqual([[1, 'two', { x: 1, y: 0 }]]);
    expect(run.getMeter().deciticks).toBe(0);
    expect(farm.getState().tick).toBe(0);
  });

  it('stamps the event with the time it was called at', () => {
    const farm = createFarm(config);
    farm.run('move(Dir.EAST);\nlog(1);').step(100);

    expect(farm.drainEvents().at(-1)).toEqual({ type: 'logged', timeDeciticks: 80, values: [1] });
  });
});

describe('sensors', () => {
  it('getPos returns the drone position', () => {
    expect(logged('log(getPos());\nmove(Dir.EAST);\nlog(getPos());').values).toEqual([
      [{ x: 0, y: 0 }],
      [{ x: 1, y: 0 }],
    ]);
  });

  it('getSize returns the field size', () => {
    expect(logged('log(getSize());').values).toEqual([[{ width: 3, height: 2 }]]);
  });

  it('getPlant returns the species planted in the cell, or null', () => {
    expect(logged('log(getPlant());\nplant(Plant.GRASS);\nlog(getPlant());').values).toEqual([[null], ['grass']]);
  });

  it('isReady is true only once the plant has ripened', () => {
    const source = (waited: number) => `plant(Plant.GRASS);\nwait(${waited});\nlog(isReady());`;

    expect(logged('log(isReady());').values).toEqual([[false]]);
    expect(logged(source(119)).values).toEqual([[false]]);
    expect(logged(source(120)).values).toEqual([[true]]);
  });

  it('getTerrain returns the terrain of the cell, matching the Terrain constants', () => {
    expect(logged('log(getTerrain());\ntill();\nlog(getTerrain());\nlog(Terrain.GRASS, Terrain.TILLED);').values).toEqual([
      ['grass'],
      ['tilled'],
      ['grass', 'tilled'],
    ]);
  });

  it('getStock returns how much of an item is in stock', () => {
    const source = 'log(getStock(Item.HAY));\nplant(Plant.GRASS);\nwait(120);\nharvest();\nlog(getStock(Item.HAY), getStock(Item.WHEAT));';

    expect(logged(source).values).toEqual([[0], [1, 0]]);
  });

  it.each(['getPos', 'getSize', 'getPlant', 'isReady', 'getTerrain'])('%s costs one tick', (name) => {
    expect(logged(`${name}();`).run.getMeter().ticks).toBe(1);
  });

  it('getStock costs one tick', () => {
    expect(logged('getStock(Item.HAY);').run.getMeter().ticks).toBe(1);
  });

  it.each([
    ['getStock()', /Line 1: getStock expects an item/],
    ['getStock(Plant.GRASS)', /Line 1: getStock expects an item/],
    ['getPos(1)', /Line 1: getPos takes no arguments/],
    ['isReady(Dir.EAST)', /Line 1: isReady takes no arguments/],
  ])('rejects %s', (source, message) => {
    expect(() => createFarm(config).run(source).step(100)).toThrow(ScriptError);
    expect(() => createFarm(config).run(source).step(100)).toThrow(message);
  });
});

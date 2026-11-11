import { describe, expect, it } from 'vitest';
import { createFarm } from './index';

function newFarm() {
  return createFarm({ width: 3, height: 2, seed: 1 });
}

describe('running a script', () => {
  it('plants grass in the drone cell and charges the plant cost in ticks', () => {
    const farm = newFarm();

    const run = farm.run('plant(Plant.GRASS);');
    run.step(100);

    expect(run.isFinished).toBe(true);
    expect(farm.getState().field.cells[0]?.plant?.species).toBe('grass');
    expect(run.getMeter().deciticks).toBe(60);
    expect(run.getMeter().ticks).toBe(6);
    expect(farm.getState().tick).toBe(6);
  });

  it('moves the drone one cell and charges the move cost', () => {
    const farm = newFarm();

    const run = farm.run('move(Dir.EAST);');
    run.step(100);

    expect(farm.getState().drone).toEqual({ x: 1, y: 0 });
    expect(run.getMeter().ticks).toBe(8);
  });

  it('keeps the drone in place when it bumps into the field border, still charging the move', () => {
    const farm = newFarm();

    const run = farm.run(`move(Dir.NORTH);
move(Dir.WEST);`);
    run.step(100);

    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
    expect(run.getMeter().ticks).toBe(16);
  });

  it('removes the plant of the drone cell on harvest and charges the harvest cost', () => {
    const farm = newFarm();

    const run = farm.run(`plant(Plant.GRASS);
harvest();`);
    run.step(100);

    expect(farm.getState().field.cells[0]?.plant).toBeNull();
    expect(run.getMeter().ticks).toBe(12);
  });

  it('does nothing but still charges the cost when planting on an occupied cell', () => {
    const farm = newFarm();

    const run = farm.run(`plant(Plant.GRASS);
plant(Plant.GRASS);`);
    run.step(100);

    expect(farm.getState().field.cells[0]?.plant?.species).toBe('grass');
    expect(run.getMeter().ticks).toBe(12);
  });
});

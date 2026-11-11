import { describe, expect, it } from 'vitest';
import { createFarm } from './index';

function newFarm() {
  return createFarm({ width: 3, height: 2, seed: 1 });
}

describe('stepping a run', () => {
  it('pauses between actions once the tick budget is used and resumes where it stopped', () => {
    const farm = newFarm();
    const run = farm.run(`move(Dir.EAST);
move(Dir.EAST);`);

    run.step(8);

    expect(farm.getState().drone).toEqual({ x: 1, y: 0 });
    expect(run.isFinished).toBe(false);

    run.step(8);

    expect(farm.getState().drone).toEqual({ x: 2, y: 0 });
    expect(run.getMeter().ticks).toBe(16);
  });

  it('does not advance the farm when the budget is zero', () => {
    const farm = newFarm();
    const run = farm.run('move(Dir.EAST);');

    run.step(0);

    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
    expect(farm.getState().tick).toBe(0);
  });

  it('reports the run as finished only after the last action completes', () => {
    const farm = newFarm();
    const run = farm.run('plant(Plant.GRASS);');

    run.step(1);

    expect(run.isFinished).toBe(false);

    run.step(1);

    expect(run.isFinished).toBe(true);
  });
});

describe('farm events', () => {
  it('emits one event per state change, stamped with the exact time it completed at, in deciticks', () => {
    const farm = newFarm();

    farm.run(`plant(Plant.GRASS);
harvest();
move(Dir.EAST);
move(Dir.NORTH);
harvest();`).step(100);

    expect(farm.drainEvents()).toEqual([
      { type: 'planted', timeDeciticks: 60, at: { x: 0, y: 0 }, species: 'grass' },
      { type: 'harvested', timeDeciticks: 120, at: { x: 0, y: 0 } },
      { type: 'moved', timeDeciticks: 200, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'bumped', timeDeciticks: 280, at: { x: 1, y: 0 } },
    ]);
  });

  it('emits no event when a harvest finds nothing to harvest', () => {
    const farm = newFarm();

    farm.run('harvest();').step(100);

    expect(farm.drainEvents()).toEqual([]);
  });

  it('hands each event over only once', () => {
    const farm = newFarm();
    farm.run('plant(Plant.GRASS);').step(100);

    farm.drainEvents();

    expect(farm.drainEvents()).toEqual([]);
  });
});

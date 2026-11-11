import { describe, expect, it } from 'vitest';
import { createFarm } from './index';
import type { FarmEvent } from './index';

/**
 * A stand-in for the view: it asks the engine for `ticksPerFrame` ticks per frame, and either
 * reads the events every frame, reads them only at the end, or never reads them at all.
 * Speed is nothing but how many ticks a frame asks for: it must never change what happens.
 */
type Reading = 'every-frame' | 'at-the-end' | 'never';

interface Playback {
  readonly hash: string;
  readonly deciticks: number;
  readonly events: FarmEvent[];
  readonly finished: boolean;
}

function play(source: string, options: { seed?: number; totalTicks: number; ticksPerFrame: number; reading?: Reading }): Playback {
  const { seed = 7, totalTicks, ticksPerFrame, reading = 'every-frame' } = options;
  const farm = createFarm({ width: 4, height: 4, seed });
  const run = farm.run(source);
  const events: FarmEvent[] = [];
  for (let given = 0; given < totalTicks && !run.isFinished; given += ticksPerFrame) {
    run.step(Math.min(ticksPerFrame, totalTicks - given));
    if (reading === 'every-frame') events.push(...farm.drainEvents());
  }
  if (reading === 'at-the-end') events.push(...farm.drainEvents());
  return { hash: farm.getStateHash(), deciticks: run.getMeter().deciticks, events, finished: run.isFinished };
}

/** Never ends: wanders at random, planting and harvesting, so every part of the simulation is exercised. */
const WANDER = `
while (true) {
  const roll = random();
  if (roll < 0.25) {
    move(Dir.EAST);
  } else if (roll < 0.5) {
    move(Dir.SOUTH);
  } else if (roll < 0.75) {
    move(Dir.WEST);
  } else {
    move(Dir.NORTH);
  }
  if (getTerrain() === Terrain.GRASS) {
    plant(Plant.GRASS);
  }
  if (isReady()) {
    harvest();
  }
  log(getPos());
}
`;

/** Ends by itself after a fixed amount of work. */
const FINITE = `
for (let i = 0; i < 12; i++) {
  plant(Plant.GRASS);
  move(i % 2 === 0 ? Dir.EAST : Dir.SOUTH);
  wait(3);
  log(random());
}
`.replace('i % 2 === 0 ? Dir.EAST : Dir.SOUTH', 'Dir.EAST');

const TOTAL = 3000;
const SPEEDS = [
  ['1x (one tick per frame)', 1],
  ['16x (sixteen ticks per frame)', 16],
  ['instant (everything in one frame)', TOTAL],
] as const;

describe('speed only changes how often the view asks, never what happens', () => {
  for (const [scriptName, source] of [
    ['an endless script that uses random()', WANDER],
    ['a script that finishes', FINITE],
  ] as const) {
    describe(scriptName, () => {
      const reference = play(source, { totalTicks: TOTAL, ticksPerFrame: TOTAL });

      it.each(SPEEDS)('gives the same final state, time and events at %s', (_label, ticksPerFrame) => {
        const result = play(source, { totalTicks: TOTAL, ticksPerFrame });

        expect(result.hash).toBe(reference.hash);
        expect(result.deciticks).toBe(reference.deciticks);
        expect(result.finished).toBe(reference.finished);
        expect(result.events).toEqual(reference.events);
      });

      it.each(['at-the-end', 'never'] as const)('is not changed by reading the events %s', (reading) => {
        const result = play(source, { totalTicks: TOTAL, ticksPerFrame: 16, reading });

        expect(result.hash).toBe(reference.hash);
        expect(result.deciticks).toBe(reference.deciticks);
        if (reading === 'at-the-end') expect(result.events).toEqual(reference.events);
      });

      it.each([2, 3, 5, 7, 10, 100, 999])('is not changed by cutting the steps into %i ticks', (ticksPerFrame) => {
        const result = play(source, { totalTicks: TOTAL, ticksPerFrame });

        expect(result.hash).toBe(reference.hash);
        expect(result.deciticks).toBe(reference.deciticks);
        expect(result.events).toEqual(reference.events);
      });
    });
  }

  it('takes exactly the time that was asked for, in one step or in a thousand', () => {
    const farm = createFarm({ width: 4, height: 4, seed: 7 });
    const run = farm.run('while (true) {\n  move(Dir.EAST);\n}');
    for (let frame = 0; frame < 800; frame++) run.step(1);

    expect(run.getMeter().ticks).toBe(800);
  });
});

describe('the clock never runs ahead of what was asked for', () => {
  it('stops exactly where the steps add up to, even in the middle of an action', () => {
    const farm = createFarm({ width: 4, height: 4, seed: 7 });
    const run = farm.run('while (true) {\n  move(Dir.EAST);\n}');

    for (const asked of [1, 3, 5, 7, 11]) {
      const before = run.getMeter().ticks;
      run.step(asked);
      expect(run.getMeter().ticks).toBe(before + asked);
    }
  });

  it('applies the effect of an action only once its whole cost has been paid', () => {
    const farm = createFarm({ width: 4, height: 4, seed: 7 });
    const run = farm.run('plant(Plant.GRASS);');

    run.step(5);
    expect(farm.getState().field.cells[0]?.plant).toBeNull();
    expect(farm.drainEvents()).toEqual([]);

    run.step(1);
    expect(farm.getState().field.cells[0]?.plant).not.toBeNull();
    expect(farm.drainEvents()).toEqual([expect.objectContaining({ type: 'planted', timeDeciticks: 60 })]);
  });

  it('lets a long wait pass little by little, so what grows meanwhile can be seen growing', () => {
    const farm = createFarm({ width: 1, height: 1, seed: 7 });
    const run = farm.run('plant(Plant.GRASS);\nwait(500);');
    const stages: string[] = [];
    for (let tick = 0; tick < 200; tick++) {
      run.step(1);
      const stage = farm.getState().field.cells[0]?.plant?.stage;
      if (stage && stages.at(-1) !== stage) stages.push(stage);
    }

    expect(stages).toEqual(['sprout', 'growing', 'ready']);
    expect(run.isFinished).toBe(false);
  });

  it('keeps an action that was cut by the budget going where it stopped', () => {
    const cut = createFarm({ width: 4, height: 4, seed: 7 });
    const whole = createFarm({ width: 4, height: 4, seed: 7 });
    const source = 'move(Dir.EAST);\nplant(Plant.GRASS);\nwait(30);\nmove(Dir.SOUTH);';
    const run = cut.run(source);
    for (let i = 0; i < 100; i++) run.step(1);
    whole.run(source).step(100);

    expect(cut.getStateHash()).toBe(whole.getStateHash());
  });
});

describe('the events', () => {
  const { events } = play(WANDER, { totalTicks: TOTAL, ticksPerFrame: 16 });

  it('come in time order, and every one is stamped with when it happened', () => {
    expect(events.length).toBeGreaterThan(100);
    const stamps = events.map((event) => event.timeDeciticks);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    for (const stamp of stamps) expect(Number.isInteger(stamp)).toBe(true);
  });

  it('are stamped in deciticks, so a tenth of a tick is not lost', () => {
    const farm = createFarm({ width: 4, height: 4, seed: 7 });
    // One assignment costs a tenth of a tick, then the move takes 8 ticks: it ends at 8.1 ticks = 81 deciticks.
    farm.run('let x = 1;\nmove(Dir.EAST);').step(100);

    expect(farm.drainEvents()).toEqual([expect.objectContaining({ type: 'moved', timeDeciticks: 81 })]);
  });

  it('never carry a time after the end of the simulation', () => {
    const { deciticks } = play(WANDER, { totalTicks: TOTAL, ticksPerFrame: 16 });

    expect(Math.max(...events.map((event) => event.timeDeciticks))).toBeLessThanOrEqual(deciticks);
  });

  it('can be sent as JSON and read back unchanged', () => {
    expect(JSON.parse(JSON.stringify(events))).toEqual(events);
  });
});

describe('the seed', () => {
  it('gives the same state to the same script, and another state to another seed', () => {
    const a = play(WANDER, { seed: 1, totalTicks: TOTAL, ticksPerFrame: 16 });
    const b = play(WANDER, { seed: 1, totalTicks: TOTAL, ticksPerFrame: 1 });
    const c = play(WANDER, { seed: 2, totalTicks: TOTAL, ticksPerFrame: 16 });

    expect(b.hash).toBe(a.hash);
    expect(c.hash).not.toBe(a.hash);
  });
});

describe('two scripts that do the same thing, one short and one long', () => {
  const SHORT = 'for (let i = 0; i < 3; i++) {\n  plant(Plant.GRASS);\n  move(Dir.EAST);\n}';
  const LONG = 'plant(Plant.GRASS);\nmove(Dir.EAST);\nplant(Plant.GRASS);\nmove(Dir.EAST);\nplant(Plant.GRASS);\nmove(Dir.EAST);';

  function outcome(source: string) {
    const farm = createFarm({ width: 4, height: 4, seed: 7 });
    const run = farm.run(source);
    run.step(10_000);
    const { tick, ...world } = farm.getState();
    return { world, ticks: run.getMeter().ticks, finished: run.isFinished, tick };
  }

  it('leave the farm the same, but show different times on the meter', () => {
    const short = outcome(SHORT);
    const long = outcome(LONG);

    expect(short.finished).toBe(true);
    expect(long.finished).toBe(true);
    expect(short.world).toEqual(long.world);
    expect(short.ticks).not.toBe(long.ticks);
  });

  it('cost the same every time they are run', () => {
    expect(outcome(SHORT).ticks).toBe(outcome(SHORT).ticks);
    expect(outcome(LONG).ticks).toBe(outcome(LONG).ticks);
  });
});

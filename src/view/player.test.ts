import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from '../engine';
import { GARDEN, SWEEP } from './demos';
import { FarmScene } from './farm-scene';
import { Player, TICKS_PER_SECOND } from './player';
import type { Speed } from './player';

const FRAME = 1 / 60;

/** Plays a script to its end at a speed, one frame at a time, the way the view does. */
function playAt(speed: Speed, source = GARDEN, size = { width: 3, height: 2 }) {
  const farm = createFarm({ ...size, seed: 1 });
  const scene = new FarmScene(size.width, size.height);
  const player = new Player(farm, farm.run(source), scene);
  player.speed = speed;
  for (let frame = 0; !player.isFinished && frame < 200_000; frame++) {
    player.advance(FRAME);
    scene.update(FRAME);
  }
  return { farm, scene, player };
}

describe('the speed of the view', () => {
  const reference = playAt(1);

  it.each([1, 16, 'instant'] as const)('ends the same at speed %s: same state, same picture', (speed) => {
    const result = playAt(speed);

    expect(result.player.isFinished).toBe(true);
    expect(result.farm.getStateHash()).toBe(reference.farm.getStateHash());
    expect(result.scene.snapshot()).toEqual(reference.scene.snapshot());
  });

  it('ends the same as the engine on its own, with nobody watching', () => {
    const alone = createFarm({ width: 3, height: 2, seed: 1 });
    alone.run(GARDEN).step(1_000_000);

    expect(reference.farm.getStateHash()).toBe(alone.getStateHash());
  });

  it('only changes how many ticks are asked for each second', () => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    const player = new Player(farm, farm.run(GARDEN), new FarmScene(3, 2));
    player.speed = 16;
    for (let frame = 0; frame < 60; frame++) player.advance(FRAME);

    expect(player.ticksGiven).toBeGreaterThanOrEqual(16 * TICKS_PER_SECOND - 1);
    expect(player.ticksGiven).toBeLessThanOrEqual(16 * TICKS_PER_SECOND);
  });

  it('can change in the middle of a run without changing the result', () => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    const scene = new FarmScene(3, 2);
    const player = new Player(farm, farm.run(GARDEN), scene);
    for (let frame = 0; !player.isFinished && frame < 200_000; frame++) {
      player.speed = [1, 16, 3, 'instant'][Math.floor(frame / 300) % 4] as Speed;
      player.advance(FRAME);
    }

    expect(farm.getStateHash()).toBe(reference.farm.getStateHash());
  });
});

describe('a whole field', () => {
  it('ends the same at any speed on a 16x16 field', () => {
    const size = { width: 16, height: 16 };
    const slow = playAt(16, SWEEP, size);
    const fast = playAt('instant', SWEEP, size);

    expect(slow.farm.getStateHash()).toBe(fast.farm.getStateHash());
    expect(slow.scene.snapshot()).toEqual(fast.scene.snapshot());
    expect(fast.scene.stats().plants).toBe(256);
  });
});

describe('a speed or a time that makes no sense', () => {
  function fresh() {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    return { farm, player: new Player(farm, farm.run(GARDEN), new FarmScene(3, 2)) };
  }

  it.each([Number.NaN, -3, 0, Number.POSITIVE_INFINITY])('ignores the speed %s instead of corrupting the count', (speed) => {
    const { player } = fresh();
    player.speed = speed;
    player.advance(1);
    player.speed = 1;
    player.advance(1);

    expect(player.error).toBeUndefined();
    expect(player.ticksGiven).toBe(TICKS_PER_SECOND);
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])('ignores %s seconds of real time', (seconds) => {
    const { player } = fresh();
    player.advance(seconds);
    player.advance(1);

    expect(player.error).toBeUndefined();
    expect(player.ticksGiven).toBe(TICKS_PER_SECOND);
  });

  it.each([Number.NaN, 1.5, -1, Number.POSITIVE_INFINITY])('does not hand the engine %s ticks, and does not take it for a script error', (ticks) => {
    const { player } = fresh();
    player.advanceTicks(ticks);

    expect(player.error).toBeUndefined();
    expect(player.ticksGiven).toBe(0);
  });
});

describe('the player', () => {
  it('keeps a script error to show it, instead of throwing it inside the animation loop', () => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    const player = new Player(farm, farm.run('move(Dir.EAST);\ndance();'), new FarmScene(3, 2));
    player.advanceTicks(100);

    expect(player.error).toBeInstanceOf(ScriptError);
    expect(player.isFinished).toBe(true);
  });

  it('does nothing once the script has ended', () => {
    const { player } = playAt('instant');
    const given = player.ticksGiven;
    player.advanceTicks(100);

    expect(player.ticksGiven).toBe(given);
  });
});

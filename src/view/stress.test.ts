import { describe, expect, it } from 'vitest';
import { createFarm } from '../engine';
import type { GrowthStage, PlantSpecies } from '../engine';
import { FarmScene } from './farm-scene';
import { shouldHandleShortcut } from './shortcuts';
import { FRAME_WINDOW_SECONDS, stressPlants, summarizeFrames } from './stress';

const plain = { ctrl: false, meta: false, alt: false, inTextField: false };

describe('the made-up plants of the stress field', () => {
  const plants = stressPlants(32, 32);

  it('fill every cell of a 32x32 field with both species and the three growth stages', () => {
    const seen = new Set(plants.map((plant) => `${plant?.species}:${plant?.stage}`));

    expect(plants).toHaveLength(32 * 32);
    expect(plants.every((plant) => plant !== null)).toBe(true);
    expect(seen).toEqual(
      new Set(['grass', 'wheat'].flatMap((species) => ['sprout', 'growing', 'ready'].map((stage) => `${species}:${stage}`))),
    );
  });

  it('always come out the same, so the cameras are compared on the very same field', () => {
    expect(stressPlants(32, 32)).toEqual(plants);
  });

  it('put the stages in rows and the species in a chess pattern, so each can be told apart', () => {
    const at = (x: number, y: number) => plants[y * 32 + x];

    expect(at(0, 0)?.stage).toBe(at(5, 0)?.stage);
    expect(at(0, 0)?.stage).not.toBe(at(0, 1)?.stage);
    expect(at(0, 0)?.species).not.toBe(at(1, 0)?.species);
    expect(at(0, 0)?.species).toBe(at(1, 1)?.species);
  });
});

describe('the made-up plants are not part of the farm', () => {
  it('are drawn by the scene without the engine ever hearing of them', () => {
    const farm = createFarm({ width: 32, height: 32, seed: 1 });
    const hash = farm.getStateHash();
    const state = farm.getState();
    const scene = new FarmScene(32, 32);
    scene.sync(state);
    scene.showMadeUpPlants(stressPlants(32, 32));

    expect(scene.stats().madeUpPlants).toBe(32 * 32);
    expect(farm.getStateHash()).toBe(hash);
    expect(farm.getState()).toEqual(state);
    expect(scene.snapshot().plants.every((plant) => plant === null)).toBe(true);
  });

  it('use the very same models as the real plants', () => {
    const scene = new FarmScene(32, 32);
    const geometries = new Set<unknown>();
    scene.showMadeUpPlants(stressPlants(32, 32));
    scene.root.traverse((object) => {
      const mesh = object as { isMesh?: boolean; geometry?: unknown; material?: { vertexColors?: boolean } };
      if (mesh.isMesh && mesh.material?.vertexColors) geometries.add(mesh.geometry);
    });

    expect(geometries.size).toBe(6);
    for (const species of ['grass', 'wheat'] as PlantSpecies[]) {
      for (const stage of ['sprout', 'growing', 'ready'] as GrowthStage[]) expect(geometries.has(scene.shapeOf(species, stage))).toBe(true);
    }
  });

  it('go away when asked, and the farm shows what it really has', () => {
    const farm = createFarm({ width: 4, height: 4, seed: 1 });
    const scene = new FarmScene(4, 4);
    scene.showMadeUpPlants(stressPlants(4, 4));
    scene.clearMadeUpPlants();
    scene.sync(farm.getState());

    expect(scene.stats().madeUpPlants).toBe(0);
    expect(scene.snapshot().terrain.every((terrain) => terrain === 'grass')).toBe(true);
  });

  it('refuse a pattern of another size, instead of drawing it wrong', () => {
    const scene = new FarmScene(4, 4);

    expect(() => scene.showMadeUpPlants(stressPlants(3, 3))).toThrow();
  });
});

describe('the frame counter', () => {
  const frames = (durations: number[], endAt = 10_000) => {
    let at = endAt - durations.reduce((sum, ms) => sum + ms, 0);
    return durations.map((ms) => ({ at: (at += ms), ms }));
  };

  it('looks at the last four seconds', () => {
    expect(FRAME_WINDOW_SECONDS).toBe(4);
  });

  it('gives the frames per second and the worst frame', () => {
    const summary = summarizeFrames(frames([16, 16, 20, 16, 32, 16]), 10_000);

    expect(summary.worstMs).toBe(32);
    expect(summary.fps).toBeCloseTo(1000 / ((16 + 16 + 20 + 16 + 32 + 16) / 6), 5);
  });

  it('forgets frames older than four seconds, a slow one included', () => {
    const old = [{ at: 1000, ms: 500 }];
    const recent = frames(Array(60).fill(16), 10_000);
    const summary = summarizeFrames([...old, ...recent], 10_000);

    expect(summary.worstMs).toBe(16);
  });

  it('says nothing before there is a frame to talk about', () => {
    expect(summarizeFrames([], 10_000)).toEqual({ fps: 0, worstMs: 0, frames: 0 });
  });
});

describe('the keyboard shortcuts', () => {
  it('C switches the camera and F switches following, in either case', () => {
    expect(shouldHandleShortcut({ key: 'c', ...plain })).toBe('toggle-camera');
    expect(shouldHandleShortcut({ key: 'C', ...plain })).toBe('toggle-camera');
    expect(shouldHandleShortcut({ key: 'f', ...plain })).toBe('toggle-follow');
    expect(shouldHandleShortcut({ key: 'F', ...plain })).toBe('toggle-follow');
  });

  it('do nothing while the player is typing in the editor or in any text field', () => {
    expect(shouldHandleShortcut({ key: 'c', ...plain, inTextField: true })).toBeUndefined();
    expect(shouldHandleShortcut({ key: 'f', ...plain, inTextField: true })).toBeUndefined();
  });

  it('leave alone every combination that already means something else (copy, find...)', () => {
    expect(shouldHandleShortcut({ key: 'c', ...plain, ctrl: true })).toBeUndefined();
    expect(shouldHandleShortcut({ key: 'c', ...plain, meta: true })).toBeUndefined();
    expect(shouldHandleShortcut({ key: 'f', ...plain, alt: true })).toBeUndefined();
  });

  it('ignore every other key', () => {
    expect(shouldHandleShortcut({ key: 'x', ...plain })).toBeUndefined();
    expect(shouldHandleShortcut({ key: 'Enter', ...plain })).toBeUndefined();
  });
});

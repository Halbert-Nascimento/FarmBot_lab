import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFarm } from '../engine';
import type { FarmEvent, GrowthStage, PlantSpecies } from '../engine';
import { GARDEN } from './demos';
import { FarmScene } from './farm-scene';
import { DEFAULT_MODELS } from './models';
import type { PlantModels } from './models';
import { Player } from './player';

const SPECIES: PlantSpecies[] = ['grass', 'wheat'];
const STAGES: GrowthStage[] = ['sprout', 'growing', 'ready'];

/** Plays the garden script to its end through the scene, the way the view does. */
function playGarden(models?: PlantModels) {
  const farm = createFarm({ width: 3, height: 2, seed: 1 });
  const scene = new FarmScene(3, 2, models);
  const player = new Player(farm, farm.run(GARDEN), scene);
  for (let guard = 0; !player.isFinished && guard < 1000; guard++) player.advanceTicks(10);
  return { farm, scene, player };
}

function shapeSignature(scene: FarmScene, species: PlantSpecies, stage: GrowthStage) {
  const geometry = scene.shapeOf(species, stage);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox as THREE.Box3;
  const colors = geometry.getAttribute('color');
  const palette = new Set<string>();
  for (let i = 0; i < colors.count; i++) {
    palette.add(new THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString());
  }
  return {
    height: Number(box.max.y.toFixed(3)),
    vertices: geometry.getAttribute('position').count,
    palette: [...palette].sort().join(','),
  };
}

describe('the field', () => {
  it('shows every cell of the field, and nothing planted yet', () => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    const scene = new FarmScene(3, 2);
    scene.sync(farm.getState());

    expect(scene.snapshot().terrain).toEqual(Array(6).fill('grass'));
    expect(scene.snapshot().plants).toEqual(Array(6).fill(null));
    expect(scene.snapshot().drone).toEqual({ x: 0, y: 0 });
  });

  it('puts the cells in a grid, the y axis of the farm running towards the viewer', () => {
    const scene = new FarmScene(3, 2);

    expect(scene.worldOf({ x: 0, y: 0 })).toEqual({ x: -1, z: -0.5 });
    expect(scene.worldOf({ x: 2, y: 1 })).toEqual({ x: 1, z: 0.5 });
  });

  it('paints neighbouring cells in different shades, so each cell can be told apart', () => {
    const scene = new FarmScene(4, 4);
    const a = scene.tileColor({ x: 0, y: 0 }).getHex();

    expect(scene.tileColor({ x: 1, y: 0 }).getHex()).not.toBe(a);
    expect(scene.tileColor({ x: 0, y: 1 }).getHex()).not.toBe(a);
    expect(scene.tileColor({ x: 1, y: 1 }).getHex()).toBe(a);
  });

  it('paints tilled soil differently from grass', () => {
    const farm = createFarm({ width: 2, height: 1, seed: 1 });
    const scene = new FarmScene(2, 1);
    const grass = scene.tileColor({ x: 0, y: 0 }).getHex();
    farm.run('till();').step(100);
    scene.sync(farm.getState());

    expect(scene.tileColor({ x: 0, y: 0 }).getHex()).not.toBe(grass);
  });

  it('refuses a state of another size, instead of drawing it wrong', () => {
    const scene = new FarmScene(3, 2);

    expect(() => scene.sync(createFarm({ width: 4, height: 4, seed: 1 }).getState())).toThrow();
  });
});

describe('the plants', () => {
  const scene = new FarmScene(3, 2);

  it('look different for each species and each growth stage', () => {
    const signatures = SPECIES.flatMap((species) => STAGES.map((stage) => JSON.stringify(shapeSignature(scene, species, stage))));

    expect(new Set(signatures).size).toBe(6);
  });

  it.each(SPECIES)('%s grows taller at each stage', (species) => {
    const [sprout, growing, ready] = STAGES.map((stage) => shapeSignature(scene, species, stage).height);

    expect(sprout).toBeLessThan(growing as number);
    expect(growing).toBeLessThan(ready as number);
  });

  it('are told apart by colour when ripe: green grass, golden wheat', () => {
    expect(shapeSignature(scene, 'grass', 'ready').palette).not.toBe(shapeSignature(scene, 'wheat', 'ready').palette);
  });

  it('are drawn as one single piece each', () => {
    for (const species of SPECIES) for (const stage of STAGES) expect(scene.shapeOf(species, stage)).toBeInstanceOf(THREE.BufferGeometry);
  });
});

describe('the scene follows the engine', () => {
  it('shows exactly what the engine state says, after the whole garden script', () => {
    const { farm, scene } = playGarden();
    const state = farm.getState();

    expect(scene.snapshot().terrain).toEqual(state.field.cells.map((cell) => cell.terrain));
    expect(scene.snapshot().plants).toEqual(state.field.cells.map((cell) => (cell.plant ? { species: cell.plant.species, stage: cell.plant.stage } : null)));
    expect(scene.snapshot().drone).toEqual(state.drone);
  });

  it('shows the plants growing through the three stages as time goes by', () => {
    const farm = createFarm({ width: 1, height: 1, seed: 1 });
    const scene = new FarmScene(1, 1);
    const run = farm.run('plant(Plant.GRASS);\nwait(500);');
    const seen: string[] = [];
    for (let tick = 0; tick < 140; tick++) {
      run.step(1);
      scene.sync(farm.getState());
      const stage = scene.snapshot().plants[0]?.stage;
      if (stage && seen.at(-1) !== stage) seen.push(stage);
    }

    expect(seen).toEqual(['sprout', 'growing', 'ready']);
  });

  it('removes a plant that was harvested', () => {
    const farm = createFarm({ width: 1, height: 1, seed: 1 });
    const scene = new FarmScene(1, 1);
    farm.run('plant(Plant.GRASS);\nwait(130);\nharvest();').step(1000);
    scene.sync(farm.getState());

    expect(scene.snapshot().plants).toEqual([null]);
  });
});

describe('the scene never changes the engine', () => {
  it('leaves the engine in the very same state as a run nobody watched', () => {
    const watched = playGarden();
    const alone = createFarm({ width: 3, height: 2, seed: 1 });
    alone.run(GARDEN).step(1_000_000);

    expect(watched.farm.getStateHash()).toBe(alone.getStateHash());
  });

  it('cannot reach the engine through what it was given', () => {
    const farm = createFarm({ width: 2, height: 1, seed: 1 });
    const scene = new FarmScene(2, 1);
    const before = farm.getStateHash();
    const state = farm.getState();
    scene.sync(state);
    scene.handle([{ type: 'planted', timeDeciticks: 0, at: { x: 0, y: 0 }, species: 'grass' }]);
    scene.update(1);

    expect(farm.getStateHash()).toBe(before);
    expect(farm.getState()).toEqual(state);
  });
});

describe('swapping the model of a plant', () => {
  const cube: PlantModels = {
    ...DEFAULT_MODELS,
    wheat: () => new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0xff00ff })),
  };

  it('changes the look and nothing the engine does: the final hash is the same', () => {
    const original = playGarden();
    const swapped = playGarden(cube);

    expect(swapped.farm.getStateHash()).toBe(original.farm.getStateHash());
    expect(swapped.scene.snapshot()).toEqual(original.scene.snapshot());
    expect(shapeSignature(swapped.scene, 'wheat', 'ready')).not.toEqual(shapeSignature(original.scene, 'wheat', 'ready'));
  });

  it('leaves the other species as they were', () => {
    const swapped = new FarmScene(3, 2, cube);
    const original = new FarmScene(3, 2);

    expect(shapeSignature(swapped, 'grass', 'ready')).toEqual(shapeSignature(original, 'grass', 'ready'));
  });
});

describe('the events', () => {
  const plantedAt = (x: number): FarmEvent => ({ type: 'planted', timeDeciticks: 0, at: { x, y: 0 }, species: 'grass' });

  function plantMeshes(scene: FarmScene): THREE.Mesh[] {
    return scene.root.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.geometry.hasAttribute('color'));
  }

  it('make a newly planted plant pop into place, small at first and full size a moment later', () => {
    const farm = createFarm({ width: 2, height: 1, seed: 1 });
    const scene = new FarmScene(2, 1);
    farm.run('plant(Plant.GRASS);').step(100);
    scene.handle(farm.drainEvents());
    scene.sync(farm.getState());

    expect(plantMeshes(scene)[0]?.scale.x).toBeLessThan(0.5);
    scene.update(1);
    expect(plantMeshes(scene)[0]?.scale.x).toBe(1);
  });

  it('do not make a plant that was already there pop again', () => {
    const farm = createFarm({ width: 2, height: 1, seed: 1 });
    farm.run('plant(Plant.GRASS);').step(100);
    const scene = new FarmScene(2, 1);
    scene.sync(farm.getState());

    expect(plantMeshes(scene)[0]?.scale.x).toBe(1);
  });

  it('send up dust when something is harvested, and let it fall away', () => {
    const scene = new FarmScene(2, 1);
    scene.handle([{ type: 'harvested', timeDeciticks: 0, at: { x: 0, y: 0 }, species: 'grass', item: 'hay', quantity: 1 }]);

    expect(scene.stats().particles).toBeGreaterThan(0);
    scene.update(2);
    expect(scene.stats().particles).toBe(0);
  });

  it('never keep more than a bounded number of particles, however many events arrive', () => {
    const scene = new FarmScene(2, 1);
    const harvest: FarmEvent = { type: 'harvested', timeDeciticks: 0, at: { x: 0, y: 0 }, species: 'grass', item: 'hay', quantity: 1 };
    scene.handle(Array.from({ length: 5000 }, () => harvest));

    expect(scene.stats().particles).toBeLessThanOrEqual(160);
  });

  it('ignore the events that need no flourish', () => {
    const scene = new FarmScene(2, 1);

    expect(() => scene.handle([plantedAt(1), { type: 'moved', timeDeciticks: 0, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { type: 'logged', timeDeciticks: 0, values: [1] }])).not.toThrow();
  });
});

describe('putting the scene away', () => {
  it('lets go of every geometry and material it made, and can be done twice', () => {
    const scene = new FarmScene(3, 2);
    const freed: string[] = [];
    scene.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      (object.geometry as THREE.BufferGeometry).addEventListener('dispose', () => freed.push('geometry'));
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.addEventListener('dispose', () => freed.push('material'));
    });
    scene.dispose();
    scene.dispose();

    expect(freed).toContain('geometry');
    expect(freed).toContain('material');
    expect(scene.root.children).toHaveLength(0);
  });
});

describe('the drone over a plant', () => {
  it('lets the plant under it show through, and is solid again once it moves away', () => {
    const farm = createFarm({ width: 3, height: 1, seed: 1 });
    const scene = new FarmScene(3, 1);
    farm.run('plant(Plant.GRASS);\nwait(1);').step(7);
    scene.handle(farm.drainEvents());
    scene.sync(farm.getState());
    for (let i = 0; i < 60; i++) scene.update(1 / 60);

    expect(scene.stats().droneOpacity).toBeLessThan(0.6);
    expect(scene.stats().droneOpacity).toBeGreaterThan(0.2);

    farm.run('move(Dir.EAST);').step(20);
    scene.sync(farm.getState());
    for (let i = 0; i < 60; i++) scene.update(1 / 60);

    expect(scene.stats().droneOpacity).toBeCloseTo(1, 1);
  });

  it('goes by where the drone is while it glides, not by the cell it is heading for', () => {
    const farm = createFarm({ width: 3, height: 1, seed: 1 });
    const scene = new FarmScene(3, 1);
    farm.run('plant(Plant.GRASS);\nwait(1);').step(7);
    scene.handle(farm.drainEvents());
    scene.sync(farm.getState());
    for (let i = 0; i < 60; i++) scene.update(1 / 60);
    const over = scene.stats().droneOpacity;

    farm.run('move(Dir.EAST);\nmove(Dir.EAST);').step(40);
    scene.sync(farm.getState());
    scene.update(1 / 60);

    // The drone has only just set off: it is still above the plant, so it stays see-through.
    expect(scene.stats().droneOpacity).toBeLessThanOrEqual(over + 0.02);
    for (let i = 0; i < 120; i++) scene.update(1 / 60);
    expect(scene.stats().droneOpacity).toBeCloseTo(1, 1);
  });

  it('is solid over an empty cell, and the ring on the ground always stays solid', () => {
    const scene = new FarmScene(3, 1);
    scene.sync(createFarm({ width: 3, height: 1, seed: 1 }).getState());
    for (let i = 0; i < 30; i++) scene.update(1 / 60);

    expect(scene.stats().droneOpacity).toBe(1);
    const marker = scene.root.children.find((child) => child.name === 'drone-marker') as THREE.Mesh;
    expect((marker.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0.85);
  });

  it('fades over a made-up plant too, so the stress field can be judged', () => {
    const scene = new FarmScene(3, 1);
    scene.sync(createFarm({ width: 3, height: 1, seed: 1 }).getState());
    scene.showMadeUpPlants([
      { species: 'wheat', stage: 'ready' },
      { species: 'grass', stage: 'ready' },
      { species: 'grass', stage: 'sprout' },
    ]);
    for (let i = 0; i < 60; i++) scene.update(1 / 60);

    expect(scene.stats().droneOpacity).toBeLessThan(0.6);
  });
});

describe('the drone', () => {
  it('stays easy to see on a big field: it grows with the field and has a ring on the ground under it', () => {
    const small = new FarmScene(3, 2);
    const big = new FarmScene(32, 32);

    expect(big.stats().droneScale).toBeGreaterThan(small.stats().droneScale);
    expect(big.stats().droneScale).toBeLessThan(2);
    expect(big.root.children.some((child) => child.name === 'drone-marker')).toBe(true);
  });

  it('keeps its ring under it as it glides', () => {
    const farm = createFarm({ width: 3, height: 1, seed: 1 });
    const scene = new FarmScene(3, 1);
    scene.sync(farm.getState());
    farm.run('move(Dir.EAST);').step(100);
    scene.sync(farm.getState());
    for (let i = 0; i < 120; i++) scene.update(1 / 60);
    const marker = scene.root.children.find((child) => child.name === 'drone-marker');

    expect(marker?.position.x).toBeCloseTo(scene.worldOf({ x: 1, y: 0 }).x, 1);
  });

  it('glides towards the cell the engine says it is in, without ever being ahead of the engine', () => {
    const farm = createFarm({ width: 3, height: 1, seed: 1 });
    const scene = new FarmScene(3, 1);
    scene.sync(farm.getState());
    farm.run('move(Dir.EAST);\nmove(Dir.EAST);').step(100);
    scene.sync(farm.getState());
    const target = scene.worldOf({ x: 2, y: 0 }).x;
    scene.update(1 / 60);
    const first = scene.root.children.find((child) => child instanceof THREE.Group) as THREE.Group;

    expect(first.position.x).toBeLessThan(target);
    for (let i = 0; i < 120; i++) scene.update(1 / 60);
    expect(first.position.x).toBeCloseTo(target, 1);
  });
});

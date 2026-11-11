import * as THREE from 'three';
import type { FarmEvent, FarmState, GrowthStage, PlantSpecies, Position, Terrain } from '../engine';
import { bake, DEFAULT_MODELS } from './models';
import type { PlantModels } from './models';

/**
 * The farm as a Three.js scene graph. It has no renderer, no canvas and no clock of its own, so it runs
 * (and is tested) anywhere. It only READS what the engine hands out: `sync` brings it to a state, `handle`
 * plays the little flourishes that go with the events, and `update` moves time on for the animations.
 * Nothing here decides anything about the farm, and nothing here can change it.
 */

const TILE_SIZE = 0.94;
const TILE_THICKNESS = 0.2;
const DRONE_HEIGHT = 0.75;
const MAX_PARTICLES = 160;

const TERRAIN_COLORS: Readonly<Record<Terrain, number>> = { grass: 0x4f9a3d, tilled: 0x7a4a26 };
const ITEM_COLORS: Readonly<Record<string, number>> = { hay: 0xd8e06b, wheat: 0xf2c14e };

interface PlantView {
  readonly key: string;
  readonly mesh: THREE.Mesh;
  /** Seconds since it appeared, while it is still popping into place. */
  age: number | null;
}

interface Particle {
  readonly mesh: THREE.Mesh;
  readonly velocity: THREE.Vector3;
  life: number;
}

/** What the scene shows, in plain values, so it can be checked without looking at any 3D object. */
export interface SceneSnapshot {
  readonly terrain: readonly Terrain[];
  readonly plants: readonly ({ species: PlantSpecies; stage: GrowthStage } | null)[];
  readonly drone: Position;
}

export class FarmScene {
  readonly root = new THREE.Group();
  readonly width: number;
  readonly height: number;
  private readonly models: PlantModels;
  private readonly tiles: THREE.InstancedMesh;
  private readonly terrain: Terrain[];
  private readonly plantViews = new Map<number, PlantView>();
  private readonly plantGeometries = new Map<string, THREE.BufferGeometry>();
  private readonly plantMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly justPlanted = new Set<number>();
  private readonly particles: Particle[] = [];
  private readonly particleGeometry = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  private readonly particleMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly drone = new THREE.Group();
  private readonly rotors: THREE.Mesh[] = [];
  /** A ring on the ground under the drone: on a big field the drone alone is a speck. */
  private readonly marker: THREE.Mesh;
  private readonly droneScale: number;
  private readonly dronePosition = new THREE.Vector3();
  private droneTarget: Position = { x: 0, y: 0 };
  private droneKnown = false;
  private shake = 0;
  private time = 0;

  constructor(width: number, height: number, models: PlantModels = DEFAULT_MODELS) {
    this.width = width;
    this.height = height;
    this.models = models;
    this.terrain = Array.from({ length: width * height }, () => 'grass');

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.5, 0.3, height + 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2a2018 }),
    );
    base.position.y = -TILE_THICKNESS - 0.15;
    this.root.add(base);

    this.tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(TILE_SIZE, TILE_THICKNESS, TILE_SIZE),
      new THREE.MeshLambertMaterial(),
      width * height,
    );
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < width * height; index++) {
      const { x, z } = this.worldOf({ x: index % width, y: Math.floor(index / width) });
      matrix.makeTranslation(x, -TILE_THICKNESS / 2, z);
      this.tiles.setMatrixAt(index, matrix);
      this.paintTile(index);
    }
    this.root.add(this.tiles);

    this.droneScale = Math.min(1.8, Math.max(0.7, Math.max(width, height) / 22));
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.48, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1d6fd6, transparent: true, opacity: 0.9 }),
    );
    this.marker.name = 'drone-marker';
    this.marker.scale.setScalar(this.droneScale);
    this.root.add(this.marker);

    this.buildDrone();
    this.root.add(this.drone);
  }

  /** Where the middle of a cell is in the scene. The y axis of the farm runs south, towards the viewer. */
  worldOf(cell: Position): { x: number; z: number } {
    return { x: cell.x - (this.width - 1) / 2, z: cell.y - (this.height - 1) / 2 };
  }

  private indexOf(cell: Position): number {
    return cell.y * this.width + cell.x;
  }

  /** The two shades of a field cell alternate like a chess board, so every cell can be told from its neighbours. */
  private paintTile(index: number): void {
    const color = new THREE.Color(TERRAIN_COLORS[this.terrain[index] ?? 'grass']);
    const odd = ((index % this.width) + Math.floor(index / this.width)) % 2 === 1;
    this.tiles.setColorAt(index, odd ? color.multiplyScalar(0.86) : color);
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  private buildDrone(): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0xe8eef4 }));
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), new THREE.MeshLambertMaterial({ color: 0x1d6fd6 }));
    eye.position.set(0, 0, 0.18);
    this.drone.add(body, eye);
    for (const [x, z] of [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ] as const) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: 0x9aa7b4 }));
      arm.position.set(x * 0.7, 0.02, z * 0.7);
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12),
        new THREE.MeshLambertMaterial({ color: 0x3a4652 }),
      );
      rotor.position.set(x, 0.07, z);
      this.rotors.push(rotor);
      this.drone.add(arm, rotor);
    }
    this.drone.position.y = DRONE_HEIGHT;
    // Small enough not to hide the plant it is working on, but not a speck on a big field.
    this.drone.scale.setScalar(this.droneScale);
  }

  private plantGeometry(species: PlantSpecies, stage: GrowthStage): THREE.BufferGeometry {
    const key = `${species}:${stage}`;
    let geometry = this.plantGeometries.get(key);
    if (!geometry) {
      geometry = bake(this.models[species](stage));
      this.plantGeometries.set(key, geometry);
    }
    return geometry;
  }

  /** Brings the scene to what the state says: the terrain, the plants (each at its growth stage) and the drone. */
  sync(state: FarmState): void {
    const { cells, width, height } = state.field;
    if (width !== this.width || height !== this.height) throw new Error('The scene and the state have different fields');

    cells.forEach((cell, index) => {
      if (this.terrain[index] !== cell.terrain) {
        this.terrain[index] = cell.terrain;
        this.paintTile(index);
      }
      const view = this.plantViews.get(index);
      if (!cell.plant) {
        if (view) this.removePlant(index, view);
        return;
      }
      const key = `${cell.plant.species}:${cell.plant.stage}`;
      if (view?.key === key) return;
      const popping = this.justPlanted.has(index) && !view;
      if (view) this.removePlant(index, view);
      const mesh = new THREE.Mesh(this.plantGeometry(cell.plant.species, cell.plant.stage), this.plantMaterial);
      const { x, z } = this.worldOf({ x: index % this.width, y: Math.floor(index / this.width) });
      mesh.position.set(x, 0, z);
      if (popping) mesh.scale.setScalar(0.01);
      this.root.add(mesh);
      this.plantViews.set(index, { key, mesh, age: popping ? 0 : null });
    });
    this.justPlanted.clear();

    this.droneTarget = state.drone;
    if (!this.droneKnown) {
      const { x, z } = this.worldOf(state.drone);
      this.dronePosition.set(x, 0, z);
      this.droneKnown = true;
    }
  }

  private removePlant(index: number, view: PlantView): void {
    this.root.remove(view.mesh);
    this.plantViews.delete(index);
  }

  /** Plays the flourish that goes with each event. What the farm looks like comes from `sync`, never from here. */
  handle(events: readonly FarmEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'planted':
          this.justPlanted.add(this.indexOf(event.at));
          break;
        case 'harvested':
          this.burst(event.at, ITEM_COLORS[event.item] ?? 0xffffff, 8);
          break;
        case 'destroyed':
          this.burst(event.at, 0x8a8a8a, 6);
          break;
        case 'tilled':
          this.burst(event.at, 0x8a5a33, 5);
          break;
        case 'bumped':
        case 'rejected':
          this.shake = 0.35;
          break;
        default:
          break;
      }
    }
  }

  private burst(at: Position, color: number, count: number): void {
    let material = this.particleMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color });
      this.particleMaterials.set(color, material);
    }
    const { x, z } = this.worldOf(at);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(x, 0.2, z);
      const angle = (i / count) * Math.PI * 2;
      this.particles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * 0.5, 1.6 + (i % 3) * 0.3, Math.sin(angle) * 0.5), life: 0.7 });
      this.root.add(mesh);
    }
  }

  /** Moves the animations on by `seconds`. Purely visual: the drone glides, plants pop, dust rises. */
  update(seconds: number): void {
    this.time += seconds;
    const glide = 1 - Math.exp(-seconds * 14);
    const target = this.worldOf(this.droneTarget);
    this.dronePosition.x += (target.x - this.dronePosition.x) * glide;
    this.dronePosition.z += (target.z - this.dronePosition.z) * glide;
    this.shake = Math.max(0, this.shake - seconds);
    this.drone.position.set(
      this.dronePosition.x + Math.sin(this.time * 70) * this.shake * 0.12,
      DRONE_HEIGHT + Math.sin(this.time * 4) * 0.03,
      this.dronePosition.z,
    );
    this.marker.position.set(this.dronePosition.x, 0.03, this.dronePosition.z);
    for (const rotor of this.rotors) rotor.rotation.y += seconds * 40;

    for (const view of this.plantViews.values()) {
      if (view.age === null) continue;
      view.age += seconds;
      const t = Math.min(1, view.age / 0.3);
      // An ease-out with a small overshoot, so the plant seems to pop out of the soil.
      const scale = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
      view.mesh.scale.setScalar(Math.max(0.01, scale));
      if (t >= 1) {
        view.mesh.scale.setScalar(1);
        view.age = null;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= seconds;
      if (particle.life <= 0) {
        this.root.remove(particle.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      particle.velocity.y -= 5 * seconds;
      particle.mesh.position.addScaledVector(particle.velocity, seconds);
      particle.mesh.scale.setScalar(Math.max(0.1, particle.life / 0.7));
    }
  }

  /** What the scene shows right now, in plain values. */
  snapshot(): SceneSnapshot {
    const plants = Array.from({ length: this.width * this.height }, (_, index) => {
      const key = this.plantViews.get(index)?.key;
      if (!key) return null;
      const [species, stage] = key.split(':') as [PlantSpecies, GrowthStage];
      return { species, stage };
    });
    return { terrain: [...this.terrain], plants, drone: this.droneTarget };
  }

  /** How many things are on screen, for the performance checks. */
  stats(): { plants: number; particles: number; objects: number; droneScale: number } {
    return {
      plants: this.plantViews.size,
      particles: this.particles.length,
      objects: this.root.children.length,
      droneScale: this.droneScale,
    };
  }

  /** The colour of a field cell, to check that neighbouring cells can be told apart. */
  tileColor(cell: Position): THREE.Color {
    const color = new THREE.Color();
    this.tiles.getColorAt(this.indexOf(cell), color);
    return color;
  }

  /** The baked shape the scene uses for a plant, to check that every species and stage looks different. */
  shapeOf(species: PlantSpecies, stage: GrowthStage): THREE.BufferGeometry {
    return this.plantGeometry(species, stage);
  }

  dispose(): void {
    this.tiles.geometry.dispose();
    for (const geometry of this.plantGeometries.values()) geometry.dispose();
    this.plantMaterial.dispose();
    this.particleGeometry.dispose();
  }
}

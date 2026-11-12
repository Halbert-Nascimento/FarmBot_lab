import * as THREE from 'three';
import type { FarmEvent, FarmState, GrowthStage, Item, PlantSpecies, Position, Terrain } from '../engine';
import { bake, DEFAULT_MODELS } from './models';
import type { MadePlant } from './stress';
import type { PlantModels } from './models';

/**
 * The farm as a Three.js scene graph. It has no renderer and no canvas, and its only clock is the one that
 * paces its animations (`update`), so it runs (and is tested) anywhere. It only READS what the engine hands out: `sync` brings it to a state, `handle`
 * plays the little flourishes that go with the events, and `update` moves time on for the animations.
 * Nothing here decides anything about the farm, and nothing here can change it.
 */

const TILE_SIZE = 0.94;
const TILE_THICKNESS = 0.2;
const DRONE_HEIGHT = 0.75;
const MAX_PARTICLES = 160;

const TERRAIN_COLORS: Readonly<Record<Terrain, number>> = { grass: 0x4f9a3d, tilled: 0x7a4a26 };
const ITEM_COLORS: Readonly<Record<Item, number>> = { hay: 0xd8e06b, wheat: 0xf2c14e };

interface PlantView {
  readonly species: PlantSpecies;
  readonly stage: GrowthStage;
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
  /** Every part of the drone, to make it see-through when it is over a plant. */
  private readonly droneMaterials: THREE.MeshLambertMaterial[] = [];
  private droneOpacity = 1;
  /** Plants that are only drawn (the stress field). They are not on the farm and the engine knows nothing of them. */
  private readonly madePlants = new Map<number, THREE.Mesh>();
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
      const { x, z } = this.worldOf(this.positionOf(index));
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

  private positionOf(index: number): Position {
    return { x: index % this.width, y: Math.floor(index / this.width) };
  }

  /** The two shades of a field cell alternate like a chess board, so every cell can be told from its neighbours. */
  private paintTile(index: number): void {
    const color = new THREE.Color(TERRAIN_COLORS[this.terrain[index] ?? 'grass']);
    const { x, y } = this.positionOf(index);
    const odd = (x + y) % 2 === 1;
    this.tiles.setColorAt(index, odd ? color.multiplyScalar(0.86) : color);
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  private buildDrone(): void {
    const solid = (color: number): THREE.MeshLambertMaterial => {
      const made = new THREE.MeshLambertMaterial({ color, transparent: true });
      this.droneMaterials.push(made);
      return made;
    };
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), solid(0xe8eef4));
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), solid(0x1d6fd6));
    eye.position.set(0, 0, 0.18);
    this.drone.add(body, eye);
    for (const [x, z] of [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ] as const) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), solid(0x9aa7b4));
      arm.position.set(x * 0.7, 0.02, z * 0.7);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12), solid(0x3a4652));
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
      const { species, stage } = cell.plant;
      if (view?.species === species && view.stage === stage) return;
      const popping = this.justPlanted.has(index) && !view;
      if (view) this.removePlant(index, view);
      const mesh = new THREE.Mesh(this.plantGeometry(species, stage), this.plantMaterial);
      const { x, z } = this.worldOf(this.positionOf(index));
      mesh.position.set(x, 0, z);
      if (popping) mesh.scale.setScalar(0.01);
      this.root.add(mesh);
      this.plantViews.set(index, { species, stage, mesh, age: popping ? 0 : null });
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
          this.burst(event.at, ITEM_COLORS[event.item], 8);
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

    // Over a plant (a real one or a made-up one) the drone turns see-through, so the plant can be seen.
    const cell = this.indexOf(this.droneTarget);
    const covered = this.plantViews.has(cell) || this.madePlants.has(cell);
    this.droneOpacity += ((covered ? 0.4 : 1) - this.droneOpacity) * (1 - Math.exp(-seconds * 10));
    for (const material of this.droneMaterials) material.opacity = this.droneOpacity;

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
      const view = this.plantViews.get(index);
      return view ? { species: view.species, stage: view.stage } : null;
    });
    return { terrain: [...this.terrain], plants, drone: this.droneTarget };
  }

  /** How many things are on screen, for the performance checks. */
  stats(): { plants: number; madeUpPlants: number; particles: number; objects: number; droneScale: number; droneOpacity: number } {
    return {
      plants: this.plantViews.size,
      madeUpPlants: this.madePlants.size,
      droneOpacity: this.droneOpacity,
      particles: this.particles.length,
      objects: this.root.children.length,
      droneScale: this.droneScale,
    };
  }

  /** Where the drone is in the scene, as it glides: for a camera that follows it. */
  droneWorld(): { x: number; z: number } {
    return { x: this.dronePosition.x, z: this.dronePosition.z };
  }

  /**
   * Draws plants that are NOT on the farm (the stress field), one for every cell. The engine never hears
   * of them. Wheat gets tilled soil under it, like on the real farm. They stay until `clearMadeUpPlants`.
   */
  showMadeUpPlants(plants: readonly (MadePlant | null)[]): void {
    if (plants.length !== this.width * this.height) throw new Error('The pattern and the scene have different fields');
    this.clearMadeUpPlants();
    plants.forEach((plant, index) => {
      if (!plant) return;
      const mesh = new THREE.Mesh(this.plantGeometry(plant.species, plant.stage), this.plantMaterial);
      const { x, z } = this.worldOf(this.positionOf(index));
      mesh.position.set(x, 0, z);
      this.root.add(mesh);
      this.madePlants.set(index, mesh);
      if (plant.species === 'wheat' && this.terrain[index] !== 'tilled') {
        this.terrain[index] = 'tilled';
        this.paintTile(index);
      }
    });
  }

  /** Takes the made-up plants away. The next `sync` puts the soil back as the farm has it. */
  clearMadeUpPlants(): void {
    for (const mesh of this.madePlants.values()) this.root.remove(mesh);
    this.madePlants.clear();
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

  /** Lets go of everything the scene made on the graphics card. Safe to call more than once. */
  dispose(): void {
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      (object.geometry as THREE.BufferGeometry).dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    for (const geometry of this.plantGeometries.values()) geometry.dispose();
    this.plantGeometries.clear();
    this.plantMaterial.dispose();
    this.particleGeometry.dispose();
    for (const material of this.particleMaterials.values()) material.dispose();
    this.root.clear();
    this.plantViews.clear();
    this.madePlants.clear();
    this.particles.length = 0;
  }
}

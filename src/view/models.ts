import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GrowthStage, PlantSpecies } from '../engine';

/**
 * How a plant looks. A model only draws a shape for a species at a growth stage: it knows nothing about
 * how plants grow, what they cost or when they are ready. The engine decides that; the scene asks for the
 * shape that matches. Swapping a model changes what is on screen and nothing else.
 */
export type PlantModel = (stage: GrowthStage) => THREE.Object3D;

export type PlantModels = Readonly<Record<PlantSpecies, PlantModel>>;

function material(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** A thin pointed leaf standing in the cell at (x, z), leaning outwards by `lean` radians. */
function blade(x: number, z: number, height: number, width: number, color: number, lean = 0.12): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(width, height, 4);
  geometry.translate(0, height / 2, 0);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, 0, z);
  mesh.rotation.set(Math.sin(z * 9) * lean, 0, -Math.sin(x * 9) * lean);
  return mesh;
}

/** A straight stalk of wheat. */
function stalk(x: number, z: number, height: number, color: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.022, 0.032, height, 6);
  geometry.translate(0, height / 2, 0);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, 0, z);
  return mesh;
}

/** The ear of wheat on top of a stalk. */
function ear(x: number, z: number, height: number, color: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.065, 7, 6);
  geometry.scale(0.85, 2.6, 0.85);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, height + 0.07, z);
  return mesh;
}

/** Points spread in a ring-and-center pattern inside the cell, the same for every plant so models stay comparable. */
function spots(count: number, radius: number): [number, number][] {
  const points: [number, number][] = [[0, 0]];
  for (let i = 1; i < count; i++) {
    const angle = (i / (count - 1)) * Math.PI * 2 + 0.4;
    const ring = i % 2 === 0 ? radius : radius * 0.55;
    points.push([Math.cos(angle) * ring, Math.sin(angle) * ring]);
  }
  return points.slice(0, count);
}

const GRASS = {
  sprout: { count: 3, height: 0.14, width: 0.025, color: 0xa8e08a },
  growing: { count: 7, height: 0.34, width: 0.035, color: 0x5fbf4a },
  ready: { count: 13, height: 0.6, width: 0.04, color: 0x2a9d3f },
} as const;

function grass(stage: GrowthStage): THREE.Object3D {
  const { count, height, width, color } = GRASS[stage];
  const group = new THREE.Group();
  spots(count, 0.3).forEach(([x, z], index) => {
    group.add(blade(x, z, height * (0.8 + (index % 3) * 0.15), width, color));
  });
  return group;
}

function wheat(stage: GrowthStage): THREE.Object3D {
  const group = new THREE.Group();
  if (stage === 'sprout') {
    // Two small leaves in a V, paler than the grass.
    group.add(blade(-0.05, 0, 0.12, 0.022, 0xc3e36b, 0.5));
    group.add(blade(0.05, 0, 0.12, 0.022, 0xc3e36b, -0.5));
    return group;
  }
  const height = stage === 'growing' ? 0.5 : 0.66;
  const stalkColor = stage === 'growing' ? 0x9bc53d : 0xd9a520;
  spots(9, 0.3).forEach(([x, z], index) => {
    const stalkHeight = height * (0.9 + (index % 2) * 0.1);
    group.add(stalk(x, z, stalkHeight, stalkColor));
    if (stage === 'ready') group.add(ear(x, z, stalkHeight, 0xf2c14e));
  });
  return group;
}

export const DEFAULT_MODELS: PlantModels = { grass, wheat };

/**
 * Turns a model into one single geometry, coloured per vertex, so a whole field of plants costs one
 * draw call per plant and nothing more. Each part keeps the colour of its material.
 */
export function bake(object: THREE.Object3D): THREE.BufferGeometry {
  object.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const part = (child.geometry as THREE.BufferGeometry).clone().toNonIndexed();
    part.applyMatrix4(child.matrixWorld);
    part.deleteAttribute('uv');
    const { color } = child.material as THREE.MeshLambertMaterial;
    const colors = new Float32Array(part.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(part);
  });
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('A plant model must contain at least one mesh');
  return merged;
}

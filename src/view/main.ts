import * as THREE from 'three';
import { createFarm } from '../engine';
import { DEMOS } from './demos';
import { FarmScene } from './farm-scene';
import { Player } from './player';
import type { Speed } from './player';

/**
 * The disposable prototype page: it plays an example script on a field and draws it. It decides nothing about the
 * farm. The camera is a stand-in until the camera decision (issues 13 and 14). Everything is set by the address, e.g.
 * ?w=16&h=16&demo=sweep&speed=16 , and `paused` keeps it still so a tester can advance it by hand.
 */
const params = new URLSearchParams(window.location.search);
const width = Number(params.get('w') ?? 3);
const height = Number(params.get('h') ?? 2);
const demo = params.get('demo') ?? (width === 3 && height === 2 ? 'garden' : 'sweep');
const speedParam = params.get('speed') ?? '1';
const requestedSpeed = Number(speedParam);
// An address with a speed that makes no sense plays at the normal speed.
const speed: Speed = speedParam === 'instant' ? 'instant' : Number.isFinite(requestedSpeed) && requestedSpeed > 0 ? requestedSpeed : 1;

const farm = createFarm({ width, height, seed: Number(params.get('seed') ?? 1) });
const scene = new FarmScene(width, height);
const player = new Player(farm, farm.run(DEMOS[demo] ?? DEMOS['sweep'] ?? ''), scene);
player.speed = speed;

const app = document.querySelector<HTMLDivElement>('#app');
const hud = document.createElement('div');
hud.id = 'hud';
app?.append(hud);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app?.append(renderer.domElement);

const three = new THREE.Scene();
three.background = new THREE.Color(0xa9cfe6);
three.add(new THREE.HemisphereLight(0xffffff, 0x556644, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(5, 12, 7);
three.add(sun);
three.add(scene.root);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
const ELEVATION = (52 * Math.PI) / 180;

/** Backs the camera off just enough for the whole field, tall plants included, to fit in the window. */
function frameField(): void {
  const corners = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [0, 0.9].map((y) => new THREE.Vector3((sx * (width + 0.5)) / 2, y, (sz * (height + 0.5)) / 2))));
  for (let distance = 4; distance < 400; distance *= 1.02) {
    camera.position.set(0, Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const inside = corners.every((corner) => {
      const projected = corner.clone().project(camera);
      return Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.88;
    });
    if (inside) return;
  }
}
function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  frameField();
}
resize();
window.addEventListener('resize', resize);

const frameTimes: number[] = [];
let last = performance.now();

function drawHud(): void {
  const state = farm.getState();
  const speedText = player.speed === 'instant' ? 'instant' : `${player.speed}x`;
  const error = player.error instanceof Error ? player.error.message : '';
  hud.textContent = `tick ${state.tick.toFixed(1)} | ${speedText} | hay ${state.stock.hay} | wheat ${state.stock.wheat}${player.isFinished ? ' | done' : ''}${error ? `\n${error}` : ''}`;
}

function frame(now: number): void {
  const seconds = Math.min(0.1, (now - last) / 1000);
  frameTimes.push(now - last);
  if (frameTimes.length > 240) frameTimes.shift();
  last = now;
  if (!params.has('paused')) player.advance(seconds);
  scene.update(seconds);
  renderer.render(three, camera);
  drawHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** A handle for whoever tests the page by hand or by script: it advances the engine, never changes its rules. */
Object.assign(window, {
  __farmbot: {
    advanceTicks: (ticks: number) => player.advanceTicks(ticks),
    snapshot: () => scene.snapshot(),
    stats: () => ({ ...scene.stats(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    frameTimes: () => [...frameTimes],
    hash: () => farm.getStateHash(),
    state: () => farm.getState(),
    error: () => (player.error instanceof Error ? player.error.message : null),
    finished: () => player.isFinished,
    /** How long it takes to read the engine state and bring the whole scene to it, in milliseconds. */
    syncCost: () => {
      const runs = 100;
      const start = performance.now();
      for (let i = 0; i < runs; i++) scene.sync(farm.getState());
      return { runs, meanMs: (performance.now() - start) / runs };
    },
  },
});

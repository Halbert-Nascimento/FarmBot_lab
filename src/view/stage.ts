import * as THREE from 'three';
import type { FarmScene } from './farm-scene';

/** Where the scene is drawn: the renderer, the lights and a camera. It draws what it is given and decides nothing. */
export interface Stage {
  render(): void;
  /** What the last frame cost the graphics card, for the performance checks. */
  stats(): { calls: number; triangles: number };
}

const ELEVATION = (52 * Math.PI) / 180;

/**
 * Draws a farm scene inside `container`, following its size. The camera is a stand-in that only frames the
 * whole field: which camera the game uses is decided in issues 13 and 14.
 */
export function createStage(container: HTMLElement, scene: FarmScene): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);

  const three = new THREE.Scene();
  three.background = new THREE.Color(0xa9cfe6);
  three.add(new THREE.HemisphereLight(0xffffff, 0x556644, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(5, 12, 7);
  three.add(sun);
  three.add(scene.root);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [0, 0.9].map((y) => new THREE.Vector3((sx * (scene.width + 0.5)) / 2, y, (sz * (scene.height + 0.5)) / 2))),
  );

  /** Backs the camera off just enough for the whole field, tall plants included, to fit. */
  function frameField(): void {
    for (let distance = 4; distance < 400; distance *= 1.02) {
      camera.position.set(0, Math.sin(ELEVATION) * distance, Math.cos(ELEVATION) * distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const inside = corners.every((corner) => {
        const projected = corner.clone().project(camera);
        return Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.88;
      });
      if (inside) return;
    }
  }

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frameField();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  return {
    render: () => renderer.render(three, camera),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  };
}

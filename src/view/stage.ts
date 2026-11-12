import * as THREE from 'three';
import type { CameraController } from './camera-controller';
import type { FarmScene } from './farm-scene';

/** Where the scene is drawn: the renderer, the lights and the mouse. It draws what it is given and decides nothing. */
export interface Stage {
  render(): void;
  /** What the last frame cost the graphics card, for the performance checks. */
  stats(): { calls: number; triangles: number };
}

/**
 * Draws a farm scene inside `container`, following its size, through the camera of `cameras`. The mouse moves
 * the camera: the wheel zooms, the left button turns and the right button moves (the isometric camera only
 * zooms). Which camera the game uses is decided in issues 14 and 15.
 */
export function createStage(container: HTMLElement, scene: FarmScene, cameras: CameraController): Stage {
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

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    cameras.resize(width, height);
  }
  resize();
  new ResizeObserver(resize).observe(container);

  const canvas = renderer.domElement;
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cameras.zoomBy(event.deltaY);
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  let dragging: { pointer: number; button: number; x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    dragging = { pointer: event.pointerId, button: event.button, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || dragging.pointer !== event.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    if (dragging.button === 0) cameras.rotate(dx, dy);
    else cameras.pan(dx, dy);
  });
  const stopDragging = (event: PointerEvent): void => {
    if (dragging?.pointer === event.pointerId) dragging = undefined;
  };
  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);

  return {
    render: () => renderer.render(three, cameras.camera),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  };
}

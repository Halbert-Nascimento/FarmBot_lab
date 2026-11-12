import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraController, wheelPixels, ZOOM_MAX, ZOOM_MIN } from './camera-controller';
import type { CameraKind } from './camera-controller';

const KINDS: CameraKind[] = ['isometric', 'perspective'];
const SIZES: [number, number][] = [
  [3, 2],
  [16, 16],
  [32, 32],
];
const FRAME = 1 / 60;

function ready(width: number, height: number, kind: CameraKind = 'perspective', aspect = 1.6) {
  const controller = new CameraController(width, height);
  controller.resize(800 * aspect, 800);
  if (controller.kind !== kind) controller.toggleKind();
  controller.update(FRAME, { x: 0, z: 0 });
  return controller;
}

/** Where the corners of the field (plants included) land on the screen: -1 to 1 is inside. */
function cornersOnScreen(controller: CameraController, width: number, height: number) {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [0, 0.9].map((y) => controller.project(new THREE.Vector3((sx * width) / 2, y, (sz * height) / 2)))),
  );
}

describe('the two cameras frame the whole field', () => {
  it.each(KINDS.flatMap((kind) => SIZES.map(([w, h]) => [kind, w, h] as const)))('%s camera, %ix%i field', (kind, width, height) => {
    const controller = ready(width, height, kind);

    for (const corner of cornersOnScreen(controller, width, height)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
    }
  });

  it.each(KINDS)('%s camera, in a narrow and in a wide window', (kind) => {
    for (const aspect of [0.5, 1, 2.4]) {
      const controller = ready(16, 16, kind, aspect);
      for (const corner of cornersOnScreen(controller, 16, 16)) {
        expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the two cameras show the same world, the same way round', () => {
  it.each(KINDS)('%s: north is at the back of the screen and east is on the right', (kind) => {
    const controller = ready(8, 8, kind);
    const centre = controller.project(new THREE.Vector3(0, 0, 0));
    const north = controller.project(new THREE.Vector3(0, 0, -3));
    const south = controller.project(new THREE.Vector3(0, 0, 3));
    const east = controller.project(new THREE.Vector3(3, 0, 0));
    const west = controller.project(new THREE.Vector3(-3, 0, 0));

    expect(north.y).toBeGreaterThan(centre.y);
    expect(south.y).toBeLessThan(centre.y);
    expect(east.x).toBeGreaterThan(centre.x);
    expect(west.x).toBeLessThan(centre.x);
  });

  it('both open looking at the field from the same side and with the same elevation', () => {
    const perspective = ready(8, 8, 'perspective');
    const isometric = ready(8, 8, 'isometric');

    expect(isometric.stats().yaw).toBeCloseTo(perspective.stats().yaw, 6);
    expect(isometric.stats().pitch).toBeCloseTo(perspective.stats().pitch, 6);
  });
});

describe('switching cameras', () => {
  it('keeps the zoom, the following and the point looked at, and only changes the camera', () => {
    const controller = ready(32, 32);
    controller.setZoom(4);
    controller.setFollow(true);
    for (let i = 0; i < 180; i++) controller.update(FRAME, { x: 6, z: -4 });
    const before = controller.stats();
    controller.toggleKind();
    controller.update(FRAME, { x: 6, z: -4 });
    const after = controller.stats();

    expect(after.kind).toBe('isometric');
    expect(after.zoom).toBe(before.zoom);
    expect(after.follow).toBe(true);
    expect(after.targetX).toBeCloseTo(before.targetX, 1);
    expect(after.targetZ).toBeCloseTo(before.targetZ, 1);
  });

  it('keeps what each camera has of its own: the perspective remembers its rotation', () => {
    const controller = ready(8, 8);
    controller.rotate(100, 40);
    const rotated = controller.stats();
    controller.toggleKind();
    controller.toggleKind();

    expect(controller.stats().yaw).toBe(rotated.yaw);
    expect(controller.stats().pitch).toBe(rotated.pitch);
  });

  it('answers with the camera that is on', () => {
    const controller = ready(8, 8);

    expect(controller.camera).toBe(controller.perspective);
    controller.toggleKind();
    expect(controller.camera).toBe(controller.orthographic);
    expect(controller.orthographic).toBeInstanceOf(THREE.OrthographicCamera);
  });
});

describe('zoom', () => {
  it.each(KINDS)('%s: the wheel zooms in and out, between the limits', (kind) => {
    const controller = ready(16, 16, kind);

    controller.zoomBy(-300);
    expect(controller.stats().zoom).toBeGreaterThan(ZOOM_MIN);
    const zoomedIn = controller.stats().zoom;
    controller.zoomBy(300);
    expect(controller.stats().zoom).toBeLessThan(zoomedIn);
    for (let i = 0; i < 100; i++) controller.zoomBy(-500);
    expect(controller.stats().zoom).toBe(ZOOM_MAX);
    for (let i = 0; i < 200; i++) controller.zoomBy(500);
    expect(controller.stats().zoom).toBe(ZOOM_MIN);
  });

  it.each(KINDS)('%s: zooming in really shows less of the field', (kind) => {
    const controller = ready(16, 16, kind);
    const wide = Math.abs(controller.project(new THREE.Vector3(8, 0, 0)).x);
    controller.setZoom(4);
    controller.update(FRAME, { x: 0, z: 0 });

    expect(Math.abs(controller.project(new THREE.Vector3(8, 0, 0)).x)).toBeGreaterThan(wide * 2);
  });

  it('refuses a zoom that makes no sense', () => {
    const controller = ready(8, 8);
    controller.setZoom(Number.NaN);
    controller.zoomBy(Number.NaN);

    expect(controller.stats().zoom).toBe(ZOOM_MIN);
  });
});

describe('the controls of each camera', () => {
  it('the isometric camera only zooms: dragging changes nothing', () => {
    const controller = ready(16, 16, 'isometric');
    const before = controller.stats();

    expect(controller.rotate(80, 30)).toBe(false);
    expect(controller.pan(50, 50)).toBe(false);
    expect(controller.stats()).toEqual(before);
  });

  it('the perspective camera turns with the drag, and cannot go under the ground or over the top', () => {
    const controller = ready(16, 16);
    const start = controller.stats();
    expect(controller.rotate(100, 0)).toBe(true);
    expect(controller.stats().yaw).not.toBe(start.yaw);
    controller.rotate(0, -100_000);
    expect(controller.stats().pitch).toBeGreaterThan(0.2);
    controller.rotate(0, 100_000);
    expect(controller.stats().pitch).toBeLessThan(Math.PI / 2);
  });

  it('the perspective camera moves with the right button once zoomed in, and never leaves the field', () => {
    const controller = ready(16, 16);
    controller.setZoom(4);
    expect(controller.pan(-200, 0)).toBe(true);
    for (let i = 0; i < 240; i++) controller.update(FRAME, { x: 0, z: 0 });

    expect(controller.stats().targetX).toBeGreaterThan(0.5);
    controller.pan(-1_000_000, 0);
    for (let i = 0; i < 240; i++) controller.update(FRAME, { x: 0, z: 0 });
    expect(Math.abs(controller.stats().targetX)).toBeLessThanOrEqual(8);
  });

  it('with the whole field in view there is nothing to move: the camera stays on the middle', () => {
    const controller = ready(16, 16);
    controller.pan(-300, 200);
    for (let i = 0; i < 120; i++) controller.update(FRAME, { x: 5, z: 5 });

    expect(controller.stats().targetX).toBeCloseTo(0, 3);
    expect(controller.stats().targetZ).toBeCloseTo(0, 3);
  });
});

describe('the pan', () => {
  it('stores nothing while the whole field is in view, so zooming in later does not make the camera jump', () => {
    const controller = ready(16, 16);
    controller.pan(-300, 200);
    controller.setZoom(4);
    for (let i = 0; i < 240; i++) controller.update(FRAME, { x: 0, z: 0 });

    expect(controller.stats().targetX).toBeCloseTo(0, 3);
    expect(controller.stats().targetZ).toBeCloseTo(0, 3);
  });

  it('stops at the edge of what can be seen, and answers at once when dragged back', () => {
    const controller = ready(16, 16);
    controller.setZoom(4);
    controller.pan(-1_000_000, 0);
    for (let i = 0; i < 60; i++) controller.update(FRAME, { x: 0, z: 0 });
    const edge = controller.stats().targetX;
    controller.pan(100, 0);
    for (let i = 0; i < 2; i++) controller.update(FRAME, { x: 0, z: 0 });

    expect(edge).toBeCloseTo(8 * (1 - 1 / 4), 3);
    expect(controller.stats().targetX).toBeLessThan(edge - 0.2);
  });
});

describe('the mouse wheel in any browser', () => {
  it('counts a wheel that reports lines or pages as the pixels it stands for', () => {
    expect(wheelPixels(5, 0)).toBe(5);
    expect(wheelPixels(3, 1)).toBeGreaterThan(60);
    expect(wheelPixels(1, 2)).toBeGreaterThan(300);
  });

  it('refuses a number that makes no sense', () => {
    expect(wheelPixels(Number.NaN, 0)).toBe(0);
  });
});

describe('the camera the game opens with', () => {
  it('is the isometric one, at 50 degrees, looking from the south, and not following the drone', () => {
    const controller = new CameraController(16, 16);
    controller.resize(1000, 700);
    const start = controller.stats();

    expect(start.kind).toBe('isometric');
    expect(controller.camera).toBe(controller.orthographic);
    expect(start.yaw).toBe(0);
    expect(start.pitch).toBeCloseTo((50 * Math.PI) / 180, 6);
    expect(start.follow).toBe(false);
  });

  it('keeps its angle however the window changes', () => {
    const controller = ready(16, 16, 'isometric');
    controller.resize(300, 900);

    expect(controller.stats().yaw).toBe(0);
    expect(controller.stats().pitch).toBeCloseTo((50 * Math.PI) / 180, 6);
  });
});

describe('restoring the perspective camera', () => {
  it('brings back the turn, the elevation and the move, and keeps the zoom the player chose', () => {
    const controller = ready(16, 16);
    const start = controller.stats();
    controller.setZoom(4);
    controller.rotate(120, 60);
    controller.pan(-300, 100);
    for (let i = 0; i < 120; i++) controller.update(FRAME, { x: 0, z: 0 });
    expect(controller.stats().yaw).not.toBe(start.yaw);
    expect(controller.stats().targetX).not.toBeCloseTo(0, 1);

    expect(controller.resetOrientation()).toBe(true);
    for (let i = 0; i < 120; i++) controller.update(FRAME, { x: 0, z: 0 });
    const after = controller.stats();

    expect(after.yaw).toBe(start.yaw);
    expect(after.pitch).toBeCloseTo(start.pitch, 6);
    expect(after.targetX).toBeCloseTo(0, 3);
    expect(after.targetZ).toBeCloseTo(0, 3);
    expect(after.zoom).toBe(4);
    expect(after.kind).toBe('perspective');
  });

  it('does not touch following, and does not pull the camera off the drone it follows', () => {
    const controller = ready(32, 32);
    controller.setZoom(4);
    controller.setFollow(true);
    for (let i = 0; i < 240; i++) controller.update(FRAME, { x: 6, z: -4 });
    controller.rotate(90, 20);
    const followed = controller.stats();
    controller.resetOrientation();
    controller.update(FRAME, { x: 6, z: -4 });

    expect(controller.stats().follow).toBe(true);
    expect(controller.stats().targetX).toBeCloseTo(followed.targetX, 1);
    expect(controller.stats().targetZ).toBeCloseTo(followed.targetZ, 1);
  });

  it('puts the whole field back in view at zoom 1 after a turn that had pushed it off the screen', () => {
    const controller = ready(16, 16);
    controller.rotate(400, 150);
    controller.resetOrientation();
    controller.update(FRAME, { x: 0, z: 0 });

    for (const corner of cornersOnScreen(controller, 16, 16)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
    }
  });

  it('has nothing to do on the isometric camera, which never turns', () => {
    const controller = ready(16, 16, 'isometric');
    const before = controller.stats();

    expect(controller.resetOrientation()).toBe(false);
    expect(controller.stats()).toEqual(before);
  });

  it('is only there while the perspective camera is on', () => {
    const controller = ready(16, 16, 'isometric');
    expect(controller.canRestoreOrientation()).toBe(false);
    controller.toggleKind();
    expect(controller.canRestoreOrientation()).toBe(true);
  });
});

describe('following the drone', () => {
  it.each(KINDS)('%s: with the whole field in view, following does not push the field off the screen', (kind) => {
    const controller = ready(32, 32, kind);
    controller.setFollow(true);
    for (let i = 0; i < 240; i++) controller.update(FRAME, { x: 14, z: -12 });

    expect(controller.stats().targetX).toBeCloseTo(0, 3);
    for (const corner of cornersOnScreen(controller, 32, 32)) expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
  });

  it('once zoomed in, the camera goes to the drone', () => {
    const controller = ready(32, 32);
    controller.setZoom(4);
    controller.setFollow(true);
    for (let i = 0; i < 300; i++) controller.update(FRAME, { x: 10, z: 6 });

    expect(controller.stats().targetX).toBeCloseTo(10, 0);
    expect(controller.stats().targetZ).toBeCloseTo(6, 0);
  });

  it('follows smoothly: a jump of the drone never makes the camera jump', () => {
    const controller = ready(32, 32);
    controller.setZoom(4);
    controller.setFollow(true);
    controller.update(FRAME, { x: 0, z: 0 });
    const start = controller.stats().targetX;
    const steps: number[] = [];
    let last = start;
    for (let i = 0; i < 240; i++) {
      controller.update(FRAME, { x: 12, z: 0 });
      const now = controller.stats().targetX;
      steps.push(now - last);
      last = now;
    }

    expect(steps[0]!).toBeLessThan(12 * 0.1);
    expect(steps.every((step) => step >= -1e-9)).toBe(true);
    // The speed rises and falls without a sudden change from one frame to the next.
    for (let i = 1; i < steps.length; i++) expect(Math.abs(steps[i]! - steps[i - 1]!)).toBeLessThan(0.2);
    expect(last).toBeGreaterThan(11);
  });

  it('stays where it was when following is turned off: no sudden move', () => {
    const controller = ready(32, 32);
    controller.setZoom(4);
    controller.setFollow(true);
    for (let i = 0; i < 300; i++) controller.update(FRAME, { x: 10, z: 6 });
    const following = controller.stats().targetX;
    controller.setFollow(false);
    for (let i = 0; i < 120; i++) controller.update(FRAME, { x: -10, z: -6 });

    expect(controller.stats().targetX).toBeCloseTo(following, 3);
  });

  it.each([1.5, 3, 5])('never goes so close to the edge that the picture shows beyond the field (zoom %s)', (zoom) => {
    const controller = ready(32, 32);
    controller.setZoom(zoom);
    controller.setFollow(true);
    for (let i = 0; i < 400; i++) controller.update(FRAME, { x: 16, z: -16 });
    const reach = 16 * (1 - 1 / zoom);

    expect(controller.stats().targetX).toBeLessThanOrEqual(reach + 1e-6);
    expect(controller.stats().targetZ).toBeGreaterThanOrEqual(-reach - 1e-6);
    expect(controller.stats().targetX).toBeGreaterThan(reach - 0.05);
  });

  it('can be switched on and off', () => {
    const controller = ready(8, 8);

    expect(controller.stats().follow).toBe(false);
    controller.toggleFollow();
    expect(controller.stats().follow).toBe(true);
    controller.toggleFollow();
    expect(controller.stats().follow).toBe(false);
  });
});

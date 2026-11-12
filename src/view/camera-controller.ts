import * as THREE from 'three';

/**
 * The two cameras the game is trying out, and how a player moves them. It only knows about cameras and
 * a field of a given size: nothing about the farm, the engine or the page. Which camera the game keeps is
 * decided later (issues 14 and 15); this puts both on the same field so they can be compared fairly.
 *
 * Both open looking at the field from the south with the same elevation, so the same world is on screen
 * in the same way round (north at the back, east on the right): only the projection differs.
 */
export type CameraKind = 'isometric' | 'perspective';

/** Zoom 1 shows the whole field; higher zooms show a smaller part of it, closer. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;

const DEFAULT_YAW = 0;
const DEFAULT_PITCH = (50 * Math.PI) / 180;
const PITCH_MIN = (18 * Math.PI) / 180;
const PITCH_MAX = (86 * Math.PI) / 180;
const FIELD_OF_VIEW = 36;
const FOLLOW_SPEED = 3.2;
/** Placing a point on screen can leave this much margin around the field, so plants at the edge are not cut. */
const MARGIN_X = 0.9;
const MARGIN_Y = 0.88;
const TALLEST_PLANT = 0.9;

export interface CameraOptions {
  /** The angle of the isometric camera around the field, in radians. Zero looks from the south, like the other camera. */
  readonly isometricYaw?: number;
  /** The elevation of the isometric camera, in radians. */
  readonly isometricPitch?: number;
}

export interface CameraStats {
  readonly kind: CameraKind;
  readonly zoom: number;
  readonly follow: boolean;
  readonly targetX: number;
  readonly targetZ: number;
  /** The angle of the camera that is on. */
  readonly yaw: number;
  readonly pitch: number;
}

export class CameraController {
  readonly perspective = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 600);
  readonly orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
  kind: CameraKind = 'perspective';
  private zoom = ZOOM_MIN;
  private following = false;
  private yaw = DEFAULT_YAW;
  private pitch = DEFAULT_PITCH;
  private readonly isometricYaw: number;
  private readonly isometricPitch: number;
  /** Where the camera has got to while following the drone (before the pan is added). */
  private readonly base = new THREE.Vector2();
  private readonly pannedBy = new THREE.Vector2();
  private readonly target = new THREE.Vector3();
  private aspect = 1;
  private viewportHeight = 1;
  private perspectiveFit = 20;
  private orthographicFit = 10;

  constructor(
    private readonly fieldWidth: number,
    private readonly fieldHeight: number,
    options: CameraOptions = {},
  ) {
    this.isometricYaw = options.isometricYaw ?? DEFAULT_YAW;
    this.isometricPitch = options.isometricPitch ?? DEFAULT_PITCH;
    this.refit();
    this.place();
  }

  get camera(): THREE.Camera {
    return this.kind === 'perspective' ? this.perspective : this.orthographic;
  }

  stats(): CameraStats {
    return {
      kind: this.kind,
      zoom: this.zoom,
      follow: this.following,
      targetX: this.target.x,
      targetZ: this.target.z,
      yaw: this.currentYaw(),
      pitch: this.currentPitch(),
    };
  }

  private currentYaw(): number {
    return this.kind === 'perspective' ? this.yaw : this.isometricYaw;
  }

  private currentPitch(): number {
    return this.kind === 'perspective' ? this.pitch : this.isometricPitch;
  }

  /** Follows the size of the window. */
  resize(width: number, height: number): void {
    this.viewportHeight = Math.max(1, height);
    this.aspect = Math.max(0.1, width / this.viewportHeight);
    this.perspective.aspect = this.aspect;
    this.refit();
    this.place();
  }

  toggleKind(): void {
    this.kind = this.kind === 'perspective' ? 'isometric' : 'perspective';
    this.place();
  }

  toggleFollow(): void {
    this.setFollow(!this.following);
  }

  setFollow(follow: boolean): void {
    this.following = follow;
  }

  setZoom(zoom: number): void {
    if (!Number.isFinite(zoom)) return;
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    this.place();
  }

  /** One turn of the mouse wheel: a negative `deltaY` (wheel away from the player) zooms in. */
  zoomBy(deltaY: number): void {
    if (!Number.isFinite(deltaY)) return;
    this.setZoom(this.zoom * Math.exp(-deltaY * 0.0015));
  }

  /** Turns the perspective camera with a drag of the left button. The isometric camera has a fixed angle. */
  rotate(dx: number, dy: number): boolean {
    if (this.kind !== 'perspective') return false;
    this.yaw -= dx * 0.006;
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + dy * 0.004));
    this.place();
    return true;
  }

  /** Moves the perspective camera over the field with a drag of the right button. */
  pan(dx: number, dy: number): boolean {
    if (this.kind !== 'perspective') return false;
    const distance = this.perspectiveFit / this.zoom;
    const perPixel = (2 * distance * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / this.viewportHeight;
    const right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const forward = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    this.pannedBy.addScaledVector(right, -dx * perPixel);
    this.pannedBy.addScaledVector(forward, (dy * perPixel) / Math.max(0.3, Math.sin(this.pitch)));
    this.keepInsideField(this.pannedBy);
    return true;
  }

  /** Keeps a point (of the pan, or of the following) inside the field, so the camera never wanders off. */
  private keepInsideField(point: THREE.Vector2): void {
    point.x = Math.min(this.fieldWidth / 2, Math.max(-this.fieldWidth / 2, point.x));
    point.y = Math.min(this.fieldHeight / 2, Math.max(-this.fieldHeight / 2, point.y));
  }

  /**
   * Moves time on by `seconds`. While following, the camera eases towards the drone: gently, so the
   * picture never lurches. The camera never goes so near an edge that the picture shows beyond the field:
   * how far it may leave the middle shrinks to nothing as the zoom comes down to 1.
   */
  update(seconds: number, drone: { readonly x: number; readonly z: number }): void {
    if (this.following && Number.isFinite(seconds) && seconds > 0) {
      const ease = 1 - Math.exp(-seconds * FOLLOW_SPEED);
      this.base.x += (drone.x - this.base.x) * ease;
      this.base.y += (drone.z - this.base.y) * ease;
      this.keepInsideField(this.base);
    }
    this.place();
  }

  /** Puts the camera where the state says, from the angles, the zoom and the point looked at. */
  private place(): void {
    // The picture shows about 1/zoom of the field, so the camera may leave the middle by what is left over.
    const reachX = (this.fieldWidth / 2) * (1 - 1 / this.zoom);
    const reachZ = (this.fieldHeight / 2) * (1 - 1 / this.zoom);
    this.target.set(
      Math.min(reachX, Math.max(-reachX, this.base.x + this.pannedBy.x)),
      0,
      Math.min(reachZ, Math.max(-reachZ, this.base.y + this.pannedBy.y)),
    );

    const yaw = this.currentYaw();
    const pitch = this.currentPitch();
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (this.kind === 'perspective') {
      const distance = this.perspectiveFit / this.zoom;
      this.perspective.position.copy(this.target).addScaledVector(direction, distance);
      this.perspective.lookAt(this.target);
      this.perspective.updateMatrixWorld();
      this.perspective.updateProjectionMatrix();
    } else {
      this.orthographic.position.copy(this.target).addScaledVector(direction, 120);
      this.orthographic.zoom = this.zoom;
      this.orthographic.lookAt(this.target);
      this.orthographic.updateMatrixWorld();
      this.orthographic.updateProjectionMatrix();
    }
  }

  /** The corners of the field, tall plants included: everything that must be in view at zoom 1. */
  private corners(): THREE.Vector3[] {
    return [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) =>
        [0, TALLEST_PLANT].map((y) => new THREE.Vector3((sx * (this.fieldWidth + 0.5)) / 2, y, (sz * (this.fieldHeight + 0.5)) / 2)),
      ),
    );
  }

  private fits(camera: THREE.Camera): boolean {
    camera.updateMatrixWorld();
    return this.corners().every((corner) => {
      const projected = corner.clone().project(camera);
      return Math.abs(projected.x) < MARGIN_X && Math.abs(projected.y) < MARGIN_Y;
    });
  }

  /** Finds how far each camera must be to fit the whole field at zoom 1, for the shape of the window. */
  private refit(): void {
    const origin = new THREE.Vector3();
    const place = (camera: THREE.Camera, yaw: number, pitch: number, distance: number) => {
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance);
      camera.lookAt(origin);
    };

    for (let distance = 4; distance < 600; distance *= 1.01) {
      place(this.perspective, DEFAULT_YAW, DEFAULT_PITCH, distance);
      this.perspective.updateProjectionMatrix();
      if (this.fits(this.perspective)) {
        this.perspectiveFit = distance;
        break;
      }
    }

    this.orthographic.zoom = 1;
    for (let half = 1; half < 400; half *= 1.01) {
      this.orthographic.top = half;
      this.orthographic.bottom = -half;
      this.orthographic.left = -half * this.aspect;
      this.orthographic.right = half * this.aspect;
      this.orthographic.updateProjectionMatrix();
      place(this.orthographic, this.isometricYaw, this.isometricPitch, 120);
      if (this.fits(this.orthographic)) {
        this.orthographicFit = half;
        break;
      }
    }
  }

  /** Where a point of the scene lands on the screen of the camera that is on: -1 to 1 is inside, y up. */
  project(point: THREE.Vector3): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const projected = point.clone().project(this.camera);
    return { x: projected.x, y: projected.y };
  }

  /** How big the scene is for the isometric camera, for the checks. */
  get isometricFit(): number {
    return this.orthographicFit;
  }
}

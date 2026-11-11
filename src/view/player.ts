import type { Farm, Run } from '../engine';
import type { FarmScene } from './farm-scene';

/** How many simulation ticks pass in a second of real time at speed 1. Only the pace of the view: the engine never sees it. */
export const TICKS_PER_SECOND = 10;

/** At the instant speed the view asks for this many ticks in each frame, until the script ends. */
export const INSTANT_TICKS_PER_FRAME = 5000;

export type Speed = number | 'instant';

/**
 * Feeds the engine's time to the scene. The speed is only how many ticks the view asks the engine for each
 * second: the engine does exactly the same at any speed, and the player only ever reads from it.
 */
export class Player {
  speed: Speed = 1;
  /** The error that ended the script, if one did. */
  error: unknown;
  private owed = 0;
  private given = 0;

  constructor(
    private readonly farm: Farm,
    private readonly run: Run,
    private readonly scene: FarmScene,
  ) {
    this.scene.sync(this.farm.getState());
  }

  get ticksGiven(): number {
    return this.given;
  }

  get isFinished(): boolean {
    return this.run.isFinished;
  }

  /** Lets `seconds` of real time pass at the current speed. */
  advance(seconds: number): void {
    if (this.speed === 'instant') {
      this.advanceTicks(INSTANT_TICKS_PER_FRAME);
      return;
    }
    this.owed += seconds * TICKS_PER_SECOND * this.speed;
    const whole = Math.floor(this.owed);
    this.owed -= whole;
    this.advanceTicks(whole);
  }

  /** Asks the engine for exactly `ticks` more whole ticks, then shows what happened. */
  advanceTicks(ticks: number): void {
    if (ticks <= 0 || this.run.isFinished) return;
    this.given += ticks;
    try {
      this.run.step(ticks);
    } catch (error) {
      this.error = error;
    }
    this.scene.handle(this.farm.drainEvents());
    this.scene.sync(this.farm.getState());
  }
}

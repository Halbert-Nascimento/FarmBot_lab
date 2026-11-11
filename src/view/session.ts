import { createFarm, formatTicks } from '../engine';
import type { Farm, FarmEvent, FarmState, Language, Run } from '../engine';
import type { FarmScene } from './farm-scene';
import { entryFor } from './i18n';
import type { ConsoleEntry } from './i18n';
import { Player } from './player';
import type { Speed } from './player';

export type Status = 'idle' | 'running' | 'paused' | 'finished' | 'failed';

/** The speeds the player can choose. They only change how fast the view asks the engine for time. */
export const SPEEDS: readonly Speed[] = [1, 4, 16, 'instant'];

/** The console keeps this many lines at most: a script that writes without end must not fill the memory. */
const MAX_ENTRIES = 300;

export interface SessionOptions {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly language: Language;
  readonly scene: FarmScene;
}

/**
 * What the buttons of the interface do, without any button: it coordinates the engine, the scene and the
 * console. Run always starts the farm over from scratch with the same seed, so the same script gives the
 * same result every time; Reset puts the farm back at the start without running anything. There is never
 * more than one run: starting another one drops the one that was going.
 *
 * It keeps the scene up to date with the farm, but knows nothing about the editor or the page, and
 * the scene and the engine know nothing about it.
 */
export class Session {
  /** The language of the messages of the next run. The console can be read in any language at any time. */
  language: Language;
  readonly scene: FarmScene;
  private readonly width: number;
  private readonly height: number;
  private readonly seed: number;
  private farm: Farm;
  private currentRun: Run | undefined;
  private player: Player | undefined;
  private currentStatus: Status = 'idle';
  private currentSpeed: Speed = 1;
  private log: ConsoleEntry[] = [];
  private changes = 0;

  constructor(options: SessionOptions) {
    this.width = options.width;
    this.height = options.height;
    this.seed = options.seed;
    this.language = options.language;
    this.scene = options.scene;
    this.farm = this.freshFarm();
    this.scene.sync(this.farm.getState());
  }

  get status(): Status {
    return this.currentStatus;
  }

  get entries(): readonly ConsoleEntry[] {
    return this.log;
  }

  /** Goes up every time the console changes, so whoever shows it knows when to draw it again. */
  get revision(): number {
    return this.changes;
  }

  get state(): FarmState {
    return this.farm.getState();
  }

  /** The ticks the run has spent, with exactly one decimal place. */
  get meter(): string {
    return this.currentRun?.getMeter().formatted ?? formatTicks(0);
  }

  get speed(): Speed {
    return this.currentSpeed;
  }

  set speed(speed: Speed) {
    this.currentSpeed = speed;
    if (this.player) this.player.speed = speed;
  }

  hash(): string {
    return this.farm.getStateHash();
  }

  private freshFarm(): Farm {
    return createFarm({ width: this.width, height: this.height, seed: this.seed, language: this.language });
  }

  private write(entry: ConsoleEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_ENTRIES) {
      // The oldest lines go, and a note in their place says so.
      this.log.splice(0, this.log.length - MAX_ENTRIES + 1, { kind: 'trimmed' });
    }
    this.changes++;
  }

  /** Drops whatever was running and puts a brand-new farm in its place. */
  private startOver(): void {
    this.player = undefined;
    this.currentRun = undefined;
    this.farm = this.freshFarm();
    this.log = [];
    this.changes++;
  }

  /** Starts the farm over from scratch and runs the script on it. */
  run(source: string): void {
    this.startOver();
    if (source.trim() === '') {
      // Nothing to run: say so, instead of a run that ends at once and teaches nothing.
      this.scene.sync(this.farm.getState());
      this.write({ kind: 'empty' });
      this.currentStatus = 'idle';
      return;
    }
    this.write({ kind: 'started' });
    try {
      this.currentRun = this.farm.run(source);
    } catch (error) {
      this.scene.sync(this.farm.getState());
      this.write({ kind: 'error', error });
      this.currentStatus = 'failed';
      return;
    }
    this.player = new Player(this.farm, this.currentRun, this.scene);
    this.player.speed = this.currentSpeed;
    this.currentStatus = 'running';
  }

  /** Puts the farm back as it was at the start, without running anything. */
  reset(): void {
    this.startOver();
    this.scene.sync(this.farm.getState());
    this.write({ kind: 'reset' });
    this.currentStatus = 'idle';
  }

  pause(): void {
    if (this.currentStatus === 'running') this.currentStatus = 'paused';
  }

  resume(): void {
    if (this.currentStatus === 'paused') this.currentStatus = 'running';
  }

  /** Lets `seconds` of real time pass. Nothing moves unless a script is running. */
  advance(seconds: number): void {
    if (this.currentStatus !== 'running' || !this.player) return;
    this.absorb(this.player.advance(seconds));
  }

  /** Lets exactly `ticks` ticks pass, even while paused: for stepping the farm by hand when testing. */
  advanceTicks(ticks: number): void {
    if ((this.currentStatus !== 'running' && this.currentStatus !== 'paused') || !this.player) return;
    this.absorb(this.player.advanceTicks(ticks));
  }

  /** Writes down what happened and notices when the run ended, well or badly. */
  private absorb(events: readonly FarmEvent[]): void {
    if (!this.player) return;
    for (const event of events) {
      const entry = entryFor(event);
      if (entry) this.write(entry);
    }
    if (this.player.error !== undefined) {
      this.write({ kind: 'error', error: this.player.error });
      this.currentStatus = 'failed';
    } else if (this.player.isFinished) {
      this.write({ kind: 'finished', ticks: this.meter });
      this.currentStatus = 'finished';
    }
  }
}

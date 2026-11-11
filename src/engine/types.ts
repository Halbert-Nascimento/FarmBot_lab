export type Terrain = 'grass' | 'tilled';
export type PlantSpecies = 'grass';

export interface Cell {
  readonly terrain: Terrain;
  readonly plant: PlantSpecies | null;
}

export interface FarmConfig {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
}

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface FarmState {
  readonly tick: number;
  readonly drone: Position;
  readonly field: {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly Cell[];
  };
}

/** A change of farm state, stamped with the exact time (in deciticks) at which the action completed. */
export type FarmEvent =
  | { readonly type: 'planted'; readonly timeDeciticks: number; readonly at: Position; readonly species: PlantSpecies }
  | { readonly type: 'harvested'; readonly timeDeciticks: number; readonly at: Position }
  | { readonly type: 'moved'; readonly timeDeciticks: number; readonly from: Position; readonly to: Position }
  | { readonly type: 'bumped'; readonly timeDeciticks: number; readonly at: Position };

export interface Meter {
  /** Time spent by the run, in deciticks (integer). */
  readonly deciticks: number;
  /** Time spent by the run, in ticks (one decimal at most). */
  readonly ticks: number;
  /** Time spent by the run, as text with exactly one decimal place, e.g. "6.0". */
  readonly formatted: string;
}

export interface Run {
  readonly isFinished: boolean;
  /** Advances the simulation by at least `ticks` whole ticks, or until the script ends. */
  step(ticks: number): void;
  getMeter(): Meter;
}

export interface Farm {
  /** A copy of the current state: changing it never changes the farm. */
  getState(): FarmState;
  /** A stable fingerprint of the full state, equal for equal states on any machine. */
  getStateHash(): string;
  /** Returns the events emitted since the last call, oldest first, and forgets them. */
  drainEvents(): FarmEvent[];
  run(source: string): Run;
}

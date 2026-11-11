import { createClock, DECITICKS_PER_TICK, formatTicks } from './clock';
import { hashString } from './hash';
import { interpret, parseScript } from './interpreter';
import type { Action, Environment } from './interpreter';

export type Terrain = 'grass' | 'tilled';
export type PlantSpecies = 'grass';

export interface Cell {
  terrain: Terrain;
  plant: PlantSpecies | null;
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EmittableEvent = DistributiveOmit<FarmEvent, 'timeDeciticks'>;

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
  /** Advances the simulation by at least `ticks` ticks, or until the script ends. */
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

/** Command costs in deciticks (GDD 5.2, ADR 0002). */
const COST = { move: 80, plant: 60, harvest: 60 } as const;

const PLANT_SPECIES: readonly PlantSpecies[] = ['grass'];

const DIRECTIONS = {
  NORTH: { x: 0, y: -1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: 1 },
  WEST: { x: -1, y: 0 },
} as const;

function isDirection(value: unknown): value is Position {
  return Object.values(DIRECTIONS).some((direction) => direction === value);
}

function isPlantSpecies(value: unknown): value is PlantSpecies {
  return PLANT_SPECIES.some((species) => species === value);
}

export function createFarm(config: FarmConfig): Farm {
  const cells: Cell[] = Array.from({ length: config.width * config.height }, () => ({
    terrain: 'grass',
    plant: null,
  }));
  const clock = createClock();
  let events: FarmEvent[] = [];
  const snapshot = (): FarmState =>
    structuredClone({
      tick: clock.ticks,
      drone,
      field: { width: config.width, height: config.height, cells },
    });
  const emit = (event: EmittableEvent) => {
    events.push({ ...event, timeDeciticks: clock.deciticks } as FarmEvent);
  };
  let drone: Position = { x: 0, y: 0 };
  const cellAtDrone = () => cells[drone.y * config.width + drone.x];

  const env: Environment = {
    constants: { Plant: { GRASS: 'grass' }, Dir: DIRECTIONS },
    commands: {
      move: (args): Action => {
        const [direction] = args;
        if (args.length !== 1 || !isDirection(direction)) throw new Error('move expects a direction');
        return {
          deciticks: COST.move,
          apply() {
            const next = { x: drone.x + direction.x, y: drone.y + direction.y };
            const inside = next.x >= 0 && next.x < config.width && next.y >= 0 && next.y < config.height;
            if (inside) {
              emit({ type: 'moved', from: drone, to: next });
              drone = next;
            } else {
              emit({ type: 'bumped', at: drone });
            }
          },
        };
      },
      harvest: (args): Action => {
        if (args.length !== 0) throw new Error('harvest takes no arguments');
        return {
          deciticks: COST.harvest,
          apply() {
            const cell = cellAtDrone();
            if (cell?.plant) {
              cell.plant = null;
              emit({ type: 'harvested', at: drone });
            }
          },
        };
      },
      plant: (args): Action => {
        const [species] = args;
        if (args.length !== 1 || !isPlantSpecies(species)) throw new Error('plant expects a plant species');
        return {
          deciticks: COST.plant,
          apply() {
            const cell = cellAtDrone();
            if (cell && cell.plant === null) {
              cell.plant = species;
              emit({ type: 'planted', at: drone, species });
            }
          },
        };
      },
    },
  };

  return {
    getState: snapshot,
    getStateHash: () => hashString(JSON.stringify([config.seed, clock.deciticks, drone.x, drone.y, cells.map((c) => [c.terrain, c.plant])])),
    drainEvents() {
      const drained = events;
      events = [];
      return drained;
    },
    run(source) {
      const script = interpret(parseScript(source), env);
      const startedAt = clock.deciticks;
      let finished = false;
      return {
        get isFinished() {
          return finished;
        },
        step(ticks) {
          if (!Number.isInteger(ticks) || ticks < 0) {
            throw new RangeError('The step budget must be a non-negative whole number of ticks');
          }
          const limit = clock.deciticks + ticks * DECITICKS_PER_TICK;
          try {
            while (!finished && clock.deciticks < limit) {
              const next = script.next();
              if (next.done) {
                finished = true;
                break;
              }
              clock.charge(next.value.deciticks);
              next.value.apply();
            }
          } catch (error) {
            finished = true;
            throw error;
          }
        },
        getMeter() {
          const deciticks = clock.deciticks - startedAt;
          return { deciticks, ticks: deciticks / DECITICKS_PER_TICK, formatted: formatTicks(deciticks) };
        },
      };
    },
  };
}

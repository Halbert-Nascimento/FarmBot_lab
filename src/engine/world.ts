import { createClock } from './clock';
import type { Clock } from './clock';
import type { PlantedPlant } from './plants';
import { createRng } from './rng';
import type { Rng } from './rng';
import type { FarmConfig, FarmEvent, Item, Position, Terrain } from './types';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EmittableEvent = DistributiveOmit<FarmEvent, 'timeDeciticks'>;

export interface MutableCell {
  terrain: Terrain;
  plant: PlantedPlant | null;
}

/** The mutable simulation state. Only commands change it, and only the farm hands out copies. */
export interface World {
  readonly config: FarmConfig;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly cells: MutableCell[];
  drone: Position;
  readonly stock: Record<Item, number>;
  cellAtDrone(): MutableCell | undefined;
  isInside(position: Position): boolean;
  emit(event: EmittableEvent): void;
  drainEvents(): FarmEvent[];
}

export function createWorld(config: FarmConfig): World {
  const clock = createClock();
  let events: FarmEvent[] = [];
  const world: World = {
    config,
    clock,
    rng: createRng(config.seed),
    cells: Array.from({ length: config.width * config.height }, () => ({ terrain: 'grass', plant: null })),
    drone: { x: 0, y: 0 },
    stock: { hay: 0, wheat: 0 },
    cellAtDrone: () => world.cells[world.drone.y * config.width + world.drone.x],
    isInside: (p) => p.x >= 0 && p.x < config.width && p.y >= 0 && p.y < config.height,
    emit(event) {
      events.push({ ...event, timeDeciticks: clock.deciticks } as FarmEvent);
    },
    drainEvents() {
      const drained = events;
      events = [];
      return drained;
    },
  };
  return world;
}

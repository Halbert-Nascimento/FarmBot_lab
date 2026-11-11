import { DECITICKS_PER_TICK } from './clock';
import type { Action, Environment } from './interpreter';
import { PLANTS, plantState } from './plants';
import type { Item, PlantSpecies, Position, RejectReason } from './types';
import type { World } from './world';

/** Command costs in deciticks (GDD 5.2, ADR 0002). */
const COST = { move: 80, plant: 60, harvest: 60, till: 40 } as const;

const PLANT_SPECIES = Object.keys(PLANTS) as PlantSpecies[];

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

export function createEnvironment(world: World): Environment {
  return {
    constants: { Plant: { GRASS: 'grass', WHEAT: 'wheat' }, Dir: DIRECTIONS },
    commands: {
      move: (args): Action => {
        const [direction] = args;
        if (args.length !== 1 || !isDirection(direction)) throw new Error('move expects a direction');
        return {
          deciticks: COST.move,
          apply() {
            const next = { x: world.drone.x + direction.x, y: world.drone.y + direction.y };
            if (world.isInside(next)) {
              world.emit({ type: 'moved', from: world.drone, to: next });
              world.drone = next;
            } else {
              world.emit({ type: 'bumped', at: world.drone });
            }
          },
        };
      },
      harvest: (args): Action => {
        if (args.length !== 0) throw new Error('harvest takes no arguments');
        return {
          deciticks: COST.harvest,
          apply(startedAt) {
            const cell = world.cellAtDrone();
            if (cell?.plant) {
              const { species } = cell.plant;
              const ripe = plantState(cell.plant, startedAt).stage === 'ready';
              cell.plant = null;
              if (ripe) {
                const { item, quantity } = PLANTS[species].yield;
                world.stock[item] += quantity;
                world.emit({ type: 'harvested', at: world.drone, species, item, quantity });
              } else {
                world.emit({ type: 'destroyed', at: world.drone, species });
              }
            }
          },
        };
      },
      till: (args): Action => {
        if (args.length !== 0) throw new Error('till takes no arguments');
        return {
          deciticks: COST.till,
          apply() {
            const cell = world.cellAtDrone();
            if (!cell) return;
            if (cell.plant !== null) {
              world.emit({ type: 'rejected', at: world.drone, action: 'till', reason: 'occupied' });
              return;
            }
            cell.terrain = cell.terrain === 'grass' ? 'tilled' : 'grass';
            world.emit({ type: 'tilled', at: world.drone, terrain: cell.terrain });
          },
        };
      },
      wait: (args): Action => {
        const [ticks] = args;
        if (args.length !== 1 || typeof ticks !== 'number' || !Number.isInteger(ticks) || ticks < 0) {
          throw new Error('wait expects a whole number of ticks');
        }
        return { deciticks: ticks * DECITICKS_PER_TICK, apply() {} };
      },
      plant: (args): Action => {
        const [species] = args;
        if (args.length !== 1 || !isPlantSpecies(species)) throw new Error('plant expects a plant species');
        return {
          deciticks: COST.plant,
          apply() {
            const cell = world.cellAtDrone();
            if (!cell) return;
            const { terrain, cost } = PLANTS[species];
            const reject = (reason: RejectReason) =>
              world.emit({ type: 'rejected', at: world.drone, action: 'plant', reason });
            if (cell.plant !== null) return reject('occupied');
            if (terrain !== null && cell.terrain !== terrain) return reject('needs-tilled-terrain');
            const lacksStock = Object.entries(cost).some(([item, quantity]) => world.stock[item as Item] < quantity);
            if (lacksStock) return reject('not-enough-hay');
            for (const [item, quantity] of Object.entries(cost)) world.stock[item as Item] -= quantity;
            cell.plant = { species, plantedAt: world.clock.deciticks };
            world.emit({ type: 'planted', at: world.drone, species });
          },
        };
      },
    },
  };
}

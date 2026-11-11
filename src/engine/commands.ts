import type { Action, Environment } from './interpreter';
import type { PlantSpecies, Position } from './types';
import type { World } from './world';

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

export function createEnvironment(world: World): Environment {
  return {
    constants: { Plant: { GRASS: 'grass' }, Dir: DIRECTIONS },
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
          apply() {
            const cell = world.cellAtDrone();
            if (cell?.plant) {
              cell.plant = null;
              world.emit({ type: 'harvested', at: world.drone });
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
            const cell = world.cellAtDrone();
            if (cell && cell.plant === null) {
              cell.plant = species;
              world.emit({ type: 'planted', at: world.drone, species });
            }
          },
        };
      },
    },
  };
}

import { DECITICKS_PER_TICK, formatTicks } from './clock';
import { createEnvironment } from './commands';
import { hashString } from './hash';
import { interpret, parseScript } from './interpreter';
import { plantState } from './plants';
import type { Farm, FarmConfig, FarmState } from './types';
import { createWorld } from './world';

export function createFarm(config: FarmConfig): Farm {
  const world = createWorld(config);
  const env = createEnvironment(world);
  const { clock } = world;

  const snapshot = (): FarmState =>
    structuredClone({
      tick: clock.ticks,
      drone: world.drone,
      stock: world.stock,
      field: {
        width: config.width,
        height: config.height,
        cells: world.cells.map((cell) => ({
          terrain: cell.terrain,
          plant: cell.plant && plantState(cell.plant, clock.deciticks),
        })),
      },
    });

  return {
    getState: snapshot,
    getStateHash: () =>
      hashString(
        JSON.stringify([
          config.seed,
          clock.deciticks,
          world.drone.x,
          world.drone.y,
          world.stock.hay,
          world.stock.wheat,
          world.cells.map((c) => [c.terrain, c.plant?.species ?? null, c.plant?.plantedAt ?? null]),
        ]),
      ),
    drainEvents: world.drainEvents,
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
              const startedAt = clock.deciticks;
              clock.charge(next.value.deciticks);
              next.value.apply(startedAt);
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

import { DECITICKS_PER_TICK, formatTicks } from './clock';
import { createEnvironment } from './commands';
import { hashString } from './hash';
import { interpret, parseScript } from './interpreter';
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
      field: { width: config.width, height: config.height, cells: world.cells },
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
          world.cells.map((c) => [c.terrain, c.plant]),
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

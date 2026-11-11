import { DECITICKS_PER_TICK, formatTicks } from './clock';
import { createEnvironment } from './commands';
import { hashString } from './hash';
import { ITEMS } from './items';
import { interpret, parseScript } from './interpreter';
import { resolveLimits } from './limits';
import { plantState } from './plants';
import { createProgressGuard } from './progress';
import { ScriptError } from './script-error';
import type { Farm, FarmConfig, FarmState } from './types';
import { createWorld } from './world';

/**
 * The machine running out of stack or string space is not the player's fault in a way the
 * game can explain with a raw error, so it becomes a mistake in the script, at the last line seen.
 */
function asScriptError(error: unknown, line: number): unknown {
  if (!(error instanceof RangeError)) return error;
  if (/string length/i.test(error.message)) return new ScriptError('The text is too long', line);
  return new ScriptError('The script went too deep: calls or values nested too far for the machine to follow', line);
}

export function createFarm(config: FarmConfig): Farm {
  const world = createWorld(config);
  const env = createEnvironment(world);
  const limits = resolveLimits(config.limits);
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
          world.rng.state,
          clock.deciticks,
          world.drone.x,
          world.drone.y,
          ITEMS.map((item) => world.stock[item]),
          world.cells.map((c) => [c.terrain, c.plant?.species ?? null, c.plant?.plantedAt ?? null]),
        ]),
      ),
    drainEvents: world.drainEvents,
    run(source) {
      const script = interpret(parseScript(source), env, limits);
      const startedAt = clock.deciticks;
      let finished = false;
      let lastResult: unknown;
      const guard = createProgressGuard(limits);
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
              const next = script.next(lastResult);
              if (next.done) {
                finished = true;
                break;
              }
              const startedAt = clock.deciticks;
              clock.charge(next.value.deciticks);
              lastResult = next.value.apply(startedAt);
              guard.observe(next.value);
            }
          } catch (error) {
            finished = true;
            throw asScriptError(error, guard.lastLine);
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

import { DECITICKS_PER_TICK, formatTicks } from './clock';
import { createEnvironment } from './commands';
import { hashString } from './hash';
import { ITEMS } from './items';
import { interpret, parseScript } from './interpreter';
import type { Action } from './interpreter';
import { checkLayer, LAYER_COUNT } from './layers';
import { DEFAULT_LANGUAGE, isLanguage } from './messages';
import type { Language } from './messages';
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
function asScriptError(error: unknown, line: number, language: Language): unknown {
  if (error instanceof ScriptError) return error.inLanguage(language);
  if (!(error instanceof RangeError)) return error;
  return new ScriptError(/string length/i.test(error.message) ? 'textTooLong' : 'tooDeep', line, {}, language);
}

export function createFarm(config: FarmConfig): Farm {
  const language = config.language ?? DEFAULT_LANGUAGE;
  if (!isLanguage(language)) throw new RangeError('The language must be en or pt-BR');
  const layer = config.layer ?? LAYER_COUNT;
  if (!Number.isInteger(layer) || layer < 1 || layer > LAYER_COUNT) {
    throw new RangeError(`The layer must be a whole number from 1 to ${LAYER_COUNT}`);
  }
  const world = createWorld(config);
  const env = createEnvironment(world);
  const constantGroups = new Set(Object.keys(env.constants));
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
      let program;
      try {
        program = parseScript(source);
        checkLayer(program, layer, constantGroups);
      } catch (error) {
        throw asScriptError(error, 0, language);
      }
      const script = interpret(program, env, limits);
      const startedAt = clock.deciticks;
      /**
       * Where the clock must get to, given every tick the view has asked for so far. The clock stops
       * exactly there: an action whose cost does not fit in what was asked for keeps going in the next
       * step, and its effect is applied only once its whole cost has been paid. That is what makes the
       * result the same however the view slices its steps (1x, 16x or all at once), and what keeps the
       * world from running ahead of what the view shows.
       */
      let target = startedAt;
      let inFlight: { action: Action; remaining: number; startedAt: number } | undefined;
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
          target += ticks * DECITICKS_PER_TICK;
          try {
            while (!finished && clock.deciticks < target) {
              if (!inFlight) {
                const next = script.next(lastResult);
                if (next.done) {
                  finished = true;
                  break;
                }
                inFlight = { action: next.value, remaining: next.value.deciticks, startedAt: clock.deciticks };
              }
              const paid = Math.min(inFlight.remaining, target - clock.deciticks);
              clock.charge(paid);
              inFlight.remaining -= paid;
              if (inFlight.remaining > 0) break;
              const { action, startedAt: actionStartedAt } = inFlight;
              inFlight = undefined;
              lastResult = action.apply(actionStartedAt);
              guard.observe(action);
            }
          } catch (error) {
            finished = true;
            throw asScriptError(error, guard.lastLine, language);
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

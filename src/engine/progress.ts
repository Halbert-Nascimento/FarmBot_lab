import { DECITICKS_PER_TICK } from './clock';
import type { Action } from './interpreter';
import type { Limits } from './limits';
import { ScriptError } from './script-error';

export interface ProgressGuard {
  /** Looks at the action the script just performed, and stops a script that is going nowhere. */
  observe(action: Action): void;
  /** The last script line any action pointed at, to say where something went wrong. */
  readonly lastLine: number;
}

/**
 * Watches a run for the two ways a script can go nowhere: calculating for too long without
 * a command that spends ticks, and going round and round without any time passing.
 */
export function createProgressGuard(limits: Limits): ProgressGuard {
  let computeDeciticks = 0;
  let idleRounds = 0;
  let lastLine = 0;
  return {
    get lastLine() {
      return lastLine;
    },
    observe({ deciticks, computation, line }) {
      if (line) lastLine = line;
      // Only a command that spends ticks counts as progress. Calculating and free commands do not.
      computeDeciticks = computation || deciticks === 0 ? computeDeciticks + deciticks : 0;
      idleRounds = deciticks === 0 ? idleRounds + 1 : 0;
      if (computeDeciticks > limits.computeTicksWithoutCommand * DECITICKS_PER_TICK) {
        throw new ScriptError('computeTooLong', lastLine, { ticks: limits.computeTicksWithoutCommand });
      }
      if (idleRounds > limits.roundsWithoutTime) {
        throw new ScriptError('idleRounds', lastLine);
      }
    },
  };
}

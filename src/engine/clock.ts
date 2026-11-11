/** One tick is made of ten deciticks (ADR 0002). All costs are integers in deciticks. */
export const DECITICKS_PER_TICK = 10;

export interface Clock {
  /** Total time elapsed, in deciticks. */
  readonly deciticks: number;
  /** Whole ticks elapsed. The remainder below one tick stays accumulated. */
  readonly ticks: number;
  charge(deciticks: number): void;
}

export function createClock(): Clock {
  let deciticks = 0;
  return {
    get deciticks() {
      return deciticks;
    },
    get ticks() {
      return Math.floor(deciticks / DECITICKS_PER_TICK);
    },
    charge(amount: number) {
      deciticks += amount;
    },
  };
}

/** Formats a duration in deciticks as ticks with exactly one decimal, e.g. 25 -> "2.5". */
export function formatTicks(deciticks: number): string {
  const whole = Math.floor(deciticks / DECITICKS_PER_TICK);
  const tenth = deciticks % DECITICKS_PER_TICK;
  return `${whole}.${tenth}`;
}

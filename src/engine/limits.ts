/** What keeps a script from hanging or exhausting the machine. All of them can be set per farm. */
export interface Limits {
  /**
   * Ticks a script may spend computing without calling a command that spends ticks. That is
   * the only sign of progress, so a loop that only calculates is stopped here (REQ-FND-15).
   */
  readonly computeTicksWithoutCommand: number;
  /** Loop rounds (and free commands) in a row that may pass without any time being spent. */
  readonly roundsWithoutTime: number;
  /** How deep functions may call one another. */
  readonly callDepth: number;
  /** The most items a list may hold, properties an object may hold, or characters a text may hold. */
  readonly collectionSize: number;
}

export const DEFAULT_LIMITS: Limits = {
  computeTicksWithoutCommand: 5_000,
  roundsWithoutTime: 10_000,
  callDepth: 200,
  collectionSize: 10_000,
};

/**
 * The deepest nesting of calls any configuration may ask for. Measured: the machine stack holds
 * about 500 nested calls of the interpreter and overflows before 1000, so this leaves a margin.
 * Do not raise it without measuring again on every supported browser.
 */
export const MAX_CALL_DEPTH = 400;

export function resolveLimits(limits: Partial<Limits> | undefined): Limits {
  const resolved = { ...DEFAULT_LIMITS, ...limits };
  return { ...resolved, callDepth: Math.min(resolved.callDepth, MAX_CALL_DEPTH) };
}

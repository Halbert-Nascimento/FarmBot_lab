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

export function resolveLimits(limits: Partial<Limits> | undefined): Limits {
  return { ...DEFAULT_LIMITS, ...limits };
}

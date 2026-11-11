export interface Rng {
  /** The next number in [0, 1). */
  next(): number;
  /** The whole generator state: equal states produce equal futures. */
  readonly state: number;
}

/** mulberry32: a tiny seeded generator that only uses 32-bit integer arithmetic, so it is identical on every machine. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return a;
    },
  };
}

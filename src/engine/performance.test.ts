import { describe, expect, it } from 'vitest';
import { createFarm, DEFAULT_LIMITS, MAX_CALL_DEPTH, ScriptError } from './index';

/**
 * Official measurement for REQ-NFR-02 and ADR 0001 (issue #10).
 *
 * Measured: `farm.run(source)` (parsing included), stepping until the run's meter shows TICKS ticks, and draining
 * the events along the way. Not measured: creating the farm, any view, any worker, any browser.
 * Environment: Node (V8, the engine of Chrome and Edge), not the browsers themselves.
 * The requirement is 2 s; this test fails only if the requirement is broken, so it holds on a slow CI machine too.
 */
const TICKS = 100_000;
const FIELD = 16;
const REPEATS = 7;
const REQUIREMENT_MS = 2000;

/** A representative script: sweeps the whole field forever, tilling, planting, reading sensors and harvesting. */
const SWEEP = `
const visited = [];
function visit(x, y) {
  if (getTerrain() !== Terrain.TILLED) {
    till();
  }
  if (isReady()) {
    harvest();
  }
  plant(Plant.GRASS);
  visited.push({ x: x, y: y });
  if (visited.length > 50) {
    visited.pop();
  }
  return x + y;
}
let total = 0;
while (true) {
  for (let y = 0; y < ${FIELD}; y++) {
    let dir = Dir.EAST;
    if (y % 2 === 1) {
      dir = Dir.WEST;
    }
    for (let x = 0; x < ${FIELD - 1}; x++) {
      total += visit(x, y);
      move(dir);
    }
    visit(${FIELD - 1}, y);
    log(\`row \${y} done, total \${total}\`);
    move(Dir.SOUTH);
  }
  for (let y = 0; y < ${FIELD}; y++) {
    move(Dir.NORTH);
  }
}
`;

/** Runs the sweep for TICKS ticks in steps of `slice` ticks; returns the milliseconds and what it did. */
function measure(slice: number) {
  const farm = createFarm({ width: FIELD, height: FIELD, seed: 1 });
  const start = performance.now();
  const run = farm.run(SWEEP);
  let events = 0;
  while (run.getMeter().ticks < TICKS) {
    run.step(slice);
    events += farm.drainEvents().length;
  }
  return { ms: performance.now() - start, ticks: run.getMeter().ticks, events, finished: run.isFinished };
}

function summarize(slice: number) {
  measure(slice); // warm-up: lets the engine optimize, as it would in a long play session
  const runs = Array.from({ length: REPEATS }, () => measure(slice));
  const times = runs.map((r) => r.ms).sort((a, b) => a - b);
  return { min: times[0]!, median: times[REPEATS >> 1]!, max: times[REPEATS - 1]!, sample: runs[0]! };
}

const round = (ms: number) => Math.round(ms * 10) / 10;

describe('REQ-NFR-02: 100,000 ticks on a 16x16 field in at most 2 s', () => {
  it.each([
    ['one big step per 1,000 ticks (fast-forward)', 1000],
    ['a step per 10 ticks (a frame at high speed)', 10],
    ['a step per tick (the finest slicing)', 1],
  ])('with %s', (label, slice) => {
    const { min, median, max, sample } = summarize(slice);

    console.info(
      `[perf] ${label}: median ${round(median)} ms (min ${round(min)}, max ${round(max)}, ${REPEATS} runs), ` +
        `${sample.ticks} ticks, ${sample.events} events`,
    );
    expect(sample.finished).toBe(false);
    expect(sample.ticks).toBeGreaterThanOrEqual(TICKS);
    expect(median).toBeLessThan(REQUIREMENT_MS);
  });
});

describe('the call-depth limit is safe on this machine', () => {
  /** Builds a script whose every recursion level also nests `nesting` parenthesized expressions. */
  const recursion = (depth: number, nesting: number) =>
    `function f(n) {\n  if (n > 0) {\n    return ${'1 + ('.repeat(nesting)}f(n - 1)${')'.repeat(nesting)};\n  }\n  return 0;\n}\nf(${depth});`;

  function outcome(source: string, callDepth: number) {
    const farm = createFarm({ width: 4, height: 4, seed: 1, limits: { callDepth, computeTicksWithoutCommand: 1_000_000 } });
    try {
      farm.run(source).step(1_000_000);
      return 'ok';
    } catch (error) {
      return error instanceof ScriptError ? error.message.replace(/^Line \d+: /, '') : `RAW ${String(error)}`;
    }
  }

  it('keeps the default and the ceiling in order', () => {
    expect(DEFAULT_LIMITS.callDepth).toBeLessThanOrEqual(MAX_CALL_DEPTH);
  });

  it.each([0, 20, 60, 150])(
    'never lets the machine stack escape raw at the ceiling, with %i nested expressions per level',
    (nesting) => {
      const result = outcome(recursion(MAX_CALL_DEPTH - 1, nesting), MAX_CALL_DEPTH);

      console.info(`[stack] depth ${MAX_CALL_DEPTH - 1}, ${nesting} nested expressions per level: ${result}`);
      expect(result).not.toMatch(/^RAW/);
    },
  );

  it('fits the default limit with a margin, and the exact depth is reported', () => {
    // Binary search for the deepest plain recursion that finishes when the ceiling is the only limit.
    let low = 1;
    let high = MAX_CALL_DEPTH - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (outcome(recursion(middle, 0), MAX_CALL_DEPTH) === 'ok') low = middle;
      else high = middle - 1;
    }

    console.info(`[stack] deepest plain recursion that finishes: ${low} levels (default ${DEFAULT_LIMITS.callDepth}, ceiling ${MAX_CALL_DEPTH})`);
    expect(low).toBeGreaterThanOrEqual(DEFAULT_LIMITS.callDepth * 1.25);
  });
});

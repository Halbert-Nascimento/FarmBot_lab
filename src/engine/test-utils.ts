import { createFarm } from './index';

const config = { width: 3, height: 2, seed: 1 };

/** Runs a script to the end on a fresh farm and returns what it logged, one list of values per `log` call. */
export function logged(source: string, budget = 100_000) {
  const farm = createFarm(config);
  const run = farm.run(source);
  run.step(budget);
  const values = farm.drainEvents().flatMap((event) => (event.type === 'logged' ? [event.values] : []));
  return { values, run, farm };
}

/** Runs a script on a fresh farm and returns the error it fails with. */
export function failure(source: string): unknown {
  try {
    createFarm(config).run(source).step(100_000);
  } catch (error) {
    return error;
  }
  throw new Error('Expected the script to fail, but it ran to the end');
}

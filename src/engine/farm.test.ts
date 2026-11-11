import { describe, expect, it } from 'vitest';
import { createFarm } from './index';

describe('createFarm', () => {
  it('starts a farm at tick zero with a field of grass cells', () => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });

    const state = farm.getState();

    expect(state.tick).toBe(0);
    expect(state.field.width).toBe(3);
    expect(state.field.height).toBe(2);
    expect(state.field.cells).toHaveLength(6);
    expect(state.field.cells.every((cell) => cell.terrain === 'grass')).toBe(true);
  });
});

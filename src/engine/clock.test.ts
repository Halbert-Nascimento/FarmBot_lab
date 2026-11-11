import { describe, expect, it } from 'vitest';
import { createClock, formatTicks } from './index';

describe('clock', () => {
  it('advances the world only when the accumulated deciticks complete a tick, keeping the remainder', () => {
    const clock = createClock();

    clock.charge(5);
    expect(clock.ticks).toBe(0);

    clock.charge(5);
    expect(clock.ticks).toBe(1);

    clock.charge(5);
    expect(clock.ticks).toBe(1);
    expect(clock.deciticks).toBe(15);

    clock.charge(5);
    expect(clock.ticks).toBe(2);
  });

  it('shows ticks with exactly one decimal place', () => {
    expect(formatTicks(25)).toBe('2.5');
    expect(formatTicks(60)).toBe('6.0');
    expect(formatTicks(1)).toBe('0.1');
    expect(formatTicks(0)).toBe('0.0');
  });
});

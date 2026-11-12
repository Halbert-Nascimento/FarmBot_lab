import type { GrowthStage, PlantSpecies } from '../engine';

/**
 * The stress field: a big field full of plants of both species and all three growth stages, to compare the
 * cameras on density, contrast and speed. THESE PLANTS ARE NOT PART OF THE FARM. They are only drawn, by the
 * scene, and the engine never hears of them: they have no state, no growth and no hash.
 */
export interface MadePlant {
  readonly species: PlantSpecies;
  readonly stage: GrowthStage;
}

const STAGES: readonly GrowthStage[] = ['sprout', 'growing', 'ready'];

/**
 * A fixed pattern: the species in a chess pattern and the stages in rows, so every combination is on
 * screen at once and the very same field is drawn every time.
 */
export function stressPlants(width: number, height: number): readonly MadePlant[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return { species: (x + y) % 2 === 0 ? 'grass' : 'wheat', stage: STAGES[y % STAGES.length] as GrowthStage };
  });
}

/** The frame counter looks at this many seconds back. */
export const FRAME_WINDOW_SECONDS = 4;

export interface FrameSample {
  /** When the frame ended, in milliseconds. */
  readonly at: number;
  /** How long it took, in milliseconds. */
  readonly ms: number;
}

export interface FrameSummary {
  readonly fps: number;
  readonly worstMs: number;
  readonly frames: number;
}

/** The frames per second (on average) and the slowest frame, over the last few seconds up to `now`. */
export function summarizeFrames(samples: readonly FrameSample[], now: number): FrameSummary {
  const recent = samples.filter((sample) => now - sample.at <= FRAME_WINDOW_SECONDS * 1000);
  if (recent.length === 0) return { fps: 0, worstMs: 0, frames: 0 };
  const total = recent.reduce((sum, sample) => sum + sample.ms, 0);
  return { fps: 1000 / (total / recent.length), worstMs: Math.max(...recent.map((sample) => sample.ms)), frames: recent.length };
}

import { DECITICKS_PER_TICK } from './clock';
import type { Item, PlantSpecies, PlantState } from './types';

interface PlantSpec {
  /** Time to ripen, in deciticks (GDD 7.2). */
  readonly growthDeciticks: number;
  /** What a ripe harvest rewards. */
  readonly yield: { readonly item: Item; readonly quantity: number };
}

export const PLANTS: Readonly<Record<PlantSpecies, PlantSpec>> = {
  grass: { growthDeciticks: 120 * DECITICKS_PER_TICK, yield: { item: 'hay', quantity: 1 } },
};

/** A plant as the world stores it: what it is and when it was planted. */
export interface PlantedPlant {
  readonly species: PlantSpecies;
  readonly plantedAt: number;
}

/** Growth depends only on elapsed time, so nothing needs updating while time passes. */
export function plantState(plant: PlantedPlant, nowDeciticks: number): PlantState {
  const { growthDeciticks } = PLANTS[plant.species];
  const elapsed = nowDeciticks - plant.plantedAt;
  const progress = Math.min(100, Math.floor((elapsed * 100) / growthDeciticks));
  // Sprout during the first third of the growth time, ready once it is complete.
  const stage = elapsed >= growthDeciticks ? 'ready' : elapsed * 3 >= growthDeciticks ? 'growing' : 'sprout';
  return { species: plant.species, stage, progress };
}

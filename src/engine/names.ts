import type { Position } from './types';

/**
 * Every command has an English name and a Portuguese one, and both are always accepted,
 * whatever language the messages are in (GDD REQ-FND-41). The Portuguese names have no accents,
 * so they are easy to type. Keys are the English names.
 */
export const COMMAND_NAMES = {
  move: 'mover',
  plant: 'plantar',
  harvest: 'colher',
  till: 'arar',
  wait: 'esperar',
  log: 'registrar',
  random: 'aleatorio',
  getPos: 'posicao',
  getSize: 'tamanho',
  getPlant: 'lerPlanta',
  isReady: 'lerPronta',
  getTerrain: 'lerTerreno',
  getStock: 'estoque',
} as const;

export type CommandName = keyof typeof COMMAND_NAMES;

export const DIRECTIONS = {
  NORTH: { x: 0, y: -1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: 1 },
  WEST: { x: -1, y: 0 },
} as const satisfies Record<string, Position>;

/** A constant of the script under its English name and its Portuguese name. Both give the very same value. */
export interface ConstantPair {
  readonly english: string;
  readonly portuguese: string;
  readonly value: unknown;
}

export const CONSTANT_PAIRS: readonly ConstantPair[] = [
  { english: 'Plant.GRASS', portuguese: 'Planta.CAPIM', value: 'grass' },
  { english: 'Plant.WHEAT', portuguese: 'Planta.TRIGO', value: 'wheat' },
  { english: 'Terrain.GRASS', portuguese: 'Terreno.GRAMA', value: 'grass' },
  { english: 'Terrain.TILLED', portuguese: 'Terreno.ARADO', value: 'tilled' },
  { english: 'Item.HAY', portuguese: 'Item.FENO', value: 'hay' },
  { english: 'Item.WHEAT', portuguese: 'Item.TRIGO', value: 'wheat' },
  { english: 'Dir.NORTH', portuguese: 'Dir.NORTE', value: DIRECTIONS.NORTH },
  { english: 'Dir.EAST', portuguese: 'Dir.LESTE', value: DIRECTIONS.EAST },
  { english: 'Dir.SOUTH', portuguese: 'Dir.SUL', value: DIRECTIONS.SOUTH },
  { english: 'Dir.WEST', portuguese: 'Dir.OESTE', value: DIRECTIONS.WEST },
];

/** The constants grouped by the name before the dot (Dir, Planta...), with no prototype to reach through. */
export function buildConstantGroups(): Record<string, Record<string, unknown>> {
  const groups: Record<string, Record<string, unknown>> = Object.create(null);
  for (const { english, portuguese, value } of CONSTANT_PAIRS) {
    for (const full of [english, portuguese]) {
      const [group = '', key = ''] = full.split('.');
      (groups[group] ??= Object.create(null) as Record<string, unknown>)[key] = value;
    }
  }
  return groups;
}

/** Every name the player can write that is Portuguese: used to suggest names in the language of the messages. */
export const PORTUGUESE_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(COMMAND_NAMES),
  ...CONSTANT_PAIRS.flatMap(({ portuguese }) => [portuguese, ...portuguese.split('.')]),
]);


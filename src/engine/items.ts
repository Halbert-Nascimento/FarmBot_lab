/** The single list of items the farm can stock. Add a new item here and the rest follows. */
export const ITEMS = ['hay', 'wheat'] as const;

export type Item = (typeof ITEMS)[number];

export function isItem(value: unknown): value is Item {
  return ITEMS.some((item) => item === value);
}

import type { BlockStatement, Expression } from 'acorn';
import { Scope } from './scope';
import { ScriptError } from './script-error';

/** A function the player wrote. It remembers the scope it was written in. */
export class UserFunction {
  constructor(
    readonly params: readonly string[],
    readonly body: BlockStatement | Expression,
    readonly scope: Scope,
  ) {}
}

/**
 * An object the player made. It has no prototype, so it carries nothing from the host
 * JavaScript: the only properties it has are the ones the script put there.
 */
export type ScriptObject = Record<string, unknown>;

/** How many properties each object has, kept so a write never has to count them all. */
const propertyCounts = new WeakMap<ScriptObject, number>();

export function createObject(): ScriptObject {
  const object = Object.create(null) as ScriptObject;
  propertyCounts.set(object, 0);
  return object;
}

function isScriptObject(value: unknown): value is ScriptObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === null;
}

/** What a function looks like to everything outside the interpreter (a log line, a command argument). */
export const FUNCTION_AS_TEXT = '[function]';

/** What a value that contains itself looks like where it would repeat forever. */
const CIRCULAR_AS_TEXT = '[circular]';

/** The names that lead out of the player's values into the host JavaScript. No script may use them. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function checkKey(key: string, line: number): void {
  if (FORBIDDEN_KEYS.has(key)) throw new ScriptError('propertyNotAllowed', line, { key });
}

export function tooBig(what: 'list' | 'object' | 'text', line: number): ScriptError {
  const code = { list: 'listTooBig', object: 'objectTooBig', text: 'textTooLong' }[what];
  return new ScriptError(code, line);
}

/** Returns the text if it fits in `maxLength` characters, and refuses it if it does not. */
export function ensureTextFits(text: string, maxLength: number, line: number): string {
  if (text.length > maxLength) throw tooBig('text', line);
  return text;
}

/** The position a key stands for in a list or a text, or `undefined` when it is not a whole number from 0. */
function toIndex(key: unknown): number | undefined {
  const number = typeof key === 'number' ? key : typeof key === 'string' && /^\d+$/.test(key) ? Number(key) : undefined;
  return number !== undefined && Number.isInteger(number) && number >= 0 ? number : undefined;
}

/** Reads `target[key]`. Only what the player's own values hold is ever found. */
export function readProperty(target: unknown, key: unknown, line: number): unknown {
  if (target === null || target === undefined) {
    throw new ScriptError('cannotRead', line, { target: String(target), key: String(key) });
  }
  const index = toIndex(key);
  if (Array.isArray(target) || typeof target === 'string') {
    if (key === 'length') return target.length;
    if (index !== undefined) return target[index];
  } else if (isScriptObject(target)) {
    const name = String(key);
    checkKey(name, line);
    return Object.hasOwn(target, name) ? target[name] : undefined;
  }
  checkKey(String(key), line);
  return undefined;
}

/** Writes `target[key] = value`, on a list (at most one past its end) or an object. */
export function writeProperty(target: unknown, key: unknown, value: unknown, line: number, maxSize: number): void {
  if (Array.isArray(target)) {
    const index = toIndex(key);
    if (index === undefined || index > target.length) throw new ScriptError('invalidListPosition', line, { key: String(key) });
    if (index >= maxSize) throw tooBig('list', line);
    target[index] = value;
  } else if (isScriptObject(target)) {
    const name = String(key);
    checkKey(name, line);
    if (!Object.hasOwn(target, name)) {
      const count = propertyCounts.get(target) ?? Object.keys(target).length;
      if (count >= maxSize) throw tooBig('object', line);
      propertyCounts.set(target, count + 1);
    }
    target[name] = value;
  } else {
    throw new ScriptError('cannotSet', line, { target: target === null ? 'null' : typeof target });
  }
}

/** The methods a list has. Calling anything else on a list is an error. */
export const LIST_METHODS: Readonly<
  Record<string, (list: unknown[], args: readonly unknown[], maxSize: number, line: number) => unknown>
> = {
  push(list, args, maxSize, line) {
    if (list.length + args.length > maxSize) throw tooBig('list', line);
    return list.push(...args);
  },
  pop: (list) => list.pop(),
};

/**
 * A value as text, the way a template string shows it. The text is refused as soon as it passes
 * `maxLength`, so a value that holds itself many times over is cut short instead of walked in full.
 */
export function stringify(value: unknown, line: number, maxLength: number): string {
  const open = new Set<unknown>();
  let produced = 0;
  const grow = (characters: number): void => {
    produced += characters;
    if (produced > maxLength) throw tooBig('text', line);
  };
  const text = (item: unknown): string => {
    if (typeof item === 'string') {
      grow(item.length);
      return item;
    }
    if (item instanceof UserFunction) {
      grow(FUNCTION_AS_TEXT.length);
      return FUNCTION_AS_TEXT;
    }
    if (Array.isArray(item)) {
      if (open.has(item)) return '';
      open.add(item);
      const parts: string[] = [];
      for (const [index, entry] of item.entries()) {
        if (index > 0) grow(1);
        parts.push(entry === null || entry === undefined ? '' : text(entry));
      }
      open.delete(item);
      return parts.join(',');
    }
    if (isScriptObject(item)) {
      grow('[object Object]'.length);
      return '[object Object]';
    }
    const plain = String(item);
    grow(plain.length);
    return plain;
  };
  return text(value);
}

/**
 * A value as the farm may see it: a small plain tree. Lists and objects the player made are
 * copied (a value that appears twice becomes two copies, one that contains itself shows
 * `[circular]` where it would repeat) and functions become text, so the interpreter's own
 * objects never leave it and what is handed over can always be sent as JSON.
 * `maxItems` caps the size of the tree, counting every list, object, item and property.
 */
export function exportValue(value: unknown, line: number, maxItems: number): unknown {
  const path = new Set<object>();
  let items = 0;
  const copy = (item: unknown): unknown => {
    if (item instanceof UserFunction) return FUNCTION_AS_TEXT;
    if (typeof item !== 'object' || item === null) return item;
    const isList = Array.isArray(item);
    if (!isList && !isScriptObject(item)) return item;
    if (path.has(item)) return CIRCULAR_AS_TEXT;
    items += 1 + (isList ? item.length : Object.keys(item).length);
    if (items > maxItems) throw new ScriptError('valueTooBig', line);
    path.add(item);
    try {
      if (isList) return item.map((entry: unknown) => copy(entry));
      const plain: Record<string, unknown> = {};
      for (const [name, entry] of Object.entries(item)) plain[name] = copy(entry);
      return plain;
    } finally {
      path.delete(item);
    }
  };
  return copy(value);
}

/**
 * A value a command gave back, made into the player's own kind of value: plain data from
 * the farm becomes lists and objects the script can read, always as a copy.
 */
export function importValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => importValue(item));
  if (typeof value !== 'object' || value === null) return value;
  const object = createObject();
  let count = 0;
  for (const [name, item] of Object.entries(value)) {
    object[name] = importValue(item);
    count++;
  }
  propertyCounts.set(object, count);
  return object;
}

/**
 * Whether what the script holds takes more than `limit` memory units: one for every list
 * item and object property, and one for every character of a text. Only what can still be
 * reached counts, starting from the scopes the script is running in, so garbage is free.
 */
export function exceedsMemory(roots: readonly Scope[], limit: number): boolean {
  const seen = new Set<object>();
  const pending: unknown[] = [...roots];
  let units = 0;
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      units += value.length;
    } else if (value instanceof UserFunction) {
      pending.push(value.scope);
    } else if (value instanceof Scope) {
      if (seen.has(value)) continue;
      seen.add(value);
      for (const binding of value.bindings()) pending.push(binding.value);
      const outer = value.enclosing();
      if (outer) pending.push(outer);
    } else if (Array.isArray(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      units += value.length;
      for (const item of value) pending.push(item);
    } else if (isScriptObject(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      const entries = Object.values(value);
      units += entries.length;
      for (const item of entries) pending.push(item);
    }
    if (units > limit) return true;
  }
  return false;
}

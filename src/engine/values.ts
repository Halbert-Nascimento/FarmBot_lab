import type { BlockStatement, Expression } from 'acorn';
import type { Scope } from './scope';
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

export function createObject(): ScriptObject {
  return Object.create(null) as ScriptObject;
}

function isScriptObject(value: unknown): value is ScriptObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === null;
}

/** What a function looks like to everything outside the interpreter (a log line, a command argument). */
export const FUNCTION_AS_TEXT = '[function]';

/** The names that lead out of the player's values into the host JavaScript. No script may use them. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function checkKey(key: string, line: number): void {
  if (FORBIDDEN_KEYS.has(key)) throw new ScriptError(`Property not allowed: ${key}`, line);
}

export function tooBig(what: 'list' | 'object' | 'text', line: number): ScriptError {
  const message = {
    list: 'The list is too big',
    object: 'The object has too many properties',
    text: 'The text is too long',
  }[what];
  return new ScriptError(message, line);
}

/** The position a key stands for in a list or a text, or `undefined` when it is not a whole number from 0. */
function toIndex(key: unknown): number | undefined {
  const number = typeof key === 'number' ? key : typeof key === 'string' && /^\d+$/.test(key) ? Number(key) : undefined;
  return number !== undefined && Number.isInteger(number) && number >= 0 ? number : undefined;
}

/** Reads `target[key]`. Only what the player's own values hold is ever found. */
export function readProperty(target: unknown, key: unknown, line: number): unknown {
  if (target === null || target === undefined) {
    throw new ScriptError(`Cannot read properties of ${String(target)} (reading '${String(key)}')`, line);
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
    if (index === undefined || index > target.length) throw new ScriptError(`Invalid list position: ${String(key)}`, line);
    if (index >= maxSize) throw tooBig('list', line);
    target[index] = value;
  } else if (isScriptObject(target)) {
    const name = String(key);
    checkKey(name, line);
    if (!Object.hasOwn(target, name) && Object.keys(target).length >= maxSize) throw tooBig('object', line);
    target[name] = value;
  } else {
    throw new ScriptError(`Cannot set properties of ${target === null ? 'null' : typeof target}`, line);
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

/** A value as text, the way a template string shows it. */
export function stringify(value: unknown, line: number, maxLength: number): string {
  const open = new Set<unknown>();
  const text = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (item instanceof UserFunction) return FUNCTION_AS_TEXT;
    if (Array.isArray(item)) {
      if (open.has(item)) return '';
      open.add(item);
      const joined = item.map((entry) => (entry === null || entry === undefined ? '' : text(entry))).join(',');
      open.delete(item);
      return joined;
    }
    if (isScriptObject(item)) return '[object Object]';
    return String(item);
  };
  const result = text(value);
  if (result.length > maxLength) throw tooBig('text', line);
  return result;
}

/**
 * A value as the farm may see it: lists and objects the player made are copied into plain
 * ones and functions become text, so the interpreter's own objects never leave it.
 */
export function exportValue(value: unknown, copies = new Map<object, unknown>()): unknown {
  if (value instanceof UserFunction) return FUNCTION_AS_TEXT;
  if (typeof value !== 'object' || value === null) return value;
  const known = copies.get(value);
  if (known) return known;
  if (Array.isArray(value)) {
    const list: unknown[] = [];
    copies.set(value, list);
    for (const item of value) list.push(exportValue(item, copies));
    return list;
  }
  if (isScriptObject(value)) {
    const plain: Record<string, unknown> = {};
    copies.set(value, plain);
    for (const [name, item] of Object.entries(value)) plain[name] = exportValue(item, copies);
    return plain;
  }
  return value;
}

import { formatTicks, ScriptError } from '../engine';
import type { FarmEvent, Language } from '../engine';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

/** Every text of the interface, by its key in the translation files. */
export type UiKey = keyof typeof en;

const CATALOGS: Readonly<Record<Language, Readonly<Record<UiKey, string>>>> = { en, 'pt-BR': ptBR };

/** A text of the interface in a language, with its `{placeholders}` filled in. */
export function translate(language: Language, key: UiKey, values: Readonly<Record<string, unknown>> = {}): string {
  return CATALOGS[language][key].replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}

/** The steps of "how to play", in order. */
export const HELP_STEPS: readonly UiKey[] = ['help.step1', 'help.step2', 'help.step3', 'help.step4', 'help.step5'];

/** The language to open in, from what the browser says the person prefers: Portuguese for any `pt`, English otherwise. */
export function detectLanguage(preferred: string | undefined): Language {
  return preferred?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

const withoutBlanks = (code: string): string => code.replace(/\s+/g, '');

/**
 * What the editor should hold after the language changes: the example of the new language if the player
 * has not written anything of their own yet (blank space aside), and their own code otherwise.
 */
export function codeAfterLanguageChange(code: string, previous: Language, next: Language): string {
  return withoutBlanks(code) === withoutBlanks(translate(previous, 'example')) ? translate(next, 'example') : code;
}

/**
 * One line of the console, kept as what happened and not as text, so the whole console can be read
 * again in another language at any time.
 */
export type ConsoleEntry =
  | { readonly kind: 'started' | 'reset' | 'empty' | 'trimmed' }
  | { readonly kind: 'finished'; readonly ticks: string }
  | { readonly kind: 'event'; readonly event: ConsoleEvent }
  | { readonly kind: 'error'; readonly error: unknown };

/** The events of the farm that deserve a line. The others (moving, planting, tilling) are plain to see in the scene. */
type ConsoleEvent = Extract<FarmEvent, { type: 'logged' | 'harvested' | 'destroyed' | 'bumped' | 'rejected' }>;

function isConsoleEvent(event: FarmEvent): event is ConsoleEvent {
  return event.type === 'logged' || event.type === 'harvested' || event.type === 'destroyed' || event.type === 'bumped' || event.type === 'rejected';
}

/** The console line for an event of the farm, if it gets one. */
export function entryFor(event: FarmEvent): ConsoleEntry | undefined {
  return isConsoleEvent(event) ? { kind: 'event', event } : undefined;
}

export type Tone = 'info' | 'log' | 'warn' | 'error';

export interface ConsoleLine {
  readonly text: string;
  readonly tone: Tone;
}

/**
 * A logged value the way the console shows it: a text as it is, and anything else the way it is written
 * in code. Numbers that are not ordinary numbers (NaN, Infinity) are shown as what they are.
 */
function show(value: unknown, nested = false): string {
  if (typeof value === 'string') return nested ? JSON.stringify(value) : value;
  if (Array.isArray(value)) return `[${value.map((item) => show(item, true)).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .map(([key, item]) => `${key}: ${show(item, true)}`)
      .join(', ')}}`;
  }
  return String(value);
}

function describeEvent(event: ConsoleEvent, language: Language): ConsoleLine {
  // The engine says how a time is written, so the console and the meter always agree.
  const stamp = `[${formatTicks(event.timeDeciticks)}] `;
  switch (event.type) {
    case 'logged':
      return { text: stamp + event.values.map((value) => show(value)).join(' '), tone: 'log' };
    case 'harvested':
      return {
        text: stamp + translate(language, 'console.harvested', { quantity: event.quantity, item: translate(language, `console.item.${event.item}`) }),
        tone: 'info',
      };
    case 'destroyed':
      return { text: stamp + translate(language, 'console.destroyed'), tone: 'warn' };
    case 'bumped':
      return { text: stamp + translate(language, 'console.bumped'), tone: 'warn' };
    case 'rejected':
      return {
        text:
          stamp +
          translate(language, 'console.rejected', {
            command: translate(language, `command.${event.action}`),
            reason: translate(language, `reject.${event.reason}`),
          }),
        tone: 'warn',
      };
  }
}

/** What a console line says, in a language. */
export function describeEntry(entry: ConsoleEntry, language: Language): ConsoleLine {
  switch (entry.kind) {
    case 'started':
    case 'reset':
    case 'trimmed':
      return { text: translate(language, `console.${entry.kind}`), tone: 'info' };
    case 'empty':
      return { text: translate(language, 'console.empty'), tone: 'warn' };
    case 'finished':
      return { text: translate(language, 'console.finished', { ticks: entry.ticks }), tone: 'info' };
    case 'event':
      return describeEvent(entry.event, language);
    case 'error': {
      const { error } = entry;
      // The engine tells its own mistakes in any language. Anything else is shown as it came.
      const text = error instanceof ScriptError ? error.inLanguage(language).message : error instanceof Error ? error.message : String(error);
      return { text, tone: 'error' };
    }
  }
}

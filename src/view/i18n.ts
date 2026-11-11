import { ScriptError } from '../engine';
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

/** The language to open in, from what the browser says the person prefers: Portuguese for any `pt`, English otherwise. */
export function detectLanguage(preferred: string | undefined): Language {
  return preferred?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

/**
 * One line of the console, kept as what happened and not as text, so the whole console can be read
 * again in another language at any time.
 */
export type ConsoleEntry =
  | { readonly kind: 'started' }
  | { readonly kind: 'reset' }
  | { readonly kind: 'finished'; readonly ticks: string }
  | { readonly kind: 'event'; readonly event: ConsoleEvent }
  | { readonly kind: 'error'; readonly error: unknown };

/** The events of the farm that deserve a line. The others (moving, planting, tilling) are plain to see in the scene. */
type ConsoleEvent = Extract<FarmEvent, { type: 'logged' | 'harvested' | 'destroyed' | 'bumped' | 'rejected' }>;

const CONSOLE_EVENTS: ReadonlySet<string> = new Set(['logged', 'harvested', 'destroyed', 'bumped', 'rejected']);

/** The console line for an event of the farm, if it gets one. */
export function entryFor(event: FarmEvent): ConsoleEntry | undefined {
  return CONSOLE_EVENTS.has(event.type) ? { kind: 'event', event: event as ConsoleEvent } : undefined;
}

export type Tone = 'info' | 'log' | 'warn' | 'error';

export interface ConsoleLine {
  readonly text: string;
  readonly tone: Tone;
}

/** A logged value the way the console shows it: text as it is, anything else in its JSON form. */
function show(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
}

function describeEvent(event: ConsoleEvent, language: Language): ConsoleLine {
  const stamp = `[${(event.timeDeciticks / 10).toFixed(1)}] `;
  switch (event.type) {
    case 'logged':
      return { text: stamp + event.values.map(show).join(' '), tone: 'log' };
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
      return { text: translate(language, 'console.started'), tone: 'info' };
    case 'reset':
      return { text: translate(language, 'console.reset'), tone: 'info' };
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

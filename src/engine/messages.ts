import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import { suggest } from './suggest';

export type Language = 'en' | 'pt-BR';

/** Every error the engine can raise, named by the keys of the translation files (error.notDefined -> notDefined). */
export type ErrorCode = { [Key in keyof typeof en]: Key extends `error.${infer Code}` ? Code : never }[keyof typeof en];

export const LANGUAGES: readonly Language[] = ['en', 'pt-BR'];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

const CATALOGS: Readonly<Record<Language, Readonly<Record<string, string>>>> = { en, 'pt-BR': ptBR };

/**
 * What an error needs to say itself in any language. A `whatKey` is the key of a phrase in the
 * translation files; `guess` is a name the player wrote that does not exist, and `candidates`
 * are the names they may have meant by it.
 */
export interface MessageParams {
  readonly [name: string]: unknown;
}

function text(language: Language, key: string): string {
  return CATALOGS[language][key] ?? CATALOGS.en[key] ?? key;
}

function fill(template: string, values: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}

export interface RenderedError {
  readonly reason: string;
  readonly hint: string;
  readonly didYouMean: string | undefined;
  readonly message: string;
}

const ENDS_A_SENTENCE = /[.?!)]$/;

/** Writes an error in a language: where it was, what went wrong, a "did you mean", and what to try. */
export function renderError(language: Language, code: ErrorCode, line: number, params: MessageParams): RenderedError {
  const values: Record<string, unknown> = { ...params };
  if (typeof params['whatKey'] === 'string') values['what'] = text(language, `what.${params['whatKey']}`);
  // A feature of the language and the layer that unlocks it are named by their keys in the translation files.
  if (typeof params['feature'] === 'string') values['feature'] = text(language, `feature.${params['feature']}`);
  if (typeof params['layer'] === 'number') values['layerName'] = text(language, `layer.${params['layer']}`);
  const reason = fill(text(language, `error.${code}`), values);
  const hint = fill(text(language, `hint.${code}`), values);
  const candidates = Array.isArray(params['candidates']) ? (params['candidates'] as string[]) : [];
  const guess = typeof params['guess'] === 'string' ? params['guess'] : undefined;
  const didYouMean = guess === undefined ? undefined : suggest(guess, candidates, language);

  const parts = [`${fill(text(language, 'format.line'), { line })}: ${reason}${ENDS_A_SENTENCE.test(reason) ? '' : '.'}`];
  if (didYouMean !== undefined) parts.push(fill(text(language, 'format.didYouMean'), { suggestion: didYouMean }));
  parts.push(`${text(language, 'format.tip')}: ${hint}`);
  return { reason, hint, didYouMean, message: parts.join(' ') };
}

import type { Language } from './messages';
import { PORTUGUESE_NAMES } from './names';

/** The number of single-character edits that turn one text into the other. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = row;
  }
  return previous[b.length] ?? 0;
}

/**
 * The name, among `candidates`, that the player most likely meant by `name`: at most 2 edits away
 * (1 for very short names). When two are equally close, the one in the language of the messages wins.
 */
export function suggest(name: string, candidates: readonly string[], language: Language): string | undefined {
  const limit = name.length <= 3 ? 1 : 2;
  let best: { candidate: string; edits: number; preferred: boolean } | undefined;
  for (const candidate of new Set(candidates)) {
    if (candidate === name) continue;
    const edits = distance(name, candidate);
    if (edits > limit) continue;
    const preferred = PORTUGUESE_NAMES.has(candidate) === (language === 'pt-BR');
    if (!best || edits < best.edits || (edits === best.edits && preferred && !best.preferred)) {
      best = { candidate, edits, preferred };
    }
  }
  return best?.candidate;
}

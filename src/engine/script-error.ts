import { DEFAULT_LANGUAGE, renderError } from './messages';
import type { Language, MessageParams } from './messages';

/**
 * A mistake in the player's script: the line it was found at, what went wrong (`reason`),
 * a name the player may have meant (`didYouMean`) and what to try (`hint`), in one language.
 * `code` names the mistake, whatever the language, so it can be tested and counted.
 */
export class ScriptError extends Error {
  readonly reason: string;
  readonly hint: string;
  readonly didYouMean: string | undefined;

  constructor(
    readonly code: string,
    readonly line: number,
    readonly params: MessageParams = {},
    readonly language: Language = DEFAULT_LANGUAGE,
  ) {
    const rendered = renderError(language, code, line, params);
    super(rendered.message);
    this.name = 'ScriptError';
    this.reason = rendered.reason;
    this.hint = rendered.hint;
    this.didYouMean = rendered.didYouMean;
  }

  /** The same mistake, told in another language. */
  inLanguage(language: Language): ScriptError {
    return language === this.language ? this : new ScriptError(this.code, this.line, this.params, language);
  }
}

/** A command refusing its arguments. The interpreter adds the line and the name the player used. */
export class CommandError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'CommandError';
  }
}

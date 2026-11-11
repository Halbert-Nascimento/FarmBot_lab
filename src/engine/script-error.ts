/** A mistake in the player's script, with the line it was found at. */
export class ScriptError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`Line ${line}: ${message}`);
    this.name = 'ScriptError';
  }
}

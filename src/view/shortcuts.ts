export type ShortcutAction = 'toggle-camera' | 'toggle-follow';

export interface KeyPress {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  /** True when the player is typing in the editor or in any other text field. */
  readonly inTextField: boolean;
  /** True when the key is being held down and the browser repeats it. */
  readonly repeat: boolean;
  /** True while a character is being composed with an input method. */
  readonly composing: boolean;
}

/**
 * What a key press means for the game, if anything. The letters are only shortcuts while the player is not
 * typing: in the editor, C and F are just letters. Combinations that already mean something else (copy,
 * find...) are left alone, and so is a key that is only being held down.
 */
export function shouldHandleShortcut(press: KeyPress): ShortcutAction | undefined {
  if (press.inTextField || press.ctrl || press.meta || press.alt || press.repeat || press.composing) return undefined;
  switch (press.key.toLowerCase()) {
    case 'c':
      return 'toggle-camera';
    case 'f':
      return 'toggle-follow';
    default:
      return undefined;
  }
}

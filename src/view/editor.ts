import { javascript } from '@codemirror/lang-javascript';
import { basicSetup, EditorView } from 'codemirror';

/** The code editor. It holds text and nothing else: it knows nothing about the farm, the scene or the engine. */
export interface CodeEditor {
  getCode(): string;
  setCode(code: string): void;
}

/** Puts an editor in `parent`. `onRunShortcut` is called when the player presses Ctrl+Enter (or Cmd+Enter). */
export function createEditor(parent: HTMLElement, code: string, onRunShortcut: () => void): CodeEditor {
  const view = new EditorView({
    doc: code,
    parent,
    extensions: [
      // Before the standard keys, which would otherwise take Ctrl+Enter to open a blank line.
      EditorView.domEventHandlers({
        keydown(event) {
          if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return false;
          event.preventDefault();
          onRunShortcut();
          return true;
        },
      }),
      basicSetup,
      javascript(),
    ],
  });
  return {
    getCode: () => view.state.doc.toString(),
    setCode(next) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    },
  };
}

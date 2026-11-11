import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const boundaryMessage = 'The engine (src/engine) must not depend on the view (src/view).';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The simulation engine never depends on the view (REQ-ARQ-01 and 02).
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/view', '**/view/**'], message: boundaryMessage }] },
      ],
      // `no-restricted-imports` does not cover dynamic `import()`.
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportExpression[source.value=/(^|\\/)view(\\/|$)/]",
          message: boundaryMessage,
        },
      ],
    },
  },
  {
    // The view reads the engine only through its public interface (src/engine/index.ts), never its insides.
    files: ['src/view/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/engine/*'],
              message: 'The view may only import from the public interface of the engine (../engine).',
            },
          ],
        },
      ],
    },
  },
  {
    // Tools that are not part of the game: they run in Node and also send code to the browser to run there.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', window: 'readonly', document: 'readonly' },
    },
  },
);

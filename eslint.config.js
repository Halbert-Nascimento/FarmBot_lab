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
);

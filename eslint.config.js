import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // O motor de simulação nunca depende da visualização (REQ-ARQ-01 e 02).
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/view', '**/view/**', '@/view', '@/view/**'],
              message: 'O motor (src/engine) não pode importar a visualização (src/view).',
            },
          ],
        },
      ],
    },
  },
);

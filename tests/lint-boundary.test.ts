import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

async function lint(code: string, filePath: string) {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

describe('engine/view boundary', () => {
  it('rejects an engine file that imports from the view', async () => {
    const messages = await lint("import { draw } from '../view/scene';\ndraw();\n", 'src/engine/farm.ts');

    expect(messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('accepts an engine file that imports only from the engine', async () => {
    const messages = await lint(
      "import { createFarm } from './index';\ncreateFarm({ width: 1, height: 1, seed: 1 });\n",
      'src/engine/farm.ts',
    );

    expect(messages).toEqual([]);
  });

  it('allows the view to import from the engine', async () => {
    const messages = await lint(
      "import { createFarm } from '../engine';\ncreateFarm({ width: 1, height: 1, seed: 1 });\n",
      'src/view/main.ts',
    );

    expect(messages).toEqual([]);
  });
});

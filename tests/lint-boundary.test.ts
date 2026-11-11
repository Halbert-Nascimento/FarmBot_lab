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

  it.each([
    ['a type-only import', "import type { Scene } from '../view/scene';\nexport type Alias = Scene;\n"],
    ['a re-export', "export * from '../view/scene';\n"],
    ['a dynamic import', "const scene = await import('../view/scene');\nexport default scene;\n"],
  ])('rejects an engine file that uses %s from the view', async (_label, code) => {
    const messages = await lint(code, 'src/engine/farm.ts');

    expect(messages.length).toBeGreaterThan(0);
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

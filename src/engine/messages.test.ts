import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from './index';
import type { Limits } from './index';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import { config } from './test-utils';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

function fail(source: string, language: 'en' | 'pt-BR', limits: Partial<Limits> = {}) {
  try {
    createFarm({ ...config, language, limits }).run(source).step(100_000);
  } catch (error) {
    return error as ScriptError;
  }
  throw new Error('Expected the script to fail');
}

describe('the translation files', () => {
  it('have the same keys in English and in Portuguese', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in every message of both languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ptBR[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('have no empty message', () => {
    for (const text of [...Object.values(en), ...Object.values(ptBR)]) expect(text.trim()).not.toBe('');
  });
});

/** Every error the engine can raise, with a script that raises it. */
const CASES: Record<string, { source: string; limits?: Partial<Limits>; pt: RegExp }> = {
  memory: {
    source: 'const rows = [];\nwhile (true) {\n  rows.push([1, 2, 3, 4, 5]);\n}',
    limits: { memoryUnits: 100, computeTicksWithoutCommand: 1_000_000 },
    pt: /Linha \d: O script está usando memória demais/,
  },
  unsupported: { source: 'for (const a of [1]) {}', pt: /Linha 1: Sintaxe não suportada: ForOfStatement/ },
  notDefined: { source: 'log(x);', pt: /Linha 1: x não está definido/ },
  beforeInit: { source: 'log(x);\nlet x = 1;', pt: /Linha 1: Não é possível usar 'x' antes de ela ser declarada/ },
  constAssign: { source: 'const x = 1;\nx = 2;', pt: /Linha 2: Não é possível alterar a constante x/ },
  invalidOperation: { source: 'log({} < 1);', pt: /Linha 1: Operação inválida/ },
  notAFunction: { source: 'const x = 1;\nx();', pt: /Linha 2: x não é uma função/ },
  notAFunctionExpression: { source: 'const f = [() => 1];\nf[0]()();', pt: /Linha 2: .* não é uma função/ },
  unknownValue: { source: 'log(Dir.UP);', pt: /Linha 1: Valor desconhecido: Dir\.UP/ },
  unknownCommand: { source: 'jump();', pt: /Linha 1: Comando desconhecido: jump/ },
  callDepth: { source: 'function f() {\n  f();\n}\nf();', pt: /Linha \d: .*profundidade máxima de chamadas/ },
  propertyNotAllowed: { source: 'const o = {};\nlog(o.constructor);', pt: /Linha 2: Propriedade não permitida: constructor/ },
  listTooBig: {
    source: 'const a = [];\nwhile (true) {\n  a.push(1);\n}',
    limits: { collectionSize: 10, computeTicksWithoutCommand: 1_000_000 },
    pt: /Linha \d: A lista é grande demais/,
  },
  objectTooBig: {
    source: 'const o = {};\nfor (let i = 0; i < 20; i++) {\n  o[`k${i}`] = i;\n}',
    limits: { collectionSize: 10 },
    pt: /Linha \d: O objeto tem propriedades demais/,
  },
  textTooLong: {
    source: 'let t = "ab";\nwhile (true) {\n  t = t + t;\n}',
    limits: { collectionSize: 100, computeTicksWithoutCommand: 1_000_000 },
    pt: /Linha \d: O texto é longo demais/,
  },
  valueTooBig: {
    source: 'let a = [1];\nfor (let i = 0; i < 25; i++) {\n  a = [a, a];\n}\nlog(a);',
    pt: /Linha 5: O valor é grande demais/,
  },
  cannotRead: { source: 'log(undefined.x);', pt: /Linha 1: Não é possível ler propriedades de undefined/ },
  cannotSet: { source: 'let a = 1;\na.x = 2;', pt: /Linha 2: Não é possível definir propriedades/ },
  invalidListPosition: { source: 'const a = [];\na[5] = 1;', pt: /Linha 2: Posição de lista inválida: 5/ },
  tooDeep: {
    source: `function f(n) {\n  if (n > 0) {\n    return ${'1 + ('.repeat(60)}f(n - 1)${')'.repeat(60)};\n  }\n  return 0;\n}\nf(190);`,
    pt: /Linha \d+: O script foi fundo demais/,
  },
  computeTooLong: {
    source: 'let x = 0;\nwhile (true) {\n  x++;\n}',
    limits: { computeTicksWithoutCommand: 50 },
    pt: /Linha 2: O script calculou por mais de 50 ticks/,
  },
  idleRounds: {
    source: 'while (true) {}',
    limits: { roundsWithoutTime: 50 },
    pt: /Linha 1: O script girou por tempo demais sem gastar nenhum tick/,
  },
  syntaxUnexpectedToken: { source: 'log(1;', pt: /Linha 1: Símbolo inesperado/ },
  syntaxUnterminatedString: { source: 'log("abc);', pt: /Linha 1: Texto sem aspas de fechamento/ },
  syntaxUnterminatedTemplate: { source: 'log(`abc);', pt: /Linha 1: Template string sem crase de fechamento/ },
  syntaxAlreadyDeclared: { source: 'let a = 1;\nlet a = 2;', pt: /Linha 2: O nome 'a' já foi declarado/ },
  syntaxUnexpectedChar: { source: 'log(1) @', pt: /Linha 1: Caractere inesperado/ },
  syntaxReturnOutside: { source: 'return 1;', pt: /Linha 1: 'return' só pode ser usado dentro de uma função/ },
  syntaxInvalidAssignment: { source: '1 = 2;', pt: /Linha 1: Não é possível atribuir a isto/ },
  syntaxReservedWord: { source: 'let if = 1;', pt: /Linha 1: Esta palavra é reservada do JavaScript/ },
  syntaxGeneric: { source: 'break;', pt: /Linha 1: Erro de sintaxe: / },
  constantGroup: { source: 'log(Dir);', pt: /Linha 1: Dir é um grupo de constantes, não um valor/ },
  moveExpectsDirection: { source: 'move(5);', pt: /Linha 1: move espera uma direção/ },
  plantExpectsSpecies: { source: 'plantar();', pt: /Linha 1: plantar espera uma espécie de planta/ },
  getStockExpectsItem: { source: 'estoque();', pt: /Linha 1: estoque espera um item/ },
  waitExpectsTicks: { source: 'esperar(-1);', pt: /Linha 1: esperar espera um número inteiro de ticks/ },
  takesNoArguments: { source: 'colher(1);', pt: /Linha 1: colher não aceita argumentos/ },
};

describe('script errors', () => {
  it('cover every error message the engine has', () => {
    const codes = Object.keys(en)
      .filter((key) => key.startsWith('error.'))
      .map((key) => key.slice('error.'.length))
      .sort();

    expect(Object.keys(CASES).sort()).toEqual(codes);
  });

  it.each(Object.entries(CASES))('%s: raised with its code, line, cause and tip, in both languages', (code, { source, limits, pt }) => {
    const english = fail(source, 'en', limits);
    const portuguese = fail(source, 'pt-BR', limits);

    expect(english).toBeInstanceOf(ScriptError);
    expect(english.code).toBe(code);
    expect(portuguese.code).toBe(code);
    expect(english.line).toBeGreaterThan(0);
    expect(english.line).toBe(portuguese.line);
    expect(english.reason).not.toBe('');
    expect(english.hint).not.toBe('');
    expect(english.message).toMatch(/^Line \d+: .+ Tip: .+/s);
    expect(portuguese.message).toMatch(/^Linha \d+: .+ Dica: .+/s);
    expect(portuguese.message).toMatch(pt);
    expect(portuguese.message).not.toBe(english.message);
  });

  it('never leave English words in a translated syntax error the game knows', () => {
    for (const source of ['return 1;', '1 = 2;', 'let if = 1;', 'log(1;', 'log("a);']) {
      expect(fail(source, 'pt-BR').message, source).not.toMatch(/outside of function|rvalue|keyword|Unexpected|Unterminated/);
    }
  });

  it('give a tip that does not depend on the name the player typed for the command', () => {
    expect(fail('esperar(-1);', 'en').hint).not.toMatch(/esperar/);
    expect(fail('move(5);', 'pt-BR').hint).not.toMatch(/move\(/);
  });

  it('are in English when no language is chosen', () => {
    expect(() => createFarm(config).run('log(x);').step(10)).toThrow(/^Line 1: x is not defined/);
  });

  it('translate a mistake found while reading the script, before it runs', () => {
    expect(() => createFarm({ ...config, language: 'pt-BR' }).run('log(1;')).toThrow(/^Linha 1: Símbolo inesperado/);
  });

  it('keep the command names the player wrote, in either language of messages', () => {
    expect(fail('mover(5);', 'en').message).toMatch(/mover expects a direction/);
    expect(fail('move(5);', 'pt-BR').message).toMatch(/move espera uma direção/);
  });

  it('refuse a language the engine does not have', () => {
    expect(() => createFarm({ ...config, language: 'fr' as 'en' })).toThrow(RangeError);
  });
});

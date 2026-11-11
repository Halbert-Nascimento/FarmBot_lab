import { describe, expect, it } from 'vitest';
import { createFarm, LAYER_COUNT, ScriptError, SYNTAX_LAYERS } from './index';
import type { Language } from './index';
import { config } from './test-utils';

/** Tries a script on a farm that has unlocked up to `layer` (everything, if none is given). */
function attempt(source: string, layer?: number, language?: Language) {
  const farm = createFarm({ ...config, layer, language });
  let error: unknown;
  try {
    farm.run(source).step(10_000);
  } catch (caught) {
    error = caught;
  }
  return { error, farm };
}

const lockedBy = (error: unknown): error is ScriptError => error instanceof ScriptError && error.code === 'layerLocked';

/**
 * One script per feature that needs a layer. `reports` is the feature named when the script is refused one
 * layer below, which is the first one in the script that is not unlocked yet. `uses` lists the other
 * features the script exercises (they sit in the same layer or in a lower one).
 */
interface Case {
  readonly layer: number;
  readonly source: string;
  readonly reports: keyof typeof SYNTAX_LAYERS;
  readonly uses?: readonly (keyof typeof SYNTAX_LAYERS)[];
}

const NESTED = 'for (let i = 0; i < 2; i++) {\n  for (let j = 0; j < 2; j++) {\n    move(Dir.EAST);\n  }\n}';

const CASES: Record<string, Case> = {
  literal: { layer: 2, source: 'wait(3);', reports: 'literal' },
  templateString: { layer: 3, source: 'log(`a`);', reports: 'templateString' },
  variable: { layer: 3, source: 'const a = Dir.EAST;', reports: 'variable' },
  assignment: { layer: 3, source: 'x = Dir.EAST;', reports: 'assignment' },
  increment: { layer: 3, source: 'x++;', reports: 'increment' },
  arithmetic: { layer: 3, source: 'log(1 + 2);', reports: 'arithmetic' },
  comparison: { layer: 4, source: 'log(1 < 2);', reports: 'comparison' },
  logical: { layer: 4, source: 'log(true && false);', reports: 'logical' },
  if: { layer: 4, source: 'if (isReady()) {\n  harvest();\n}', reports: 'if' },
  for: { layer: 5, source: 'for (let i = 0; i < 3; i++) {\n  move(Dir.EAST);\n}', reports: 'for' },
  while: { layer: 6, source: 'while (isReady()) {\n  harvest();\n}', reports: 'while' },
  break: { layer: 6, source: 'for (let i = 0; i < 3; i++) {\n  break;\n}', reports: 'break' },
  nestedLoop: { layer: 7, source: NESTED, reports: 'nestedLoop' },
  loopInsideAnotherKind: {
    layer: 7,
    source: 'while (isReady()) {\n  for (let i = 0; i < 2; i++) {\n    harvest();\n  }\n}',
    reports: 'nestedLoop',
  },
  loopsOneAfterTheOther: { layer: 6, source: 'for (let i = 0; i < 2; i++) {\n  move(Dir.EAST);\n}\nwhile (isReady()) {\n  harvest();\n}', reports: 'while' },
  function: { layer: 8, source: 'function f() {\n  move(Dir.EAST);\n}', reports: 'function' },
  arrowFunction: { layer: 8, source: 'const f = () => 1;', reports: 'function', uses: ['functionCall'] },
  return: { layer: 8, source: 'function f() {\n  return 1;\n}', reports: 'function', uses: ['return'] },
  functionCall: { layer: 8, source: 'function f() {}\nf();', reports: 'function', uses: ['functionCall'] },
  list: { layer: 9, source: 'const a = [Dir.EAST];', reports: 'list' },
  listMethod: { layer: 9, source: 'getPos().push(Dir.EAST);', reports: 'listMethod' },
  indexAccess: { layer: 9, source: 'log(getPos()[0]);', reports: 'indexAccess' },
  listLength: { layer: 9, source: 'log(getPos().length);', reports: 'listLength' },
  object: { layer: 10, source: 'const o = {};', reports: 'object' },
  propertyAccess: { layer: 10, source: 'log(getPos().x);', reports: 'propertyAccess' },
};

describe('the layers', () => {
  it('are ten, and the first one needs no unlocking', () => {
    expect(LAYER_COUNT).toBe(10);
    expect(Object.values(SYNTAX_LAYERS).every((layer) => layer >= 2 && layer <= LAYER_COUNT)).toBe(true);
  });

  it('have a script for every layer from 2 to 10 and for every feature the engine knows', () => {
    const layersTested = new Set(Object.values(CASES).map(({ layer }) => layer));
    const featuresTested = new Set(Object.values(CASES).flatMap(({ reports, uses = [] }) => [reports, ...uses]));
    // Features that are only reachable together with another one are listed in `uses`; these are tested by name below.
    const alone = new Set<keyof typeof SYNTAX_LAYERS>(['assignment', 'increment', 'return', 'functionCall']);

    for (let layer = 2; layer <= LAYER_COUNT; layer++) expect(layersTested.has(layer), `layer ${layer}`).toBe(true);
    for (const feature of Object.keys(SYNTAX_LAYERS) as (keyof typeof SYNTAX_LAYERS)[]) {
      expect(featuresTested.has(feature) || alone.has(feature), feature).toBe(true);
    }
  });

  it('say the layer each case needs, the same as the table of the engine', () => {
    for (const [name, { layer, reports }] of Object.entries(CASES)) {
      if (name === 'loopsOneAfterTheOther') continue;
      expect(SYNTAX_LAYERS[reports], name).toBe(layer);
    }
  });
});

describe('the first layer', () => {
  it('lets the commands run in order, with constants as arguments', () => {
    const { error, farm } = attempt('move(Dir.EAST);\nplant(Plant.GRASS);\nharvest();\ngetPos();', 1);

    expect(error).toBeUndefined();
    expect(farm.getState().drone).toEqual({ x: 1, y: 0 });
  });

  it('lets the commands be written in Portuguese too', () => {
    expect(attempt('mover(Dir.LESTE);\nplantar(Planta.CAPIM);', 1).error).toBeUndefined();
  });
});

describe.each(Object.entries(CASES))('%s', (_name, { layer, source, reports }) => {
  it(`is refused one layer below, naming layer ${layer}`, () => {
    const { error } = attempt(source, layer - 1);

    expect(lockedBy(error)).toBe(true);
    expect((error as ScriptError).params).toMatchObject({ feature: reports, layer });
  });

  it(`is allowed in layer ${layer} and in every layer after it`, () => {
    for (let unlocked = layer; unlocked <= LAYER_COUNT; unlocked++) {
      expect(lockedBy(attempt(source, unlocked).error), `layer ${unlocked}`).toBe(false);
    }
  });

  it('is allowed when no layer is chosen (every layer unlocked, like the free mode)', () => {
    expect(lockedBy(attempt(source).error)).toBe(false);
  });
});

describe('a script with something locked', () => {
  it('is refused as a whole, before any command runs', () => {
    const farm = createFarm({ ...config, layer: 1 });

    expect(() => farm.run('move(Dir.EAST);\nplant(Plant.GRASS);\nwait(3);')).toThrow(ScriptError);
    expect(farm.getState().drone).toEqual({ x: 0, y: 0 });
    expect(farm.getState().tick).toBe(0);
    expect(farm.drainEvents()).toEqual([]);
  });

  it('names the first thing locked, by its place in the script', () => {
    const { error } = attempt('move(Dir.EAST);\nconst a = 1;\nwait(3);', 1);

    expect(error).toMatchObject({ code: 'layerLocked', line: 2, params: { feature: 'variable', layer: 3 } });
  });

  it('is refused even when the locked part would never run', () => {
    const { error } = attempt('move(Dir.EAST);\nif (false) {\n  harvest();\n}', 3);

    expect(lockedBy(error)).toBe(true);
  });

  it('is refused inside a function, where it is hidden from the rest of the script', () => {
    const { error } = attempt('function f() {\n  return [Dir.EAST];\n}', 8);

    expect(error).toMatchObject({ code: 'layerLocked', line: 2, params: { feature: 'list', layer: 9 } });
  });
});

describe('what looks like a locked feature but is not', () => {
  it('lets `for`, `while`, brackets and braces inside a text pass', () => {
    const source = 'log("for (let i = 0; i < 3; i++) { while (true) {} } if else function [1, 2] {a: 1}");';

    expect(attempt(source, 2).error).toBeUndefined();
  });

  it('lets brackets in a text pass in the second layer', () => {
    expect(attempt('log("[0] [x] a[1] [[]]");', 2).error).toBeUndefined();
  });

  it('lets names that contain a keyword pass', () => {
    const source = 'let format = 1;\nlet before = 2;\nlet forward = 3;\nlet iffy = 4;\nlet whileTrue = 5;\nlet functional = 6;\nlog(format, before, forward, iffy, whileTrue, functional);';

    expect(attempt(source, 3).error).toBeUndefined();
  });

  it('lets a comment that mentions a feature pass', () => {
    expect(attempt('// for while if function [1] {a: 1}\n/* let x = 1; */\nmove(Dir.EAST);', 1).error).toBeUndefined();
  });

  it('lets a template with a keyword inside pass in the layer that has templates', () => {
    expect(attempt('log(`for while ${1}`);', 3).error).toBeUndefined();
  });

  it('lets a constant of the game be read in the first layer, but not a property of a value', () => {
    expect(attempt('log(Dir.EAST);', 1).error).toBeUndefined();
    expect(lockedBy(attempt('log(getPos().x);', 9).error)).toBe(true);
  });
});

describe('a name the script declares', () => {
  it('only hides a command of the same name where it is in scope', () => {
    expect(lockedBy(attempt('{\n  let move = 1;\n  log(move);\n}\nmove(Dir.EAST);', 3).error)).toBe(false);
  });

  it('only hides a group of constants of the same name where it is in scope', () => {
    expect(lockedBy(attempt('{\n  let Dir = 1;\n  log(Dir);\n}\nmove(Dir.EAST);', 3).error)).toBe(false);
  });

  it('does not hide them inside a function that has a parameter of that name', () => {
    expect(attempt('function f(Dir) {\n  log(Dir.x);\n}', 9).error).toMatchObject({ code: 'layerLocked', params: { feature: 'propertyAccess' } });
  });

  it('makes a call to it a call to a function of the player, in the layer of functions', () => {
    const { error } = attempt('function tend() {}\ntend();', 7);

    expect(error).toMatchObject({ code: 'layerLocked', line: 1, params: { feature: 'function', layer: 8 } });
    expect(lockedBy(attempt('function tend() {}\ntend();', 8).error)).toBe(false);
  });

  it('counts a loop variable as declared only inside its loop', () => {
    expect(lockedBy(attempt('for (let move = 0; move < 2; move++) {\n  log(move);\n}\nmove(Dir.EAST);', 5).error)).toBe(false);
  });
});

describe('a negative number', () => {
  it('is a number written in the code, so the second layer already has it', () => {
    expect(lockedBy(attempt('wait(-1);', 2).error)).toBe(false);
    expect(lockedBy(attempt('wait(-1);', 1).error)).toBe(true);
  });

  it('is still refused as arithmetic when it is a subtraction', () => {
    expect((attempt('log(1 - 1);', 2).error as ScriptError).params).toMatchObject({ feature: 'arithmetic', layer: 3 });
  });
});

describe('syntax the layers do not know', () => {
  // The layers only classify what the interpreter runs. These are refused by the interpreter itself, in every
  // layer. If one of them is ever supported, it must get a layer in `SYNTAX_LAYERS` before it is released.
  it.each([
    ['the ternary operator', 'isReady() ? harvest() : move(Dir.EAST);'],
    ['continue', 'for (let i = 0; i < 2; i++) {\n  continue;\n}'],
    ['for...of', 'for (const a of getPos()) {\n  log(a);\n}'],
    ['try', 'try {\n  harvest();\n} catch (e) {}'],
    ['switch', 'switch (getPos()) {\n  default:\n    harvest();\n}'],
  ])('are refused by the interpreter even with every layer unlocked: %s', (_name, source) => {
    expect(attempt(source).error).toMatchObject({ code: 'unsupported' });
  });
});

describe('a loop inside a function that is called from a loop', () => {
  it('is not counted as nested, because the layers look at how the code is written, not at how it runs', () => {
    const source = 'function sweep() {\n  for (let i = 0; i < 2; i++) {\n    harvest();\n  }\n}\nfor (let j = 0; j < 2; j++) {\n  sweep();\n}';

    expect(lockedBy(attempt(source, 8).error)).toBe(false);
  });
});

describe('the message', () => {
  it('names the feature, the layer that unlocks it and the layer name, in English', () => {
    const { error } = attempt('for (let i = 0; i < 3; i++) {}', 4, 'en');

    expect((error as Error).message).toMatch(/^Line 1: Not unlocked yet: for loops \(layer 5, Counted repetition\) Tip: .+/);
  });

  it('says the same in Portuguese', () => {
    const { error } = attempt('for (let i = 0; i < 3; i++) {}', 4, 'pt-BR');

    expect((error as Error).message).toMatch(/^Linha 1: Ainda não liberado: laços for \(camada 5, Repetição contada\) Dica: .+/);
  });

  it('does not depend on the language the commands were written in', () => {
    const { error } = attempt('mover(Dir.LESTE);\nwhile (isReady()) {}', 5, 'en');

    expect((error as Error).message).toMatch(/Line 2: Not unlocked yet: while loops \(layer 6, Conditional repetition\)/);
  });
});

describe('the configuration', () => {
  it.each([0, 11, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3'])('refuses the layer %s', (layer) => {
    expect(() => createFarm({ ...config, layer: layer as number })).toThrow(RangeError);
  });

  it.each([1, 5, 10])('accepts the layer %i', (layer) => {
    expect(() => createFarm({ ...config, layer })).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES, CONSTANT_PAIRS, createFarm, ScriptError } from './index';
import { config, failure } from './test-utils';

/** One call of each command, where `$` stands for the name being tested. Sensors are logged so their answer is compared. */
const SCENARIOS: Record<keyof typeof COMMAND_NAMES, string> = {
  move: '$(Dir.EAST);',
  plant: 'till();\n$(Plant.GRASS);',
  harvest: 'plant(Plant.GRASS);\nwait(130);\n$();',
  till: '$();',
  wait: '$(7);',
  log: '$(1, "a", [2], { b: 3 });',
  random: 'log($(), $());',
  getPos: 'move(Dir.EAST);\nlog($());',
  getSize: 'log($());',
  getPlant: 'plant(Plant.GRASS);\nlog($());',
  isReady: 'plant(Plant.GRASS);\nwait(130);\nlog($());',
  getTerrain: 'till();\nlog($());',
  getStock: 'log($(Item.HAY), $(Item.WHEAT));',
};

function outcome(source: string) {
  const farm = createFarm(config);
  const run = farm.run(source);
  run.step(10_000);
  return { hash: farm.getStateHash(), events: farm.drainEvents(), meter: run.getMeter().deciticks };
}

describe('every command exists in English and in Portuguese', () => {
  it('has a scenario for exactly the commands the engine declares', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(Object.keys(COMMAND_NAMES).sort());
  });

  it.each(Object.entries(COMMAND_NAMES))('%s and %s do the same thing for the same cost', (english, portuguese) => {
    const scenario = SCENARIOS[english as keyof typeof COMMAND_NAMES];
    const inEnglish = outcome(scenario.replaceAll('$', english));
    const inPortuguese = outcome(scenario.replaceAll('$', portuguese));

    expect(inPortuguese).toEqual(inEnglish);
    expect(inEnglish.events.length + inEnglish.meter).toBeGreaterThan(0);
  });

  it('uses plain letters in the Portuguese names, so they are easy to type', () => {
    for (const portuguese of Object.values(COMMAND_NAMES)) expect(portuguese).toMatch(/^[A-Za-z]+$/);
  });

  it('never repeats a name', () => {
    const names = [...Object.keys(COMMAND_NAMES), ...Object.values(COMMAND_NAMES)];

    expect(new Set(names).size).toBe(names.length);
  });

  it('agrees with the game design on the names it fixes', () => {
    expect(COMMAND_NAMES).toMatchObject({
      move: 'mover',
      plant: 'plantar',
      harvest: 'colher',
      till: 'arar',
      wait: 'esperar',
      log: 'registrar',
      random: 'aleatorio',
      getPos: 'posicao',
      getSize: 'tamanho',
      getStock: 'estoque',
    });
  });

  it('lets one script mix both languages', () => {
    const farm = createFarm(config);
    farm.run('arar();\nplantar(Planta.CAPIM);\nmove(Dir.LESTE);\nregistrar(getPlant(), lerPlanta());').step(1000);

    expect(farm.drainEvents()).toContainEqual(expect.objectContaining({ type: 'logged', values: [null, null] }));
  });
});

describe('every constant exists in English and in Portuguese', () => {
  it('declares the constants the game design names', () => {
    expect(CONSTANT_PAIRS.map(({ english, portuguese }) => `${english} ${portuguese}`)).toEqual(
      expect.arrayContaining([
        'Plant.GRASS Planta.CAPIM',
        'Plant.WHEAT Planta.TRIGO',
        'Terrain.GRASS Terreno.GRAMA',
        'Terrain.TILLED Terreno.ARADO',
        'Item.HAY Item.FENO',
        'Item.WHEAT Item.TRIGO',
        'Dir.NORTH Dir.NORTE',
        'Dir.EAST Dir.LESTE',
        'Dir.SOUTH Dir.SUL',
        'Dir.WEST Dir.OESTE',
      ]),
    );
  });

  it.each(CONSTANT_PAIRS.map((pair) => [pair.english, pair.portuguese]))('%s is the same value as %s', (english, portuguese) => {
    const farm = createFarm(config);
    farm.run(`log(${english} === ${portuguese});`).step(100);

    expect(farm.drainEvents()).toContainEqual(expect.objectContaining({ type: 'logged', values: [true] }));
  });

  it('keeps the plain values the same in both languages, so comparing with a constant works everywhere', () => {
    const farm = createFarm(config);
    farm.run('arar();\nlog(getTerrain() === Terreno.ARADO, lerTerreno() === Terrain.TILLED, Terreno.GRAMA, Planta.TRIGO);').step(1000);

    expect(farm.drainEvents()).toContainEqual(expect.objectContaining({ values: [true, true, 'grass', 'wheat'] }));
  });
});

describe('an unknown name suggests a similar one', () => {
  it.each([
    ['mvoe(Dir.EAST);', 'move'],
    ['plnat(Plant.GRASS);', 'plant'],
    ['harvset();', 'harvest'],
    ['getPso();', 'getPos'],
  ])('%s suggests %s', (source, suggestion) => {
    const error = failure(source);

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(new RegExp(`Line 1: Unknown command: .*Did you mean ${suggestion}\\?`));
  });

  it('suggests a variable or function of the script too', () => {
    const error = failure('const speed = 1;\nlog(sped);');

    expect((error as Error).message).toMatch(/Line 2: sped is not defined.*Did you mean speed\?/);
  });

  it('suggests the constant that was meant', () => {
    expect((failure('log(Dir.NORT);') as Error).message).toMatch(/Line 1: Unknown value: Dir\.NORT.*Did you mean Dir\.NORTH\?/);
  });

  it.each([
    ['Plant.CAPIM', 'Planta.CAPIM'],
    ['Planta.GRASS', 'Plant.GRASS'],
    ['Terreno.GRASS', 'Terreno.GRAMA'],
    ['Dir.North', 'Dir.NORTH'],
  ])('suggests the constant of the other language when they are mixed up: %s', (typed, suggestion) => {
    const error = failure(`log(${typed});`) as ScriptError;

    expect(error.code).toBe('unknownValue');
    expect(error.didYouMean).toBe(suggestion);
  });

  it('does not offer a group of constants where a command was meant, nor a command where a value was meant', () => {
    expect((failure('Dr();') as ScriptError).didYouMean).toBeUndefined();
    expect((failure('const speed = 1;\nlog(sped, Dir);') as ScriptError).didYouMean).toBe('speed');
  });

  it('explains that a group of constants is not a value, with an example', () => {
    const error = failure('move(Dir);') as ScriptError;

    expect(error.code).toBe('constantGroup');
    expect(error.hint).toMatch(/Dir\.NORTH/);
  });

  it('suggests nothing when nothing is close', () => {
    expect((failure('zzzzzzzz();') as Error).message).not.toMatch(/Did you mean/);
  });

  it('prefers the names of the language of the messages when both are equally close', () => {
    const run = (language: 'en' | 'pt-BR') => {
      try {
        createFarm({ ...config, language }).run('movr(Dir.EAST);').step(10);
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    };

    expect(run('en')).toMatch(/Did you mean move\?/);
    expect(run('pt-BR')).toMatch(/Você quis dizer mover\?/);
  });
});

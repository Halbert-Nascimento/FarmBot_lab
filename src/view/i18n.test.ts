import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES, createFarm, LANGUAGES } from '../engine';
import type { FarmEvent, RejectReason } from '../engine';
import { codeAfterLanguageChange, describeEntry, detectLanguage, entryFor, HELP_STEPS, translate } from './i18n';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('the translation files of the interface', () => {
  it('have the same keys in English and in Portuguese', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) expect(placeholders(ptBR[key]), key).toEqual(placeholders(en[key]));
  });

  it('have no empty text', () => {
    for (const text of [...Object.values(en), ...Object.values(ptBR)]) expect(text.trim()).not.toBe('');
  });

  it('explain every command the engine has, in both languages', () => {
    for (const command of Object.keys(COMMAND_NAMES)) {
      expect(en, command).toHaveProperty([`help.cmd.${command}`]);
      expect(ptBR, command).toHaveProperty([`help.cmd.${command}`]);
    }
  });

  it('explain every way the farm can refuse an action', () => {
    const reasons: RejectReason[] = ['occupied', 'needs-tilled-terrain', 'not-enough-hay'];
    for (const reason of reasons) expect(en).toHaveProperty([`reject.${reason}`]);
  });
});

describe('the first script', () => {
  it.each(LANGUAGES)('runs to the end without any mistake in %s', (language) => {
    const farm = createFarm({ width: 3, height: 2, seed: 1 });
    const run = farm.run(translate(language, 'example'));
    run.step(100_000);

    expect(run.isFinished).toBe(true);
    expect(farm.getState().stock.hay).toBe(2);
  });

  it('does the very same thing in both languages', () => {
    const [english, portuguese] = LANGUAGES.map((language) => {
      const farm = createFarm({ width: 3, height: 2, seed: 1 });
      farm.run(translate(language, 'example')).step(100_000);
      return farm.getStateHash();
    });

    expect(portuguese).toBe(english);
  });

  it('uses the command names of its own language', () => {
    expect(translate('pt-BR', 'example')).toMatch(/plantar\(Planta\.CAPIM\)/);
    expect(translate('en', 'example')).toMatch(/plant\(Plant\.GRASS\)/);
  });
});

describe('choosing the language', () => {
  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['PT-br', 'pt-BR'],
    ['en-US', 'en'],
    ['es', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ])('takes %s from the browser as %s', (preferred, expected) => {
    expect(detectLanguage(preferred)).toBe(expected);
  });
});

describe('the instructions', () => {
  it('say what each button does, how to go faster and what a comment is, in both languages', () => {
    for (const language of LANGUAGES) {
      const steps = HELP_STEPS.map((key) => translate(language, key)).join(' ');

      expect(steps).toContain(translate(language, 'ui.run'));
      expect(steps).toContain(translate(language, 'ui.reset'));
      expect(steps).toContain(translate(language, 'ui.pause'));
      expect(steps).toContain(translate(language, 'ui.speed.instant'));
      expect(steps).toContain('//');
    }
  });

  it('tell which way each direction points on the screen', () => {
    expect(translate('pt-BR', 'help.cmd.move')).toMatch(/direita/);
    expect(translate('en', 'help.cmd.move')).toMatch(/right/);
  });
});

describe('the example when the language changes', () => {
  const english = translate('en', 'example');
  const portuguese = translate('pt-BR', 'example');

  it('follows the language while the player has not changed it', () => {
    expect(codeAfterLanguageChange(english, 'en', 'pt-BR')).toBe(portuguese);
    expect(codeAfterLanguageChange(portuguese, 'pt-BR', 'en')).toBe(english);
  });

  it('follows the language even if only blank space was changed', () => {
    expect(codeAfterLanguageChange(`\n${english}  \n\n`, 'en', 'pt-BR')).toBe(portuguese);
  });

  it('is left alone once the player has written something of their own', () => {
    const mine = `${english}move(Dir.EAST);\n`;

    expect(codeAfterLanguageChange(mine, 'en', 'pt-BR')).toBe(mine);
    expect(codeAfterLanguageChange('', 'en', 'pt-BR')).toBe('');
  });
});

describe('filling in a text', () => {
  it('puts the values in their places', () => {
    expect(translate('en', 'console.finished', { ticks: '12.5' })).toBe('Finished in 12.5 ticks.');
    expect(translate('pt-BR', 'console.finished', { ticks: '12.5' })).toBe('Terminou em 12.5 ticks.');
  });
});

describe('a console line', () => {
  const at = { x: 0, y: 0 };
  const events: Record<string, FarmEvent> = {
    logged: { type: 'logged', timeDeciticks: 125, values: ['a', 1, true, null, [1, 2], { x: 1 }] },
    harvested: { type: 'harvested', timeDeciticks: 60, at, species: 'wheat', item: 'wheat', quantity: 1 },
    destroyed: { type: 'destroyed', timeDeciticks: 60, at, species: 'grass' },
    bumped: { type: 'bumped', timeDeciticks: 80, at },
    rejected: { type: 'rejected', timeDeciticks: 60, at, action: 'plant', reason: 'not-enough-hay' },
  };

  it('starts with the tick it happened at, with one decimal place', () => {
    expect(describeEntry(entryFor(events['logged'] as FarmEvent)!, 'en').text).toBe('[12.5] a 1 true null [1, 2] {x: 1}');
  });

  it.each(Object.entries(events))('is written for %s, in both languages', (_type, event) => {
    const entry = entryFor(event);
    expect(entry).toBeDefined();
    const english = describeEntry(entry!, 'en');
    const portuguese = describeEntry(entry!, 'pt-BR');

    expect(english.text).toMatch(/^\[\d+\.\d\] .+/);
    expect(portuguese.text).toMatch(/^\[\d+\.\d\] .+/);
    if (event.type !== 'logged') expect(portuguese.text).not.toBe(english.text);
  });

  it('shows numbers that are not ordinary numbers as what they are, never as null', () => {
    const odd: FarmEvent = { type: 'logged', timeDeciticks: 0, values: [Number.NaN, Number.POSITIVE_INFINITY, undefined, [Number.NaN, 'a'], { n: Number.NEGATIVE_INFINITY }] };

    expect(describeEntry(entryFor(odd)!, 'en').text).toBe('[0.0] NaN Infinity undefined [NaN, "a"] {n: -Infinity}');
  });

  it('is not written for what the scene already shows', () => {
    expect(entryFor({ type: 'moved', timeDeciticks: 80, from: at, to: { x: 1, y: 0 } })).toBeUndefined();
    expect(entryFor({ type: 'planted', timeDeciticks: 60, at, species: 'grass' })).toBeUndefined();
    expect(entryFor({ type: 'tilled', timeDeciticks: 40, at, terrain: 'tilled' })).toBeUndefined();
  });

  it('has a tone, so mistakes and warnings stand out', () => {
    expect(describeEntry(entryFor(events['logged'] as FarmEvent)!, 'en').tone).toBe('log');
    expect(describeEntry(entryFor(events['rejected'] as FarmEvent)!, 'en').tone).toBe('warn');
    expect(describeEntry({ kind: 'error', error: new Error('boom') }, 'en')).toEqual({ text: 'boom', tone: 'error' });
    expect(describeEntry({ kind: 'finished', ticks: '3.0' }, 'en').tone).toBe('info');
  });

  it('names the command of a refusal in the language of the interface', () => {
    expect(describeEntry(entryFor(events['rejected'] as FarmEvent)!, 'pt-BR').text).toBe('[6.0] plantar não deu certo: falta feno no estoque. Colha capim para ter feno.');
  });
});

import { describe, expect, it } from 'vitest';
import { createFarm, ScriptError } from '../engine';
import type { Language } from '../engine';
import { FarmScene } from './farm-scene';
import { describeEntry, translate } from './i18n';
import { Session, SPEEDS } from './session';
import type { Speed } from './player';

const FRAME = 1 / 60;
const FIRST_SCRIPT = translate('en', 'example');

function newSession(language: Language = 'en') {
  return new Session({ width: 3, height: 2, seed: 1, language, scene: new FarmScene(3, 2) });
}

/** Lets real time pass, frame by frame, until the run ends (or a generous limit is reached). */
function playOut(session: Session, frames = 400_000): void {
  for (let frame = 0; frame < frames && (session.status === 'running' || session.status === 'paused'); frame++) {
    if (session.status === 'paused') return;
    session.advance(FRAME);
  }
}

const lines = (session: Session, language: Language = 'en') => session.entries.map((entry) => describeEntry(entry, language).text);

describe('Run', () => {
  it('moves the drone, plants and harvests, as the script says', () => {
    const session = newSession();
    session.run('plant(Plant.GRASS);\nmove(Dir.EAST);\nwait(130);\nmove(Dir.WEST);\nharvest();');
    playOut(session);

    expect(session.status).toBe('finished');
    expect(session.state.drone).toEqual({ x: 0, y: 0 });
    expect(session.state.stock.hay).toBe(1);
    expect(session.scene.snapshot().plants.every((plant) => plant === null)).toBe(true);
  });

  it('shows in the console what the script logged, what was harvested and how long it took', () => {
    const session = newSession();
    session.run(FIRST_SCRIPT);
    playOut(session);

    expect(lines(session)[0]).toBe('Run started. The farm started over from scratch.');
    expect(lines(session)).toContainEqual(expect.stringMatching(/^\[\d+\.\d\] Harvested 1 hay\.$/));
    expect(lines(session)).toContainEqual(expect.stringMatching(/^\[\d+\.\d\] Hay in stock: 2$/));
    expect(lines(session).at(-1)).toMatch(/^Finished in \d+\.\d ticks\.$/);
  });

  it('starts the farm over from scratch every time, so the same script gives the same result', () => {
    const session = newSession();
    session.run(FIRST_SCRIPT);
    playOut(session);
    const first = { hash: session.hash(), meter: session.meter, lines: lines(session) };
    session.run(FIRST_SCRIPT);
    playOut(session);

    expect({ hash: session.hash(), meter: session.meter, lines: lines(session) }).toEqual(first);
  });

  it('gives the same result as the engine on its own', () => {
    const session = newSession();
    session.run(FIRST_SCRIPT);
    playOut(session);
    const alone = createFarm({ width: 3, height: 2, seed: 1 });
    alone.run(FIRST_SCRIPT).step(1_000_000);

    expect(session.hash()).toBe(alone.getStateHash());
  });

  it('stops the run that was going before it starts another: never two at once', () => {
    const session = newSession();
    session.run('while (true) {\n  move(Dir.EAST);\n  move(Dir.WEST);\n  log("first");\n}');
    for (let frame = 0; frame < 600; frame++) session.advance(FRAME);
    session.run('plant(Plant.GRASS);');
    playOut(session);
    const alone = createFarm({ width: 3, height: 2, seed: 1 });
    alone.run('plant(Plant.GRASS);').step(1000);

    expect(session.status).toBe('finished');
    expect(session.hash()).toBe(alone.getStateHash());
    expect(lines(session).join('\n')).not.toMatch(/first/);
  });
});

describe('the meter', () => {
  it('shows the ticks of the run with one decimal place, while it runs and after it ends', () => {
    const session = newSession();

    expect(session.meter).toBe('0.0');
    session.run('let x = 1;\nmove(Dir.EAST);');
    session.advance(0.5);
    expect(session.meter).toMatch(/^\d+\.\d$/);
    playOut(session);
    expect(session.meter).toBe('8.1');
  });

  it('starts again from zero at each run', () => {
    const session = newSession();
    session.run('move(Dir.EAST);\nmove(Dir.WEST);');
    playOut(session);
    session.run('move(Dir.EAST);');
    playOut(session);

    expect(session.meter).toBe('8.0');
  });
});

describe('Pause', () => {
  it('holds the farm still, and going on from there changes nothing in the result', () => {
    const paused = newSession();
    paused.run(FIRST_SCRIPT);
    for (let frame = 0; frame < 300; frame++) paused.advance(FRAME);
    paused.pause();
    const frozen = paused.hash();
    for (let frame = 0; frame < 600; frame++) paused.advance(FRAME);

    expect(paused.status).toBe('paused');
    expect(paused.hash()).toBe(frozen);

    paused.resume();
    playOut(paused);
    const straight = newSession();
    straight.run(FIRST_SCRIPT);
    playOut(straight);

    expect(paused.status).toBe('finished');
    expect(paused.hash()).toBe(straight.hash());
    expect(paused.meter).toBe(straight.meter);
  });

  it('does nothing when no script is running', () => {
    const session = newSession();
    session.pause();
    expect(session.status).toBe('idle');
    session.resume();
    expect(session.status).toBe('idle');
  });
});

describe('Reset', () => {
  it('puts the farm back as it was at the start, without running anything', () => {
    const session = newSession();
    const fresh = session.hash();
    session.run(FIRST_SCRIPT);
    for (let frame = 0; frame < 900; frame++) session.advance(FRAME);
    session.reset();

    expect(session.status).toBe('idle');
    expect(session.hash()).toBe(fresh);
    expect(session.meter).toBe('0.0');
    expect(session.scene.snapshot().plants.every((plant) => plant === null)).toBe(true);
    expect(session.scene.snapshot().drone).toEqual({ x: 0, y: 0 });
    expect(lines(session)).toEqual(['Farm reset.']);

    for (let frame = 0; frame < 600; frame++) session.advance(FRAME);
    expect(session.hash()).toBe(fresh);
  });
});

describe('the speeds', () => {
  it('are 1x, 4x, 16x and instant', () => {
    expect(SPEEDS).toEqual([1, 4, 16, 'instant']);
  });

  it.each(SPEEDS)('give the same result at %s', (speed) => {
    const reference = newSession();
    reference.run(FIRST_SCRIPT);
    playOut(reference);
    const session = newSession();
    session.speed = speed;
    session.run(FIRST_SCRIPT);
    playOut(session);

    expect(session.hash()).toBe(reference.hash());
    expect(session.meter).toBe(reference.meter);
    expect(lines(session)).toEqual(lines(reference));
  });

  it('can be changed in the middle of a run without changing the result', () => {
    const reference = newSession();
    reference.run(FIRST_SCRIPT);
    playOut(reference);
    const session = newSession();
    session.run(FIRST_SCRIPT);
    for (let frame = 0; session.status === 'running' && frame < 400_000; frame++) {
      session.speed = SPEEDS[Math.floor(frame / 120) % SPEEDS.length] as Speed;
      session.advance(FRAME);
    }

    expect(session.hash()).toBe(reference.hash());
  });
});

describe('mistakes in the script', () => {
  it('shows a mistake found before running, with its line, and leaves the farm untouched', () => {
    const session = newSession();
    const fresh = session.hash();
    session.run('move(Dir.EAST);\nmove(;');

    expect(session.status).toBe('failed');
    expect(session.hash()).toBe(fresh);
    expect(lines(session).at(-1)).toMatch(/^Line 2: Unexpected token\. Tip: /);
    expect(describeEntry(session.entries.at(-1)!, 'en').tone).toBe('error');
  });

  it('shows a mistake found while running, after what already happened', () => {
    const session = newSession();
    session.run('move(Dir.EAST);\nmvoe(Dir.EAST);');
    playOut(session);

    expect(session.status).toBe('failed');
    expect(session.state.drone).toEqual({ x: 1, y: 0 });
    expect(lines(session).at(-1)).toMatch(/^Line 2: Unknown command: mvoe\. Did you mean move\? Tip: /);
    expect(session.entries.at(-1)).toMatchObject({ kind: 'error', error: expect.any(ScriptError) });
  });

  it('explains a refusal of the farm in plain words', () => {
    const session = newSession();
    session.run('plant(Plant.WHEAT);\nplant(Plant.GRASS);\nplant(Plant.GRASS);\nharvest();\nmove(Dir.NORTH);');
    playOut(session);

    expect(lines(session)).toContainEqual(expect.stringMatching(/plant did not work: this plant needs tilled soil\. Use till\(\) first\./));
    expect(lines(session)).toContainEqual(expect.stringMatching(/plant did not work: the cell already has a plant\./));
    expect(lines(session)).toContainEqual(expect.stringMatching(/harvested before it was ready and was lost/));
    expect(lines(session)).toContainEqual(expect.stringMatching(/tried to leave the field/));
  });

  it('lets the player fix the script and run again', () => {
    const session = newSession();
    session.run('mvoe(Dir.EAST);');
    playOut(session);
    session.run('move(Dir.EAST);');
    playOut(session);

    expect(session.status).toBe('finished');
    expect(session.state.drone).toEqual({ x: 1, y: 0 });
  });
});

describe('the language', () => {
  it('is the language of the errors of the next run', () => {
    const session = newSession('pt-BR');
    session.run('movr(Dir.LESTE);');
    playOut(session);

    expect(lines(session, 'pt-BR').at(-1)).toMatch(/^Linha 1: Comando desconhecido: movr\. Você quis dizer mover\? Dica: /);
  });

  it('can change at any time, and what is already in the console changes with it', () => {
    const session = newSession('en');
    session.run('log("oi");\nharvset();');
    playOut(session);
    session.language = 'pt-BR';

    expect(lines(session, 'pt-BR')[0]).toBe('Execução iniciada. A fazenda recomeçou do zero.');
    expect(lines(session, 'pt-BR').at(-1)).toMatch(/^Linha 2: Comando desconhecido: harvset\. Você quis dizer /);
  });

  it('does not change which commands are accepted', () => {
    const session = newSession('en');
    session.run(translate('pt-BR', 'example'));
    playOut(session);

    expect(session.status).toBe('finished');
    expect(session.state.stock.hay).toBe(2);
  });
});

describe('the console', () => {
  it('keeps only the most recent lines when a script writes without end', () => {
    const session = newSession();
    session.speed = 'instant';
    session.run('for (let i = 0; i < 5000; i++) {\n  log(i);\n  wait(1);\n}');
    playOut(session);

    expect(session.entries.length).toBeLessThanOrEqual(300);
    expect(lines(session).at(-1)).toMatch(/^Finished in /);
    expect(lines(session).at(-2)).toMatch(/4999$/);
  });
});

import './style.css';
import type { Language } from '../engine';
import { createApp } from './app';
import { DEMOS } from './demos';
import { describeEntry, detectLanguage } from './i18n';
import type { Speed } from './player';

/**
 * Starts the disposable prototype page. The address can set things up for testing, for example
 * ?w=16&h=16&demo=sweep&speed=16&autorun=1 . Nothing here decides anything about the farm.
 */
const params = new URLSearchParams(window.location.search);
const LANGUAGE_KEY = 'farmbot.language';

/** A whole number from the address, or the default when it is missing or makes no sense. */
function wholeNumber(name: string, fallback: number): number {
  const value = Number(params.get(name));
  return params.has(name) && Number.isInteger(value) && value > 0 ? value : fallback;
}

function remembered(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function remember(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // A browser that refuses to store anything still plays the game.
  }
}

const speedParam = params.get('speed');
const requestedSpeed = Number(speedParam);
const speed: Speed | undefined =
  speedParam === 'instant' ? 'instant' : speedParam !== null && Number.isFinite(requestedSpeed) && requestedSpeed > 0 ? requestedSpeed : undefined;

const root = document.querySelector<HTMLDivElement>('#app');
if (root) {
  const app = createApp(root, {
    width: wholeNumber('w', 3),
    height: wholeNumber('h', 2),
    seed: wholeNumber('seed', 1),
    // The address wins, then what the player chose before, then what the browser prefers.
    language: detectLanguage(params.get('lang') ?? remembered() ?? window.navigator.language),
    code: DEMOS[params.get('demo') ?? ''],
    speed,
    onLanguage: remember,
  });
  if (params.has('autorun')) {
    app.session.run(app.getCode());
    if (params.has('paused')) app.session.pause();
  }

  /** A handle for whoever tests the page by hand or by script. */
  Object.assign(window, {
    __farmbot: {
      advanceTicks: (ticks: number) => app.session.advanceTicks(ticks),
      snapshot: () => app.session.scene.snapshot(),
      stats: () => app.stats(),
      frameTimes: () => app.frameTimes(),
      hash: () => app.session.hash(),
      state: () => app.session.state,
      status: () => app.session.status,
      meter: () => app.session.meter,
      lines: () => app.session.entries.map((entry) => describeEntry(entry, app.language()).text),
      finished: () => app.session.status === 'finished' || app.session.status === 'failed',
      getCode: () => app.getCode(),
      setCode: (code: string) => app.setCode(code),
      /** How long it takes to read the engine state and bring the whole scene to it, in milliseconds. */
      syncCost: () => {
        const runs = 100;
        const start = performance.now();
        for (let i = 0; i < runs; i++) app.session.scene.sync(app.session.state);
        return { runs, meanMs: (performance.now() - start) / runs };
      },
    },
  });
}

import { COMMAND_NAMES } from '../engine';
import type { Language } from '../engine';
import { CameraController } from './camera-controller';
import { createEditor } from './editor';
import { FarmScene } from './farm-scene';
import { codeAfterLanguageChange, describeEntry, HELP_STEPS, translate } from './i18n';
import type { UiKey } from './i18n';
import type { Speed } from './player';
import { Session, SPEEDS } from './session';
import { shouldHandleShortcut } from './shortcuts';
import { stressPlants, summarizeFrames } from './stress';
import type { FrameSample } from './stress';
import { createStage } from './stage';

export interface AppOptions {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly language: Language;
  /** The code the editor opens with. Left out, it is the first script, in the language of the interface. */
  readonly code?: string;
  readonly speed?: Speed;
  /** The stress field: made-up plants of both kinds and all stages, and a frame counter. A tool for judging the cameras, not part of the game. */
  readonly stress?: boolean;
  /** The angle and elevation of the isometric camera, in radians. By default it looks the same way as the perspective one. */
  readonly isometricYaw?: number;
  readonly isometricPitch?: number;
  /** Called when the player picks a language, so the choice can be remembered. */
  readonly onLanguage?: (language: Language) => void;
}

/** What the page hands to whoever tests it by hand or by script. It can press the buttons, never change the rules. */
export interface AppHandle {
  readonly session: Session;
  readonly cameras: CameraController;
  getCode(): string;
  setCode(code: string): void;
  language(): Language;
  /** The stress field's frame counter, as the page shows it. */
  frameSummary(): { fps: number; worstMs: number; frames: number };
  frameTimes(): number[];
  stats(): Record<string, number>;
}

/** The commands that take something between the parentheses, to show them as `name(...)` in the help. */
const TAKES_ARGUMENTS: ReadonlySet<string> = new Set(['move', 'plant', 'wait', 'log', 'getStock']);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.append(node);
  return node;
}

/**
 * The interface: it lays out the editor, the scene and the console, and passes messages between them.
 * It is the only part that knows all three. The editor only holds text and the scene only draws: neither
 * knows anything else. The session runs the farm and keeps the scene up to date with it, and knows
 * nothing about the editor or the page.
 */
export function createApp(root: HTMLElement, options: AppOptions): AppHandle {
  let language = options.language;
  const text = (key: UiKey, values?: Record<string, unknown>) => translate(language, key, values);

  // ---- layout ----
  root.classList.add('app');
  const topbar = element('header', 'topbar', root);
  const title = element('h1', '', topbar);
  const subtitle = element('span', 'subtitle', topbar);
  const languageButton = element('button', 'language', topbar);
  languageButton.type = 'button';

  const workspace = element('main', 'workspace', root);
  const left = element('section', 'left', workspace);
  const help = element('details', 'help', left);
  help.open = true;
  const helpTitle = element('summary', '', help);
  const steps = element('ol', 'steps', help);
  const stepItems = HELP_STEPS.map((key) => ({ key, item: element('li', '', steps) }));
  const ticksNote = element('p', 'note', help);
  const commands = element('details', 'commands', help);
  const commandsTitle = element('summary', '', commands);
  const commandList = element('ul', '', commands);
  const bilingualNote = element('p', 'note', commands);

  const editorTitle = element('h2', 'panel-title', left);
  const editorHost = element('div', 'editor', left);
  const toolbar = element('div', 'toolbar', left);
  const runButton = element('button', 'run', toolbar);
  const pauseButton = element('button', 'pause', toolbar);
  const resetButton = element('button', 'reset', toolbar);
  for (const button of [runButton, pauseButton, resetButton]) button.type = 'button';
  const speedGroup = element('div', 'speeds', toolbar);
  speedGroup.setAttribute('role', 'group');
  const speedLabel = element('span', 'speed-label', speedGroup);
  const speedButtons = SPEEDS.map((speed) => {
    const button = element('button', 'speed', speedGroup);
    button.type = 'button';
    button.dataset['speed'] = String(speed);
    return { speed, button };
  });

  const right = element('section', 'right', workspace);
  const sceneTitle = element('h2', 'panel-title', right);
  // In a strip of its own, above the scene: laid over the field it would hide plants, which is what is being judged.
  const stressPanel = element('div', 'stress-panel', right);
  const stressNote = element('div', 'stress-note', stressPanel);
  const stressFps = element('div', 'stress-fps', stressPanel);
  stressPanel.hidden = !options.stress;
  const sceneHost = element('div', 'scene', right);
  const cameraBar = element('div', 'camera-bar', sceneHost);
  const cameraButton = element('button', 'camera', cameraBar);
  const followButton = element('button', 'follow', cameraBar);
  const zoomLabel = element('span', 'zoom', cameraBar);
  for (const button of [cameraButton, followButton]) button.type = 'button';
  const readout = element('div', 'readout', right);
  const meterLabel = element('span', 'meter', readout);
  const hayLabel = element('span', 'stock hay', readout);
  const wheatLabel = element('span', 'stock wheat', readout);
  const statusLabel = element('span', 'status', readout);

  const consolePanel = element('footer', 'console', root);
  const consoleTitle = element('h2', 'panel-title', consolePanel);
  const consoleLines = element('div', 'console-lines', consolePanel);
  consoleLines.setAttribute('role', 'log');
  consoleLines.setAttribute('aria-live', 'polite');

  // ---- the three parts, which do not know each other ----
  const scene = new FarmScene(options.width, options.height);
  const session = new Session({ width: options.width, height: options.height, seed: options.seed, language, scene });
  if (options.speed !== undefined) session.speed = options.speed;
  const cameras = new CameraController(options.width, options.height, {
    isometricYaw: options.isometricYaw,
    isometricPitch: options.isometricPitch,
  });
  const stage = createStage(sceneHost, scene, cameras);
  if (options.stress) scene.showMadeUpPlants(stressPlants(options.width, options.height));
  const run = (): void => {
    // The made-up plants are not part of the farm: running the script brings the real farm back.
    scene.clearMadeUpPlants();
    stressPanel.hidden = true;
    session.run(editor.getCode());
  };
  const editor = createEditor(editorHost, options.code ?? text('example'), run);

  // ---- texts that only change with the language ----
  function renderTexts(): void {
    document.documentElement.lang = language;
    document.title = text('ui.title');
    title.textContent = text('ui.title');
    subtitle.textContent = text('ui.subtitle');
    languageButton.textContent = text('ui.switchLanguage');
    languageButton.title = text('ui.switchLanguage.hint');
    helpTitle.textContent = text('help.title');
    for (const { key, item } of stepItems) item.textContent = text(key);
    ticksNote.textContent = text('help.ticks');
    commandsTitle.textContent = text('help.commands.title');
    commandList.replaceChildren(
      ...Object.entries(COMMAND_NAMES).map(([english, portuguese]) => {
        const item = document.createElement('li');
        const name = element('code', '', item);
        name.textContent = `${language === 'pt-BR' ? portuguese : english}(${TAKES_ARGUMENTS.has(english) ? '…' : ''})`;
        item.append(` ${text(`help.cmd.${english}` as UiKey)}`);
        return item;
      }),
    );
    bilingualNote.textContent = text('help.bilingual');
    editorTitle.textContent = text('ui.editor');
    sceneTitle.textContent = text('ui.scene');
    consoleTitle.textContent = text('ui.console');
    runButton.textContent = `▶ ${text('ui.run')}`;
    runButton.title = 'Ctrl+Enter';
    resetButton.textContent = `↺ ${text('ui.reset')}`;
    speedLabel.textContent = `${text('ui.speed')}:`;
    cameraButton.title = text('ui.camera.hint');
    followButton.title = text('ui.follow.hint');
    followButton.textContent = `${text('ui.follow')} [F]`;
    stressNote.textContent = text('stress.note');
    for (const { speed, button } of speedButtons) {
      button.textContent = speed === 'instant' ? text('ui.speed.instant') : `${speed}×`;
    }
  }

  // ---- what changes while the game runs ----
  let shownRevision = -1;
  let shownLanguage: Language | undefined;

  function renderConsole(): void {
    if (session.revision === shownRevision && language === shownLanguage) return;
    shownRevision = session.revision;
    shownLanguage = language;
    if (session.entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'line empty';
      empty.textContent = text('ui.console.empty');
      consoleLines.replaceChildren(empty);
      return;
    }
    consoleLines.replaceChildren(
      ...session.entries.map((entry) => {
        const { text: content, tone } = describeEntry(entry, language);
        const line = document.createElement('div');
        line.className = `line ${tone}`;
        line.textContent = content;
        return line;
      }),
    );
    consoleLines.scrollTop = consoleLines.scrollHeight;
  }

  function renderStatus(): void {
    const { status } = session;
    const { stock } = session.state;
    meterLabel.textContent = `${text('ui.meter')}: ${session.meter}`;
    hayLabel.textContent = `${text('item.hay')}: ${stock.hay}`;
    wheatLabel.textContent = `${text('item.wheat')}: ${stock.wheat}`;
    statusLabel.textContent = text(`status.${status}`);
    statusLabel.dataset['status'] = status;
    pauseButton.textContent = status === 'paused' ? `▶ ${text('ui.resume')}` : `⏸ ${text('ui.pause')}`;
    pauseButton.disabled = status !== 'running' && status !== 'paused';
    for (const { speed, button } of speedButtons) button.setAttribute('aria-pressed', String(session.speed === speed));
    const camera = cameras.stats();
    cameraButton.textContent = `${text('ui.camera')}: ${text(`ui.camera.${camera.kind}`)} [C]`;
    followButton.setAttribute('aria-pressed', String(camera.follow));
    zoomLabel.textContent = `${text('ui.zoom')} ${camera.zoom.toFixed(1)}×`;
  }

  // The list of commands opens below the fold of the help: bring it into view.
  commands.addEventListener('toggle', () => {
    if (commands.open) commands.scrollIntoView({ block: 'start' });
  });

  // ---- the cameras: a button or a key, never while the player is typing ----
  cameraButton.addEventListener('click', () => cameras.toggleKind());
  followButton.addEventListener('click', () => cameras.toggleFollow());
  document.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const action = shouldHandleShortcut({
      key: event.key,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      alt: event.altKey,
      inTextField: target?.closest('.cm-editor, input, textarea, select, [contenteditable]') != null,
    });
    if (action === 'toggle-camera') cameras.toggleKind();
    if (action === 'toggle-follow') cameras.toggleFollow();
  });

  // ---- the buttons ----
  runButton.addEventListener('click', run);
  pauseButton.addEventListener('click', () => {
    if (session.status === 'paused') session.resume();
    else session.pause();
  });
  resetButton.addEventListener('click', () => session.reset());
  for (const { speed, button } of speedButtons) button.addEventListener('click', () => (session.speed = speed));
  languageButton.addEventListener('click', () => {
    const previous = language;
    language = language === 'en' ? 'pt-BR' : 'en';
    session.language = language;
    // The example follows the language, unless the player has already written code of their own.
    const code = editor.getCode();
    const next = codeAfterLanguageChange(code, previous, language);
    if (next !== code) editor.setCode(next);
    renderTexts();
    options.onLanguage?.(language);
  });

  // ---- the loop: time passes, the scene animates, the page shows it ----
  const frameTimes: number[] = [];
  const samples: FrameSample[] = [];
  let last = performance.now();
  function frame(now: number): void {
    const elapsed = now - last;
    last = now;
    frameTimes.push(elapsed);
    if (frameTimes.length > 240) frameTimes.shift();
    samples.push({ at: now, ms: elapsed });
    while (samples.length > 0 && now - (samples[0] as FrameSample).at > 4000) samples.shift();
    const seconds = Math.min(0.1, elapsed / 1000);
    session.advance(seconds);
    scene.update(seconds);
    cameras.update(seconds, scene.droneWorld());
    stage.render();
    if (!stressPanel.hidden) {
      const summary = summarizeFrames(samples, now);
      stressFps.textContent = text('stress.fps', { fps: summary.fps.toFixed(1), worst: summary.worstMs.toFixed(1) });
    }
    renderStatus();
    renderConsole();
    requestAnimationFrame(frame);
  }
  renderTexts();
  renderStatus();
  renderConsole();
  requestAnimationFrame(frame);

  return {
    session,
    cameras,
    frameSummary: () => summarizeFrames(samples, performance.now()),
    getCode: () => editor.getCode(),
    setCode: (code) => editor.setCode(code),
    language: () => language,
    frameTimes: () => [...frameTimes],
    stats: () => ({ ...scene.stats(), ...stage.stats() }),
  };
}

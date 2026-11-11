import { COMMAND_NAMES } from '../engine';
import type { Language } from '../engine';
import { createEditor } from './editor';
import { FarmScene } from './farm-scene';
import { codeAfterLanguageChange, describeEntry, HELP_STEPS, translate } from './i18n';
import type { UiKey } from './i18n';
import type { Speed } from './player';
import { Session, SPEEDS } from './session';
import { createStage } from './stage';

export interface AppOptions {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly language: Language;
  /** The code the editor opens with. Left out, it is the first script, in the language of the interface. */
  readonly code?: string;
  readonly speed?: Speed;
  /** Called when the player picks a language, so the choice can be remembered. */
  readonly onLanguage?: (language: Language) => void;
}

/** What the page hands to whoever tests it by hand or by script. It can press the buttons, never change the rules. */
export interface AppHandle {
  readonly session: Session;
  getCode(): string;
  setCode(code: string): void;
  language(): Language;
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
  const sceneHost = element('div', 'scene', right);
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
  const stage = createStage(sceneHost, scene);
  const run = (): void => session.run(editor.getCode());
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
  }

  // The list of commands opens below the fold of the help: bring it into view.
  commands.addEventListener('toggle', () => {
    if (commands.open) commands.scrollIntoView({ block: 'start' });
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
  let last = performance.now();
  function frame(now: number): void {
    const elapsed = now - last;
    last = now;
    frameTimes.push(elapsed);
    if (frameTimes.length > 240) frameTimes.shift();
    const seconds = Math.min(0.1, elapsed / 1000);
    session.advance(seconds);
    scene.update(seconds);
    stage.render();
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
    getCode: () => editor.getCode(),
    setCode: (code) => editor.setCode(code),
    language: () => language,
    frameTimes: () => [...frameTimes],
    stats: () => ({ ...scene.stats(), ...stage.stats() }),
  };
}

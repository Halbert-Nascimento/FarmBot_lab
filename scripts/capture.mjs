// Visual validation of the 3D scene in a real browser (issue 11). Not part of the game and not run by the CI.
//
//   pnpm dev            (in another terminal)
//   node scripts/capture.mjs <milestone> <output folder> [address]
//
// milestone: 1 (structure), 2 (integration), 3 (scale) or 4 (the interface: editor, console, buttons). It saves screenshots and a console log in the folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const [milestone, outDir, address = 'http://localhost:5173'] = process.argv.slice(2);
if (!milestone || !outDir) {
  console.error('usage: node scripts/capture.mjs <1|2|3|4> <output folder> [address]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on('console', (message) => note(`[console.${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => note(`[pageerror] ${error.message}`));
page.on('requestfailed', (request) => note(`[requestfailed] ${request.url()}`));

async function open(query) {
  await page.goto(`${address}/?${query}`);
  await page.waitForFunction(() => window.__farmbot);
  await page.waitForTimeout(400);
}

async function shot(name, settleMs = 900) {
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  const state = await page.evaluate(() => window.__farmbot.state());
  const plants = state.field.cells.filter((cell) => cell.plant);
  const stages = Object.fromEntries(
    ['sprout', 'growing', 'ready'].map((stage) => [stage, plants.filter((cell) => cell.plant.stage === stage).length]),
  );
  note(`[shot] ${name}: tick ${state.tick}, drone ${JSON.stringify(state.drone)}, stock ${JSON.stringify(state.stock)}, plants ${plants.length} ${JSON.stringify(stages)}`);
}

const advance = (ticks) => page.evaluate((count) => window.__farmbot.advanceTicks(count), ticks);

const renderer = async () =>
  page.evaluate(() => {
    const gl = document.querySelector('canvas')?.getContext('webgl2') ?? document.querySelector('canvas')?.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });

if (milestone === '1') {
  await open('w=3&h=2&demo=garden&autorun=1&paused=1');
  note(`[renderer] ${await renderer()}`);
  await shot('marco-1-campo-3x2');
  await open('w=16&h=16&demo=sweep&autorun=1&paused=1');
  await shot('marco-1-campo-16x16-vazio');
  await advance(1500);
  await shot('marco-1-campo-16x16-1500-ticks');
}

if (milestone === '2') {
  await open('w=3&h=2&demo=garden&autorun=1&paused=1');
  note(`[renderer] ${await renderer()}`);
  let done = 0;
  // [tick, ms to wait before the picture]: a short wait catches the dust of a harvest in the air.
  for (const [target, settle] of [[0], [7], [40], [90], [135], [160, 220], [175], [215], [270], [330], [370], [380], [400]]) {
    await advance(target - done);
    done = target;
    await shot(`marco-2-tick-${String(target).padStart(3, '0')}`, settle);
  }
  const hash = await page.evaluate(() => window.__farmbot.hash());
  note(`[hash] ${hash}`);
  // The same script at three paces ends in the same state.
  const hashes = {};
  for (const speed of ['1', '16', 'instant']) {
    await open(`w=3&h=2&demo=garden&autorun=1&speed=${speed}`);
    await page.waitForFunction(() => window.__farmbot.finished(), null, { timeout: speed === '1' ? 90_000 : 20_000 });
    hashes[speed] = await page.evaluate(() => window.__farmbot.hash());
  }
  note(`[hash por velocidade] ${JSON.stringify(hashes)}`);
}

if (milestone === '3') {
  await open('w=32&h=32&demo=sweep&autorun=1&paused=1');
  note(`[renderer] ${await renderer()}`);
  await shot('marco-3-campo-32x32-vazio');
  await advance(7000);
  await shot('marco-3-campo-32x32-7000-ticks');
  await advance(9000);
  await shot('marco-3-campo-32x32-16000-ticks');
  const stats = await page.evaluate(() => window.__farmbot.stats());
  note(`[stats] ${JSON.stringify(stats)}`);
  const cost = await page.evaluate(() => window.__farmbot.syncCost());
  note(`[custo de sincronizar o estado] ${JSON.stringify(cost)}`);
  // Real time at 16x: frame times while the scene is drawing and animating.
  await open('w=32&h=32&demo=sweep&autorun=1&speed=16');
  await page.waitForTimeout(6000);
  const frames = (await page.evaluate(() => window.__farmbot.frameTimes())).slice(30);
  frames.sort((a, b) => a - b);
  const mean = frames.reduce((sum, value) => sum + value, 0) / frames.length;
  note(`[quadros a 16x] ${frames.length} quadros, media ${mean.toFixed(1)} ms (${(1000 / mean).toFixed(1)} fps), p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms, pior ${frames.at(-1).toFixed(1)} ms`);
  await shot('marco-3-campo-32x32-tempo-real-16x');
}


if (milestone === '4') {
  const farmbot = (name, ...args) => page.evaluate(([method, rest]) => window.__farmbot[method](...rest), [name, args]);
  const finished = (timeout = 60_000) => page.waitForFunction(() => window.__farmbot.finished(), null, { timeout });
  const speedButton = (speed) => page.click(`button.speed[data-speed="${speed}"]`);
  const report = async (label) => note(`[${label}] status ${await farmbot('status')}, ticks ${await farmbot('meter')}, hash ${await farmbot('hash')}`);

  // 1. First use, in Portuguese: what a person sees on opening the page.
  await open('lang=pt-BR');
  note(`[renderer] ${await renderer()}`);
  const fresh = await farmbot('hash');
  await shot('marco-4-01-abertura-pt');

  // 2. Run, pause, resume.
  await page.click('button.run');
  await page.waitForTimeout(2500);
  await shot('marco-4-02-executando', 0);
  await page.click('button.pause');
  const frozen = await farmbot('hash');
  await page.waitForTimeout(1200);
  note(`[pausa] parado: ${frozen === (await farmbot('hash'))}, status ${await farmbot('status')}`);
  await shot('marco-4-03-pausado', 0);
  await page.click('button.pause');
  await speedButton(16);
  await finished();
  await shot('marco-4-04-terminou');
  await report('primeira execucao');
  note(`[console]\n${(await farmbot('lines')).join('\n')}`);

  // 3. Reset puts the farm back at the start.
  await page.click('button.reset');
  await shot('marco-4-05-reiniciado');
  note(`[reiniciar] igual ao inicio: ${fresh === (await farmbot('hash'))}, status ${await farmbot('status')}, ticks ${await farmbot('meter')}`);

  // 4. The four speeds end in the same state.
  const results = {};
  for (const speed of ['1', '4', '16', 'instant']) {
    await speedButton(speed);
    await page.click('button.run');
    await finished(90_000);
    results[speed] = `${await farmbot('hash')} em ${await farmbot('meter')} ticks`;
  }
  note(`[velocidades] ${JSON.stringify(results)}`);

  // 5. A person types a script and runs it with the keyboard.
  await page.click('.cm-content');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type('mover(Dir.LESTE);\nplantar(Planta.CAPIM);\nregistrar(posicao());', { delay: 5 });
  note(`[digitado]\n${await farmbot('getCode')}`);
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction(() => window.__farmbot.lines().some((line) => line.includes('x: 1')), null, { timeout: 20_000 });
  await finished();
  await shot('marco-4-06-script-digitado');
  await report('script digitado');
  note(`[console]\n${(await farmbot('lines')).join('\n')}`);

  // 6. A mistake, and a refusal of the farm.
  await farmbot('setCode', 'plantar(Planta.TRIGO);\nmover(Dir.NORTE);\nplnatar(Planta.CAPIM);');
  await page.click('button.run');
  await finished();
  await shot('marco-4-07-erro-pt');
  note(`[console]\n${(await farmbot('lines')).join('\n')}`);

  // 7. The other language: the interface, the help and the console all change.
  await page.click('button.language');
  await shot('marco-4-08-erro-en');
  note(`[console en]\n${(await farmbot('lines')).join('\n')}`);
  await page.click('details.commands > summary');
  await shot('marco-4-09-ajuda-comandos-en');

  // 8. A fresh page in English shows the example in English.
  await open('lang=en');
  await shot('marco-4-10-abertura-en');
  note(`[exemplo en] ${(await farmbot('getCode')).split('\n')[1]}`);

  // 9. A narrow window.
  await page.setViewportSize({ width: 420, height: 820 });
  await open('lang=pt-BR');
  await shot('marco-4-11-janela-estreita');
}

writeFileSync(join(outDir, `console-marco-${milestone}.log`), `${log.join('\n')}\n`);
await browser.close();

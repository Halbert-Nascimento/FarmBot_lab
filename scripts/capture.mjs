// Visual validation of the 3D scene in a real browser (issue 11). Not part of the game and not run by the CI.
//
//   pnpm dev            (in another terminal)
//   node scripts/capture.mjs <milestone> <output folder> [address]
//
// milestone: 1 (structure), 2 (integration), 3 (scale) or 4 (the interface: editor, console, buttons) or 5 (the two cameras, the stress field). It saves screenshots and a console log in the folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const [milestone, outDir, address = 'http://localhost:5173'] = process.argv.slice(2);
if (!milestone || !outDir) {
  console.error('usage: node scripts/capture.mjs <1|2|3|4|5> <output folder> [address]');
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


if (milestone === '5') {
  const farmbot = (name, ...args) => page.evaluate(([method, rest]) => window.__farmbot[method](...rest), [name, args]);
  const camera = () => farmbot('camera');
  // A click on the title puts the focus on the page itself, not in the editor, so that the keys are shortcuts.
  const focusPage = () => page.click('.topbar h1');
  const press = async (key) => {
    await focusPage();
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  };
  const toIsometric = async () => {
    if ((await camera()).kind !== 'isometric') await press('c');
  };
  const toPerspective = async () => {
    if ((await camera()).kind !== 'perspective') await press('c');
  };
  const cameraNote = async (label) => {
    const c = await camera();
    note(`[camera] ${label}: ${c.kind}, zoom ${c.zoom.toFixed(2)}, segue ${c.follow}, alvo (${c.targetX.toFixed(1)}, ${c.targetZ.toFixed(1)})`);
  };
  const both = async (name, settleMs = 900) => {
    for (const kind of ['perspective', 'isometric']) {
      if (kind === 'isometric') await toIsometric();
      else await toPerspective();
      await shot(`marco-5-${name}-${kind === 'isometric' ? 'iso' : 'persp'}`, settleMs);
      await cameraNote(`${name}`);
    }
  };

  await open('lang=pt-BR&w=3&h=2&demo=garden&autorun=1&paused=1');
  note(`[renderer] ${await renderer()}`);

  // 1. Same drone, same cell, same world: the 3x2 farm with the wheat ripe and the drone standing over it.
  await farmbot('advanceTicks', 380);
  await both('3x2-zoom1');
  await farmbot('setZoom', 3);
  await farmbot('setFollow', true);
  await both('3x2-zoom3-segue', 3200);

  // 2. 16x16.
  await open('lang=pt-BR&w=16&h=16&demo=sweep&autorun=1&paused=1');
  await farmbot('advanceTicks', 1500);
  await both('16x16-zoom1');
  await farmbot('setZoom', 4);
  await farmbot('setFollow', true);
  await both('16x16-zoom4-segue', 3200);

  // 3. 32x32 with the real sweep.
  await open('lang=pt-BR&w=32&h=32&demo=sweep&autorun=1&paused=1');
  await farmbot('advanceTicks', 7000);
  await both('32x32-zoom1');
  await farmbot('setZoom', 5);
  await farmbot('setFollow', false);
  await both('32x32-zoom5-sem-seguir', 1500);
  await farmbot('setFollow', true);
  await both('32x32-zoom5-segue', 3200);
  const hash32 = await farmbot('hash');
  const ticks32 = await farmbot('meter');

  // 4. The stress field: made-up plants of both kinds and the three stages, and the frame counter.
  await open('lang=pt-BR&stress=1');
  await toPerspective();
  await both('estresse-zoom1');
  await farmbot('setZoom', 5);
  await both('estresse-zoom5', 1500);
  await farmbot('setZoom', 1);
  const frames = {};
  for (const kind of ['perspective', 'isometric']) {
    if (kind === 'isometric') await toIsometric();
    else await toPerspective();
    await page.waitForTimeout(5500);
    const summary = await farmbot('frameSummary');
    const stats = await farmbot('stats');
    frames[kind] = { fps: Number(summary.fps.toFixed(1)), pior_ms: Number(summary.worstMs.toFixed(1)), quadros: summary.frames, chamadas: stats.calls, triangulos: stats.triangles, plantas_falsas: stats.madeUpPlants };
    note(`[fps estresse] ${kind}: ${JSON.stringify(frames[kind])}`);
  }

  // 5. Keys: C and F do nothing while the player types, and switching never touches the simulation.
  await open('lang=pt-BR&w=3&h=2&demo=garden&autorun=1&paused=1');
  await farmbot('advanceTicks', 100);
  const before = { hash: await farmbot('hash'), meter: await farmbot('meter'), kind: (await camera()).kind, code: await farmbot('getCode') };
  await page.click('.cm-content');
  await page.keyboard.press('End');
  await page.keyboard.type('c f C F');
  const typed = await camera();
  note(`[tecla no editor] camera ${typed.kind}, segue ${typed.follow} (esperado: isometric, false: o jogo abre na isometrica, sem seguir o drone); texto digitado: ${(await farmbot('getCode')).includes('c f C F')}`);
  await page.keyboard.press('Control+Z');
  await press('c');
  const afterC = await camera();
  await press('f');
  const afterF = await camera();
  note(`[tecla fora do editor] C: ${afterC.kind}; F: segue ${afterF.follow}`);
  note(`[trocar de camera nao mexe na simulacao] hash igual: ${before.hash === (await farmbot('hash'))}, ticks iguais: ${before.meter === (await farmbot('meter'))}, status ${await farmbot('status')}`);
  await press('c');
  await press('f');

  // 6. Mouse: wheel zooms both cameras; drags turn and move the perspective one only.
  await toPerspective();
  const box = await page.locator('.scene canvas').boundingBox();
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(200);
  const wheelPersp = await camera();
  await page.mouse.down();
  await page.mouse.move(centre.x + 120, centre.y + 20, { steps: 8 });
  await page.mouse.up();
  const turned = await camera();
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(centre.x - 80, centre.y, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(1500);
  const moved = await camera();
  note(`[mouse perspectiva] roda: zoom ${wheelPersp.zoom.toFixed(2)}; botao esquerdo: angulo ${wheelPersp.yaw.toFixed(2)} -> ${turned.yaw.toFixed(2)}; botao direito: alvo ${wheelPersp.targetX.toFixed(2)} -> ${moved.targetX.toFixed(2)}`);
  await shot('marco-5-mouse-persp-girada-e-movida', 600);
  // The restore button: visible only in the perspective, undoes turn, elevation and move, and keeps the zoom.
  const restoreVisibleInPersp = await page.locator('.restore-camera').isVisible();
  await page.click('.restore-camera');
  await page.waitForTimeout(300);
  const restored = await camera();
  note(`[restaurar camera] botao visivel na perspectiva: ${restoreVisibleInPersp}; angulo ${moved.yaw.toFixed(2)} -> ${restored.yaw.toFixed(2)}; elevacao ${moved.pitch.toFixed(2)} -> ${restored.pitch.toFixed(2)}; alvo ${moved.targetX.toFixed(2)} -> ${restored.targetX.toFixed(2)}; zoom ${moved.zoom.toFixed(2)} -> ${restored.zoom.toFixed(2)} (esperado: angulo 0, zoom igual)`);
  await shot('marco-5-mouse-persp-restaurada', 600);
  await press('c');
  const isoBefore = await camera();
  note(`[restaurar camera] botao visivel na isometrica: ${await page.locator('.restore-camera').isVisible()} (esperado: false)`);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 150, centre.y + 40, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  const isoAfter = await camera();
  note(`[mouse isometrica] arrastar nao muda o angulo (${isoBefore.yaw.toFixed(2)} -> ${isoAfter.yaw.toFixed(2)}); roda: zoom ${isoBefore.zoom.toFixed(2)} -> ${isoAfter.zoom.toFixed(2)}`);
  note(`[simulacao intacta depois dos controles] hash igual: ${before.hash === (await farmbot('hash'))}`);

  // 7. The stress field is not part of the game: the normal page has no counter, and Run brings the real farm back.
  await open('lang=pt-BR&w=3&h=2');
  note(`[pagina normal] painel de estresse visivel: ${await page.locator('.stress-panel').isVisible()}`);
  await open('lang=pt-BR&stress=1');
  const visible = await page.locator('.stress-panel').isVisible();
  const before32 = (await farmbot('snapshot')).plants.filter(Boolean).length;
  await page.click('button.run');
  await page.waitForTimeout(500);
  note(`[estresse] painel visivel: ${visible}; plantas reais antes de executar: ${before32}; plantas falsas depois: ${(await farmbot('stats')).madeUpPlants}; painel visivel depois: ${await page.locator('.stress-panel').isVisible()}`);
  // Anything that brings the real farm back takes the made-up plants away: Run, Reset, or autorun in the address.
  await open('lang=pt-BR&stress=1');
  await page.click('button.reset');
  note(`[estresse + Reiniciar] plantas falsas: ${(await farmbot('stats')).madeUpPlants}; painel visivel: ${await page.locator('.stress-panel').isVisible()}; solo arado na cena: ${(await farmbot('snapshot')).terrain.filter((t) => t === 'tilled').length}`);
  await open('lang=pt-BR&stress=1&autorun=1&paused=1');
  note(`[estresse + autorun] plantas falsas: ${(await farmbot('stats')).madeUpPlants}; painel visivel: ${await page.locator('.stress-panel').isVisible()}; status ${await farmbot('status')}`);
  // A key held down must not flick the camera back and forth.
  await open('lang=pt-BR&w=3&h=2');
  await focusPage();
  await page.keyboard.down('c');
  for (let i = 0; i < 5; i++) await page.keyboard.down('c');
  await page.keyboard.up('c');
  note(`[tecla C segurada] camera: ${(await camera()).kind} (esperado: perspective: o jogo abre na isometrica e uma troca so leva a perspectiva)`);
  note(`[hash do 32x32 do marco 5 (varredura real, ${ticks32} ticks)] ${hash32}`);
}

writeFileSync(join(outDir, `console-marco-${milestone}.log`), `${log.join('\n')}\n`);
await browser.close();

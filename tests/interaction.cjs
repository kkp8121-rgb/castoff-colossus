const assert = require('node:assert/strict');
const { setup, save } = require('./browser-tools.cjs');
const { ready, begin, snapshot, frames } = require('./play-helpers.cjs');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const center = async locator => { const box = await locator.boundingBox(); assert.ok(box, 'control has a bounding box'); return { x: box.x + box.width / 2, y: box.y + box.height / 2, left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height, width: box.width, height: box.height }; };
async function openPlay(env) { await ready(env.page, env.url); await begin(env.page); await frames(env.page, 2); }
async function assertTouchLayout(page, width, height) {
  const viewport = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, width: window.innerWidth, height: window.innerHeight }));
  assert.ok(viewport.overflow <= 1, `horizontal overflow ${viewport.overflow}px at ${viewport.width}x${viewport.height}`);
  const buttons = page.locator('[data-input]'); assert.equal(await buttons.count(), 7);
  for (let index = 0; index < 7; index++) { const button = buttons.nth(index), box = await center(button); assert.ok(box.width >= 44 && box.height >= 44, `touch button ${index} is ${box.width}x${box.height}`); const hit = await page.evaluate(({ x, y }) => { const node = document.elementFromPoint(x, y); return node?.closest?.('[data-input]')?.dataset.input || null; }, box); assert.ok(hit, `touch button ${index} center is hittable`); assert.ok(box.left >= 0 && box.top >= 0 && box.right <= width + 1 && box.bottom <= height + 1, `touch button ${index} is inside viewport (${JSON.stringify(box)} viewport ${width}x${height})`); }
}
async function touchPoint(client, type, points) { await client.send('Input.dispatchTouchEvent', { type, touchPoints: points, modifiers: 0 }); }

async function main() {
  const results = [], failures = [];
  async function scenario(name, fn) { try { const detail = await fn(); results.push({ name, pass: true, detail }); } catch (error) { failures.push({ name, error: error.message, stack: error.stack }); results.push({ name, pass: false, error: error.message }); } }

  await scenario('touch-layout-portrait', async () => { const env = await setup({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); try { await openPlay(env); await assertTouchLayout(env.page, 390, 844); return await snapshot(env.page); } finally { await env.close(); } });
  await scenario('touch-layout-landscape', async () => { const env = await setup({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); try { await openPlay(env); await assertTouchLayout(env.page, 844, 390); return await snapshot(env.page); } finally { await env.close(); } });

  await scenario('multitouch-held-and-release', async () => { const env = await setup({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); try {
    await openPlay(env); const page = env.page, client = await env.context.newCDPSession(page);
    const points = async names => Promise.all(names.map(async (name, index) => { const point = await center(page.locator(`[data-input="${name}"]`)); return { id: index + 1, x: point.x, y: point.y, radiusX: 8, radiusY: 8, force: 1 }; }));
    const before = (await snapshot(page)).run.player.x;
    await touchPoint(client, 'touchStart', await points(['right', 'jump'])); await wait(200);
    const jumping = (await snapshot(page)).run.player;
    assert.ok(jumping.x > before + .15 && jumping.y > .5, 'two fingers move and jump together');
    await touchPoint(client, 'touchEnd', []); await wait(700);
    await touchPoint(client, 'touchStart', await points(['right', 'fire'])); await wait(380);
    const fired = (await snapshot(page)).run;
    assert.ok(fired.plates.filter(item => item.status === 'attached').length <= 4, 'two fingers move and fire');
    await touchPoint(client, 'touchCancel', []); await wait(180);
    assert.equal(await page.locator('[data-input].held').count(), 0);
    await touchPoint(client, 'touchStart', await points(['left', 'recall'])); await wait(1600);
    const recalled = (await snapshot(page)).run;
    assert.equal(recalled.plates.filter(item => item.status === 'attached').length, 6, 'grounded two-finger recall restores armor');
    await touchPoint(client, 'touchMove', [{ id: 1, x: 2, y: 2, radiusX: 8, radiusY: 8, force: 1 }, { id: 2, x: 4, y: 4, radiusX: 8, radiusY: 8, force: 1 }]);
    await touchPoint(client, 'touchEnd', []); await wait(220);
    assert.equal(await page.locator('[data-input].held').count(), 0, 'outside pointerup clears every action');
    const stopped = (await snapshot(page)).run.player;
    assert.ok(Math.abs(stopped.vx) < .15);
    return { jumping: { x: jumping.x, y: jumping.y }, firedArmor: fired.plates.filter(item => item.status === 'attached').length, recalledArmor: 6, stoppedVx: stopped.vx };
  } finally { await env.close(); } });

  await scenario('keyboard-and-touch-source-aggregation', async () => { const env = await setup({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); try {
    await openPlay(env); const page = env.page; await page.keyboard.down('d'); await page.keyboard.down('ArrowRight'); await wait(140); const before = (await snapshot(page)).run.player.x; await page.keyboard.up('d'); await wait(180); const afterAlias = (await snapshot(page)).run.player.x; assert.ok(afterAlias > before, 'ArrowRight remains held after d release'); await page.keyboard.up('ArrowRight');
    const client = await env.context.newCDPSession(page), right = await center(page.locator('[data-input="right"]')); await page.keyboard.down('d'); await touchPoint(client, 'touchStart', [{ id: 17, x: right.x, y: right.y, radiusX: 8, radiusY: 8, force: 1 }]); await wait(120); await touchPoint(client, 'touchEnd', []); const beforeTouchRelease = (await snapshot(page)).run.player.x; await wait(180); const afterTouchRelease = (await snapshot(page)).run.player.x; assert.ok(afterTouchRelease > beforeTouchRelease, 'keyboard d remains held after touch release'); await page.keyboard.up('d'); return { before, afterAlias, beforeTouchRelease, afterTouchRelease };
  } finally { await env.close(); } });

  await scenario('pause-guide-resume-blur', async () => { const env = await setup(); try { await openPlay(env); const page = env.page; await page.keyboard.down('d'); await page.keyboard.press('Escape'); assert.equal((await snapshot(page)).screen, 'pause'); const paused = (await snapshot(page)).run.time; await wait(260); assert.equal((await snapshot(page)).run.time, paused, 'pause freezes run time'); await page.locator('#pause-screen [data-action="guide"]').click(); assert.equal((await snapshot(page)).screen, 'guide'); await page.locator('#guide-screen [data-action="back"]').click(); assert.equal((await snapshot(page)).screen, 'pause'); const states = await page.evaluate(() => window.__audioEvidence?.contexts.map(context => context.state) || []); assert.ok(states.every(state => state === 'suspended'), `audio states while paused: ${states}`); await page.locator('#pause-screen [data-action="resume"]').click(); await page.keyboard.up('d'); await frames(page, 4); assert.equal((await snapshot(page)).screen, 'play'); await page.keyboard.down('d'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal((await snapshot(page)).screen, 'pause'); await page.keyboard.up('d'); return { paused, states };
  } finally { await env.close(); } });

  await scenario('malformed-storage-remains-playable', async () => { const env = await setup(); try { await env.context.addInitScript(() => { localStorage.setItem('castoff-records-v1', '{bad'); localStorage.setItem('castoff-settings-v1', JSON.stringify({ mode: 'bad', volume: -4, muted: 'no' })); }); await openPlay(env); return await snapshot(env.page); } finally { await env.close(); } });
  await scenario('throwing-storage-remains-playable', async () => { const env = await setup(); try { await env.context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage disabled'); } }); }); await openPlay(env); return await snapshot(env.page); } finally { await env.close(); } });
  await scenario('record-validation-menu-navigation-and-settings', async () => { const env = await setup(); try {
    await env.page.addInitScript(() => {
      if (!localStorage.getItem('fixture-seeded')) {
        localStorage.setItem('fixture-seeded', '1');
        localStorage.setItem('castoff-records-v1', JSON.stringify({ standard: { foundry: { grade: 'S', time: 12, hits: 5, coreHits: 0 }, bridges: { grade: 'A', time: -2, hits: 1, coreHits: 1 }, crown: { grade: 'B', time: 20, hits: 0, coreHits: 0 } }, gentle: { foundry: { grade: 'A', time: 20, hits: 2, coreHits: 1 } } }));
      }
    });
    await ready(env.page, env.url);
    assert.deepEqual(await env.page.evaluate(() => window.__castoff.records.standard), {});
    await env.page.keyboard.press('Enter'); await env.page.keyboard.press('ArrowDown');
    assert.equal(await env.page.evaluate(() => window.__castoff.selection.levelId), 'bridges');
    await env.page.selectOption('#mode-select', 'gentle');
    assert.ok((await env.page.locator('[data-level-id="foundry"]').textContent()).includes('완화 A'));
    await env.page.locator('#volume-range').fill('0');
    await env.page.keyboard.press('Escape'); await env.page.locator('[data-action="continue"]').click();
    assert.equal(await env.page.evaluate(() => window.__castoff.selection.levelId), 'bridges');
    await env.page.keyboard.press('Enter'); await frames(env.page, 5);
    assert.equal((await snapshot(env.page)).run.player.maxHp, 5);
    await env.page.reload(); await env.page.waitForFunction(() => window.__castoff?.ready);
    assert.deepEqual(await env.page.evaluate(() => window.__castoff.settings), { mode: 'gentle', volume: 0, muted: false });
    return { rejectedStandardRecords: 3, validGentleRecord: true, nextMission: 'bridges', volume: 0 };
  } finally { await env.close(); } });
  await scenario('no-audio-context-remains-playable', async () => { const env = await setup(); try { await env.context.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; }); await openPlay(env); return await snapshot(env.page); } finally { await env.close(); } });
  await scenario('webgl-error-blocks-start', async () => { const env = await setup(); try { await env.context.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) { if (String(type).startsWith('webgl')) throw new Error('WebGL disabled for fixture'); return original.call(this, type, ...args); }; }); await env.page.goto(env.url); await env.page.waitForSelector('#error-banner:not([hidden])'); assert.equal(await env.page.locator('#title-screen [data-action="start"]').isDisabled(), true); await env.page.keyboard.press('Enter'); assert.equal((await env.page.locator('.app-shell').getAttribute('data-screen')), 'title'); return { banner: await env.page.locator('#error-banner').textContent() }; } finally { await env.close(); } });

  await scenario('real-pit-defeat-and-retry', async () => { const env = await setup(); try { await openPlay(env); const page = env.page; await page.keyboard.down('d'); const deadline = Date.now() + 15000; let state = await snapshot(page); while (state.screen === 'play' && Date.now() < deadline) { await frames(page, 3); state = await snapshot(page); } await page.keyboard.up('d'); assert.equal(state.screen, 'lost', `real pit traversal should exhaust core, got ${state.screen} at ${state.run?.player?.x}`); await page.keyboard.press('r'); await page.waitForFunction(() => window.__castoff.screen === 'play' && window.__castoff.run?.status === 'playing'); const retry = await snapshot(page); assert.ok(retry.run.time < 1, 'retry starts a fresh stage'); return { lost: state.run, retry: retry.run };
  } finally { await env.close(); } });

  save('interaction-report.json', { results, failures, generatedAt: new Date().toISOString() }); console.log(JSON.stringify({ results: results.map(({ name, pass, error }) => ({ name, pass, error })), failures })); if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });

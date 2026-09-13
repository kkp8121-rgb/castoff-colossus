const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setup, audioEvidence, save, artifacts, root } = require('./browser-tools.cjs');
const { ready, begin, snapshot, frames, armor, Driver } = require('./play-helpers.cjs');

(async () => {
  const results = [];
  for (const location of ['file', 'subpath']) {
    const env = await setup(), { page } = env, driver = new Driver(page);
    try {
      await ready(page, location === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : env.url);
      await page.screenshot({ path: path.join(artifacts, `${location}-title.png`) });
      await begin(page); await frames(page, 2);
      assert.equal(armor((await snapshot(page)).run), 6);
      await driver.until(state => armor(state.run) <= 3, ['k'], 4);
      const lightened = await snapshot(page); assert.ok(armor(lightened.run) <= 3);
      await driver.until(state => !state.run.player.grounded, ['Space'], 3);
      await driver.set([]); let apex = 0;
      await driver.until(state => { apex = Math.max(apex, state.run.player.y); return state.run.player.grounded; }, [], 4);
      assert.ok(apex > 2, 'shedding three plates reaches the first relay height');
      await driver.until(state => armor(state.run) === 6, ['r'], 4);
      await page.screenshot({ path: path.join(artifacts, `${location}-play.png`) });
      await page.evaluate(() => { const run = window.__castoff.run; run.player.hp = 999; run.plates.length = 0; });
      assert.equal((await snapshot(page)).run.plates.length, 6);
      assert.ok((await snapshot(page)).run.player.hp <= 3);
      await page.keyboard.press('Escape'); assert.equal((await snapshot(page)).screen, 'pause');
      await page.locator('#pause-screen [data-action="guide"]').click();
      await page.locator('#guide-screen [data-action="back"]').click();
      assert.equal((await snapshot(page)).screen, 'pause');
      assert.ok((await audioEvidence(page)).states.every(state => state === 'suspended'));
      await page.locator('#pause-screen [data-action="resume"]').click();
      await frames(page, 20);
      const audio = await audioEvidence(page); assert.ok(audio.peak > .00001);
      await page.keyboard.press('m'); await page.waitForTimeout(400);
      const muted = await page.evaluate(() => { let peak = 0; for (const context of window.__audioEvidence.contexts) { const samples = new Float32Array(512); context.__meter.getFloatTimeDomainData(samples); for (const sample of samples) peak = Math.max(peak, Math.abs(sample)); } return peak; });
      assert.ok(muted < .00001);
      assert.deepEqual(env.errors, []); assert.deepEqual(env.consoleErrors, []); assert.deepEqual(env.failed, []);
      results.push({ location, lightArmor: armor(lightened.run), apex, audio, muted, scene: (await snapshot(page)).scene, errors: env.errors, failed: env.failed });
    } finally { await driver.set([]).catch(() => {}); await env.close(); }
  }
  save('browser-report.json', results); console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });

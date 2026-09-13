const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { setup, audioEvidence, artifacts, root, save } = require('./browser-tools.cjs');
const { ready, begin, snapshot, Driver } = require('./play-helpers.cjs');
const { RoutePolicy } = require('./route-policy.cjs');
(async () => {
  const { LEVELS } = await import('../src/levels.js');
  const env = await setup({}, { args: ['--use-angle=d3d11'] });
  const driver = new Driver(env.page), result = { bundleSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'game.js'))).digest('hex'), missions: [] };
  try {
    await ready(env.page, env.url); await begin(env.page);
    for (const level of LEVELS) {
      const policy = new RoutePolicy(level); let state = await snapshot(env.page), previous = '', lastReport = Date.now();
      const deadline = Date.now() + 240000;
      while (state.screen === 'play' && Date.now() < deadline) {
        result.scene = state.scene;
        const keys = policy.decide(state.run);
        state = await driver.tick(keys, 2);
        if (previous !== policy.phase || Date.now() - lastReport > 15000) {
          console.log(JSON.stringify({ level: level.id, phase: policy.phase, t: +state.run.time.toFixed(2), x: +state.run.player.x.toFixed(2), hp: state.run.player.hp, bossHp: state.run.boss.hp }));
          if (previous !== policy.phase) await env.page.screenshot({ path: path.join(artifacts, `campaign-${level.id}-${policy.phase}.png`) });
          previous = policy.phase; lastReport = Date.now();
        }
      }
      await driver.set([]);
      assert.equal(state.screen, 'cleared', JSON.stringify(state.run));
      assert.ok(state.run.relays.every(relay => relay.active)); assert.equal(state.run.boss.alive, false);
      result.missions.push({ levelId: level.id, time: state.run.time, hits: state.run.hits, coreHits: state.run.coreHits, hp: state.run.player.hp, relays: state.run.relays.length });
      await env.page.screenshot({ path: path.join(artifacts, `campaign-${level.id}-clear.png`) });
      await env.page.keyboard.press('Enter');
    }
    assert.equal((await snapshot(env.page)).screen, 'ending');
    result.records = await env.page.evaluate(() => window.__castoff.records);
    assert.equal(Object.keys(result.records.standard).length, 3);
    await env.page.screenshot({ path: path.join(artifacts, 'campaign-ending.png') });
    result.audio = await audioEvidence(env.page); result.inputs = driver.inputs;
    assert.ok(result.audio.peak > .001);
    await env.page.reload(); await env.page.waitForFunction(() => window.__castoff?.ready);
    assert.deepEqual(await env.page.evaluate(() => window.__castoff.records), result.records);
    assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []); assert.deepEqual(env.consoleErrors, []);
    save('campaign.json', result); console.log(JSON.stringify(result));
  } catch (error) { await env.page.screenshot({ path: path.join(artifacts, 'campaign-failure.png') }).catch(() => {}); save('campaign-failure.json', { state: await snapshot(env.page), error: error.message }); throw error; }
  finally { await driver.set([]).catch(() => {}); await env.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

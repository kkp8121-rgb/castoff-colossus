const assert = require('node:assert/strict');

const snapshot = page => page.evaluate(() => ({ screen: window.__castoff.screen, run: window.__castoff.run, scene: window.__castoff.sceneStats }));
async function ready(page, url) { await page.goto(url); await page.waitForFunction(() => window.__castoff?.ready); }
async function begin(page) {
  await page.keyboard.press('Enter');
  if ((await snapshot(page)).screen === 'select') await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__castoff.screen === 'play' && window.__castoff.run?.status === 'playing');
}
async function frames(page, count = 1) {
  await page.evaluate(count => new Promise(resolve => { function frame() { if (--count <= 0) resolve(); else requestAnimationFrame(frame); } requestAnimationFrame(frame); }), count);
  return snapshot(page);
}
const armor = run => run.plates.filter(plate => plate.status === 'attached').length;
class Driver {
  constructor(page) { this.page = page; this.held = new Set(); this.inputs = 0; }
  async set(keys = []) {
    const next = new Set(keys);
    for (const key of this.held) if (!next.has(key)) { await this.page.keyboard.up(key); this.inputs++; }
    for (const key of next) if (!this.held.has(key)) { await this.page.keyboard.down(key); this.inputs++; }
    this.held = next;
  }
  async tick(keys = [], count = 2) { await this.set(keys); return frames(this.page, count); }
  async until(predicate, keys = [], seconds = 10) {
    const end = Date.now() + seconds * 1000;
    let state = await snapshot(this.page);
    while (!predicate(state) && Date.now() < end) {
      assert.equal(state.screen, 'play', `unexpected screen ${state.screen}`);
      state = await this.tick(typeof keys === 'function' ? keys(state) : keys, 2);
    }
    assert.ok(predicate(state), `input condition timed out: ${JSON.stringify(state.run?.player)}`);
    await this.set([]); return state;
  }
}
module.exports = { snapshot, ready, begin, frames, armor, Driver };

const assert = require('node:assert/strict'), path = require('node:path');
const { setup, artifacts, save } = require('./browser-tools.cjs');
const { ready, frames } = require('./play-helpers.cjs');
(async () => {
  const report = [];
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    const env = await setup({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000 }, { args: ['--use-angle=d3d11'] });
    try {
      await ready(env.page, env.url);
      for (const screen of ['title', 'select', 'play']) {
        if (screen === 'select') await env.page.keyboard.press('Enter');
        if (screen === 'play') { await env.page.keyboard.press('Enter'); await frames(env.page, 30); }
        await env.page.screenshot({ path: path.join(artifacts, `visual-${width}-${height}-${screen}.png`) });
        const geometry = await env.page.evaluate(screen => [...document.querySelectorAll(`#${screen}-screen button`)].filter(button => !button.disabled && getComputedStyle(button).display !== 'none' && button.getBoundingClientRect().width > 0).map(button => {
          const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return { text: button.textContent, y: rect.y, bottom: rect.bottom, width: rect.width, height: rect.height, hit: hit === button || button.contains(hit), inside: rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight };
        }), screen);
        for (const button of geometry) assert.ok(button.inside && button.hit && button.height >= 44, `${width}x${height} ${screen}: ${JSON.stringify(button)}`);
        report.push({ width, height, screen, buttons: geometry });
      }
      assert.deepEqual(env.errors, []); assert.deepEqual(env.failed, []);
    } finally { await env.close(); }
  }
  save('visual.json', report); console.log(JSON.stringify(report.map(({ width, height, screen, buttons }) => ({ width, height, screen, buttons: buttons.length }))));
})().catch(error => { console.error(error); process.exitCode = 1; });

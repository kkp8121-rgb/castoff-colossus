import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { createRun, step, summarize } from '../src/game.js';
import policy from './route-policy.cjs';
for (const level of LEVELS) {
  const run = createRun(level.id), driver = new policy.RoutePolicy(level);
  let phase = '', lastReport = 0;
  while (run.status === 'playing' && run.time < 240) {
    const keys = driver.decide(run);
    for (let i = 0; i < 4; i++) step(run, policy.inputFor(keys), 1 / 120);
    if (driver.phase !== phase || run.time - lastReport > 10) {
      phase = driver.phase; lastReport = run.time;
      console.log(JSON.stringify({ level: level.id, phase, t: +run.time.toFixed(2), x: +run.player.x.toFixed(2), y: +run.player.y.toFixed(2), armor: run.plates.filter(p => p.status === 'attached').length, hp: run.player.hp, bossHp: run.boss.hp, keys }));
    }
  }
  console.log(JSON.stringify(summarize(run)));
  assert.equal(run.status, 'cleared');
}

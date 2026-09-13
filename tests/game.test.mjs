import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, RULES, getLevel } from '../src/levels.js';
import { createRun, getArmorCount, step, summarize } from '../src/game.js';

const tick = (run, input, seconds) => {
  const count = Math.ceil(seconds / 0.05);
  for (let i = 0; i < count; i += 1) step(run, input, Math.min(0.05, seconds - i * 0.05));
};

test('authored levels expose reachable platform and boss contracts', () => {
  assert.deepEqual(LEVELS.map((level) => level.id), ['foundry', 'bridges', 'crown']);
  for (const level of LEVELS) {
    assert.ok(level.platforms.length >= 4);
    assert.ok(level.relays.length >= 2);
    assert.ok(level.boss.hp > 0 && level.boss.x < level.length);
    for (const relay of level.relays) assert.ok(level.platforms.some((p) => relay.x >= p.x && relay.x <= p.x + p.width + 1));
    const run = createRun(level.id);
    assert.equal(run.plates.length, 6);
    assert.equal(run.status, 'playing');
  }
});

test('shedding armor makes the heavy chassis measurably lighter and jump higher', () => {
  const heavy = createRun('foundry');
  step(heavy, { jump: true }, 0.01);
  let heavyApex = heavy.player.y;
  for (let i = 0; i < 80; i += 1) { step(heavy, {}, 0.05); heavyApex = Math.max(heavyApex, heavy.player.y); }
  const light = createRun('foundry');
  for (const item of light.plates) item.status = 'loose';
  step(light, { jump: true }, 0.01);
  let lightApex = light.player.y;
  for (let i = 0; i < 80; i += 1) { step(light, {}, 0.05); lightApex = Math.max(lightApex, light.player.y); }
  assert.ok(lightApex > heavyApex + 1);
  assert.equal(RULES.baseJump + RULES.jumpPerPlate * 6, 13.2);
});

test('fired plates become loose, remain recoverable, and recall only from a grounded charge', () => {
  const run = createRun('foundry');
  step(run, { fire: true }, 0.05);
  assert.equal(getArmorCount(run), 5);
  assert.ok(run.plates.some((item) => item.status === 'flying'));
  tick(run, {}, 1);
  assert.ok(run.plates.some((item) => item.status === 'loose'));
  const recallEvents = [];
  for (let i = 0; i < Math.ceil((RULES.recallCharge + RULES.recallDuration + 0.2) / 0.05); i += 1) recallEvents.push(...step(run, { recall: true }, 0.05));
  assert.equal(getArmorCount(run), 6);
  assert.ok(recallEvents.some((event) => event.type === 'armor-return'));
  const jumping = createRun('foundry');
  step(jumping, { jump: true }, 0.01);
  tick(jumping, { recall: true }, 1);
  assert.equal(getArmorCount(jumping), 6);
  assert.equal(jumping._recallTriggered, false);
});

test('armor absorbs a hit before exposed core damage, with invulnerability preventing stacks', () => {
  const run = createRun('foundry');
  run.player.x = run.enemies[0].x;
  run.enemies[0].y = run.player.y;
  run.enemies[0].facing = 0;
  tick(run, {}, 0.75);
  assert.equal(run.player.hp, run.player.maxHp);
  assert.equal(getArmorCount(run), 5);
  run.player.invulnerable = 0;
  run.plates.forEach((item) => { item.status = 'loose'; });
  run.player.x = run.enemies[0].x; run.player.vx = 0; run.enemies[0].phase = 'telegraph'; run.enemies[0].timer = 0;
  step(run, {}, 0.05);
  assert.equal(run.player.hp, run.player.maxHp - 1);
  assert.equal(run.coreHits, 1);
});

test('one-way platform catches descending feet and falling respawns at checkpoint', () => {
  const run = createRun('foundry');
  run.player.x = 12; run.player.y = 5; run.player.vy = -3; run.player.grounded = false;
  tick(run, {}, 1);
  assert.equal(run.player.grounded, true);
  assert.equal(run.player.y, 2.2);
  run.player.x = 21; run.player.y = 0; run.player.vy = -1; run.player.grounded = false;
  tick(run, {}, 1);
  assert.equal(run.player.x, run.checkpoint.x);
  assert.equal(run.player.y, run.checkpoint.y);
  assert.equal(run.coreHits, 1);
});

test('fixed-step integration stays close when the same input is partitioned differently', () => {
  const a = createRun('bridges');
  const b = createRun('bridges');
  for (let i = 0; i < 20; i += 1) step(a, { right: true }, 0.05);
  for (let i = 0; i < 40; i += 1) step(b, { right: true }, 0.025);
  assert.ok(Math.abs(a.player.x - b.player.x) < 0.08);
  assert.ok(Math.abs(a.player.vx - b.player.vx) < 0.08);
  assert.ok(Math.abs(a.time - b.time) < 1e-9);
});

test('an early fall cannot unlock a checkpoint that the player has not reached', () => {
  const run = createRun('foundry');
  assert.deepEqual(run.checkpoint, { x: 2, y: 0 });
  run.player.x = 21; run.player.y = -4.9; run.player.vy = -10; run.player.grounded = false;
  step(run, {}, .05);
  assert.equal(run.player.x, 2); assert.equal(run.hits, 1); assert.equal(run.coreHits, 1);
  run.player.x = 43; step(run, {}, .01);
  assert.deepEqual(run.checkpoint, { x: 43, y: 0 });
});

test('expired melee tells reset after a dodge and projectiles hit the visible body', () => {
  const run = createRun('foundry'), foe = run.enemies[0];
  foe.phase = 'telegraph'; foe.timer = .01;
  step(run, {}, .05);
  assert.equal(foe.phase, 'patrol'); assert.ok(foe.timer > .9);
  run.player.x = foe.x; step(run, {}, .05);
  assert.equal(run.hits, 0);
  run.projectiles.push({ id: 'fixture-bolt', type: 'bolt', x: run.player.x, y: 1, vx: 0, vy: 0, life: 1 });
  step(run, {}, .01); assert.equal(run.hits, 1);
});

test('beam height permits standing but catches an airborne body across its full width', () => {
  for (const [y, hit] of [[0, false], [.5, true]]) {
    const run = createRun('foundry'); run.player.y = y; run.player.grounded = y === 0;
    run.projectiles.push({ id: 'fixture-beam', type: 'beam', x: 8, y: 2.1, vx: 0, vy: 0, length: 12, width: .28, life: .38 });
    step(run, {}, .01); assert.equal(run.hits, Number(hit));
  }
});

test('crown alternates a double low wave and high beam, and gentle tells are 25 percent longer', () => {
  const run = createRun('crown'); run.player.x = 75; run.enemies.forEach(foe => { foe.alive = false; });
  step(run, {}, 1 / 120); assert.equal(run.boss.timer, 1.1);
  const gentle = createRun('crown', 'gentle'); gentle.player.x = 75; step(gentle, {}, 1 / 120);
  assert.equal(gentle.boss.timer, 1.375);
  const seen = new Map();
  for (let i = 0; i < 580; i++) {
    step(run, {}, 1 / 120);
    for (const projectile of run.projectiles) seen.set(projectile.id, projectile.type);
  }
  assert.deepEqual([...seen.values()], ['wave', 'wave', 'beam']);
});

test('relay punches require its actual height and empty fire respects cooldown', () => {
  const run = createRun('foundry'); run.player.x = 11;
  tick(run, { jump: true, punch: true }, .8);
  assert.equal(run.relays[0].active, false);
  run.plates.forEach(item => { item.status = 'loose'; });
  let denials = 0;
  for (let i = 0; i < 120; i++) denials += step(run, { fire: true }, 1 / 120).filter(event => event.type === 'denied').length;
  assert.ok(denials >= 4 && denials <= 5);
});

test('boss telegraph, shield, recovery damage and terminal clear use explicit states', () => {
  const relayRun = createRun('foundry');
  relayRun.player.x = 11; relayRun.player.y = 2.2; relayRun.player.facing = 1; relayRun.player.grounded = true;
  step(relayRun, { fire: true }, 0.05);
  assert.equal(relayRun.relays[0].active, true);
  const run = createRun('foundry');
  run.player.x = run.boss.x - 1.4; run.player.y = 0; run.player.grounded = true;
  step(run, {}, 0.01);
  assert.equal(run.boss.phase, 'telegraph');
  tick(run, {}, 1.2);
  assert.equal(run.boss.phase, 'attack');
  tick(run, {}, 0.5);
  assert.equal(run.boss.phase, 'recovery');
  const hp = run.boss.hp;
  step(run, { fire: true }, 0.05);
  assert.equal(run.boss.hp, hp - 4);
  const shielded = createRun('foundry');
  shielded.player.x = shielded.boss.x - 1.4; shielded.player.grounded = true; shielded.boss.phase = 'attack';
  step(shielded, { fire: true }, 0.05);
  assert.equal(shielded.boss.hp, shielded.boss.maxHp);
  assert.ok(shielded.events.some((event) => event.type === 'denied'));
  const clear = createRun('foundry');
  clear.boss.alive = false; clear.boss.phase = 'dead'; clear.relays.forEach((relay) => { relay.active = true; }); clear.player.x = getLevel('foundry').length - 1; clear.player.grounded = true;
  step(clear, {}, 0.01);
  assert.equal(clear.status, 'cleared');
  assert.equal(summarize(clear).grade, 'S');
});

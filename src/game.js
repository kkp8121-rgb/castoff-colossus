import { getLevel, RULES } from './levels.js';

const n = (value) => Boolean(value);
const inputOf = (input = {}) => ({ left: n(input.left), right: n(input.right), jump: n(input.jump), dash: n(input.dash), punch: n(input.punch), fire: n(input.fire), recall: n(input.recall) });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function platformUnder(level, x, y, previousY, vy) {
  if (vy > 0) return null;
  for (const platform of level.platforms) {
    if (x + RULES.playerWidth / 2 <= platform.x || x - RULES.playerWidth / 2 >= platform.x + platform.width) continue;
    if (previousY >= platform.y - 1e-5 && y <= platform.y + 1e-5) return platform;
  }
  return null;
}

function plate(id, player) {
  return { id, status: 'attached', x: player.x, y: player.y + 0.9, vx: 0, vy: 0, returnTime: 0 };
}

function enemyState(def) {
  const maxHp = def.type === 'turret' ? 5 : def.type === 'drone' ? 4 : 4;
  return { id: def.id, type: def.type, x: def.x, y: def.y, patrolMin: def.patrolMin, patrolMax: def.patrolMax, hp: maxHp, maxHp, alive: true, facing: -1, phase: 'patrol', timer: 0 };
}

function bossState(def) {
  return { id: def.id, type: def.type, x: def.x, y: def.y, hp: def.hp, maxHp: def.hp, alive: true, phase: 'dormant', timer: 0, tell: '' };
}

export function createRun(levelId, mode = 'standard') {
  const level = getLevel(levelId);
  if (!level) throw new RangeError(`unknown level: ${levelId}`);
  const gentle = mode === 'gentle';
  const player = { x: 2, y: 0, vx: 0, vy: 0, facing: 1, grounded: true, hp: gentle ? RULES.gentleHp : RULES.standardHp, maxHp: gentle ? RULES.gentleHp : RULES.standardHp, invulnerable: 0, dashTime: 0, dashCooldown: 0, punchTime: 0, fireCooldown: 0, recallTime: 0 };
  return {
    levelId, mode: gentle ? 'gentle' : 'standard', status: 'playing', time: 0, player,
    plates: Array.from({ length: 6 }, (_, id) => plate(id, player)),
    enemies: level.enemies.map(enemyState),
    relays: level.relays.map((item) => ({ ...item, active: false })),
    boss: bossState(level.boss), projectiles: [], checkpoint: { x: 2, y: 0 },
    hits: 0, coreHits: 0, feedback: '', events: [],
    _prevInput: inputOf(), _jumpBuffer: 0, _coyote: 0, _recallCharge: 0, _recallTriggered: false,
    _nextProjectile: 1, _bossCycle: 0, _bossNear: false, _checkpointTarget: { ...level.checkpoint }, _bossWavePending: 0
  };
}

export function getArmorCount(run) {
  return run?.plates?.filter((item) => item.status === 'attached').length || 0;
}

function emit(run, events, type, data = {}) {
  const event = { type, ...data };
  events.push(event);
  if (data.text) run.feedback = data.text;
}

function detachArmor(run, events) {
  const p = run.player;
  const item = run.plates.find((plateItem) => plateItem.status === 'attached');
  if (!item) return false;
  item.status = 'loose'; item.x = p.x; item.y = p.y + 0.7; item.vx = -p.facing * 1.2; item.vy = 2; item.returnTime = 0;
  return true;
}

function hurtPlayer(run, events, amount = 1, x = run.player.x, y = run.player.y) {
  const p = run.player;
  if (p.invulnerable > 0 || run.status !== 'playing') return;
  p.invulnerable = RULES.hitInvulnerability;
  run.hits += 1;
  if (detachArmor(run, events)) {
    p.vx += x < p.x ? 2.2 : -2.2;
    emit(run, events, 'hit', { x, y, amount, text: '장갑판이 충격을 흡수했습니다.' });
    return;
  }
  p.hp = Math.max(0, p.hp - amount); run.coreHits += amount;
  p.vx += x < p.x ? 2.2 : -2.2;
  emit(run, events, 'hit', { x, y, amount, text: '코어가 노출되었습니다.' });
  if (p.hp <= 0) { run.status = 'lost'; emit(run, events, 'lose', { x: p.x, y: p.y, text: '코어가 정지했습니다. Enter 또는 R로 재시도하세요.' }); }
}

function targetHit(run, events, target, damage, x, y, source = 'shot') {
  if (!target || !target.alive) return false;
  if (target === run.boss && run.boss.phase !== 'recovery') {
    run.feedback = '보스 방패가 닫혀 있습니다. 회복 중인 틈을 기다리세요.';
    emit(run, events, 'denied', { x, y, text: run.feedback });
    return true;
  }
  target.hp = Math.max(0, target.hp - damage);
  emit(run, events, 'hit', { x, y, amount: damage, text: source === 'punch' ? '주먹이 명중했습니다.' : '장갑판이 명중했습니다.' });
  if (target.hp <= 0) { target.alive = false; target.phase = target === run.boss ? 'dead' : 'down'; emit(run, events, 'enemy-down', { x: target.x, y: target.y, text: target === run.boss ? '보스가 무너졌습니다.' : '적기가 정지했습니다.' }); }
  return true;
}

function hitRelay(run, events, relay, x, y) {
  if (relay.active) return false;
  relay.active = true;
  emit(run, events, 'relay', { x: relay.x, y: relay.y, text: '릴레이가 켜졌습니다.' });
  return true;
}

function fire(run, events) {
  const p = run.player;
  if (p.fireCooldown > 0) return;
  const item = run.plates.find((plateItem) => plateItem.status === 'attached');
  if (!item) { p.fireCooldown = RULES.fireCooldown; run.feedback = '발사할 장갑판이 없습니다. 지상에서 R을 눌러 회수하세요.'; emit(run, events, 'denied', { x: p.x, y: p.y, text: run.feedback }); return; }
  item.status = 'flying'; item.x = p.x + p.facing * 0.55; item.y = p.y + 0.95; item.vx = p.facing * RULES.fireSpeed; item.vy = p.vy * 0.2; item.returnTime = 0;
  p.fireCooldown = RULES.fireCooldown; p.vx -= p.facing * 0.15;
  emit(run, events, 'shot', { x: item.x, y: item.y, text: '장갑판을 발사했습니다.' });
}

function punch(run, events) {
  const p = run.player;
  if (p.punchTime > 0) return;
  p.punchTime = RULES.punchCooldown; emit(run, events, 'punch', { x: p.x + p.facing, y: p.y + 0.9 });
  const inReach = target => (target.x - p.x) * p.facing >= -0.15 && (target.x - p.x) * p.facing < RULES.punchRange;
  for (const relay of run.relays) if (!relay.active && inReach(relay) && Math.abs(relay.y - (p.y + 0.9)) < 0.3) { hitRelay(run, events, relay, relay.x, relay.y); return; }
  for (const foe of run.enemies) if (foe.alive && inReach(foe) && Math.abs(foe.y - p.y) < 1.4) { targetHit(run, events, foe, RULES.punchDamage, foe.x, foe.y, 'punch'); return; }
  if (run.boss.alive && inReach(run.boss) && Math.abs(run.boss.y - p.y) < 1.4) targetHit(run, events, run.boss, RULES.punchDamage, run.boss.x, run.boss.y, 'punch');
}

function startRecall(run, events) {
  if (run._recallTriggered || getArmorCount(run) === 6) return;
  run._recallTriggered = true;
  let count = 0;
  for (const item of run.plates) if (item.status !== 'attached') { item.status = 'returning'; item.returnTime = RULES.recallDuration; item.vx = 0; item.vy = 0; count += 1; }
  if (count) emit(run, events, 'recall', { x: run.player.x, y: run.player.y, text: '회수 신호가 시작되었습니다.' });
}

function updateRecall(run, events, input, h) {
  const p = run.player;
  if (p.grounded && input.recall && p.dashTime <= 0 && getArmorCount(run) < 6) {
    run._recallCharge = Math.min(RULES.recallCharge, run._recallCharge + h);
    p.recallTime = run._recallCharge;
    p.vx *= Math.max(0, 1 - h * 12);
    if (run._recallCharge >= RULES.recallCharge) startRecall(run, events);
  } else if (!run._recallTriggered) {
    run._recallCharge = 0; p.recallTime = 0;
  }
  if (!p.grounded && !run._recallTriggered) { run._recallCharge = 0; p.recallTime = 0; }
  let returning = false;
  for (const item of run.plates) if (item.status === 'returning') {
    const fraction = Math.min(1, h / Math.max(item.returnTime, h));
    item.x += (p.x - item.x) * fraction; item.y += (p.y + 0.9 - item.y) * fraction;
    item.returnTime = Math.max(0, item.returnTime - h); returning = true;
    if (item.returnTime <= 0) { item.status = 'attached'; emit(run, events, 'armor-return', { x: p.x, y: p.y, text: '장갑판이 돌아왔습니다.' }); }
  }
  if (run._recallTriggered && !returning && getArmorCount(run) === 6) { run._recallTriggered = false; run._recallCharge = 0; p.recallTime = 0; }
}

function updatePlates(run, level, h, events) {
  for (const item of run.plates) {
    if (item.status === 'attached') { item.x = run.player.x; item.y = run.player.y + 0.9; continue; }
    if (item.status === 'returning') continue;
    if (item.status === 'flying') {
      const oldY = item.y; item.vy -= RULES.gravity * 0.18 * h; item.x += item.vx * h; item.y += item.vy * h;
      const relay = run.relays.find((candidate) => !candidate.active && Math.abs(candidate.x - item.x) < 0.35 && Math.abs(candidate.y - item.y) < 0.35);
      if (relay) { hitRelay(run, events, relay, item.x, item.y); item.status = 'loose'; item.vx = 0; item.vy = 0; }
      if (item.status === 'flying') {
        const foes = [...run.enemies, run.boss];
        const foe = foes.find((candidate) => candidate.alive && Math.abs(candidate.x - item.x) < 0.72 && Math.abs(candidate.y + 0.8 - item.y) < 1.05);
        if (foe) { targetHit(run, events, foe, RULES.fireDamage, item.x, item.y); item.status = 'loose'; item.vx = 0; item.vy = 0; }
      }
      if (item.status === 'flying') {
        const landing = platformUnder(level, item.x, item.y, oldY, item.vy);
        if (landing) { item.y = landing.y; item.vy = 0; item.vx *= 0.1; item.status = 'loose'; }
      }
      if (item.x < 0 || item.x > level.length) { item.x = clamp(item.x, 0, level.length); item.status = 'loose'; item.vx = 0; }
    } else if (item.status === 'loose') {
      item.vy -= RULES.gravity * 0.18 * h; item.x += item.vx * h; item.y += item.vy * h;
      const landing = platformUnder(level, item.x, item.y, item.y - item.vy * h, item.vy);
      if (landing) { item.y = landing.y; item.vy = 0; item.vx *= Math.max(0, 1 - h * 8); }
      if (item.x < 0 || item.x > level.length) { item.x = clamp(item.x, 0, level.length); item.vx = 0; }
      if (item.y < RULES.fallLimit) { item.x = clamp(item.x, 0, level.length); item.y = 0; item.vy = 0; }
    }
  }
}

function updateEnemies(run, level, h, events) {
  const p = run.player;
  for (const foe of run.enemies) {
    if (!foe.alive) continue;
    foe.timer -= h;
    if (foe.phase === 'telegraph') {
      if (foe.timer <= 0) {
        if (foe.type === 'walker') {
          if (Math.abs(foe.x - p.x) < 0.9 && Math.abs(foe.y - p.y) < 1.25) hurtPlayer(run, events, RULES.enemyDamage, foe.x, foe.y);
        } else {
          const direction = p.x < foe.x ? -1 : 1;
          foe.facing = direction;
          run.projectiles.push({ id: `projectile-${run._nextProjectile++}`, type: 'bolt', x: foe.x + direction * 0.8, y: foe.y + 1, vx: direction * 4.2 * (run.mode === 'gentle' ? 0.85 : 1), vy: 0, life: 4 });
        }
        foe.phase = 'patrol';
        foe.timer = foe.type === 'walker' ? 1 : foe.type === 'turret' ? 2 : 2.4;
      }
      continue;
    }
    if (foe.type === 'walker') {
      foe.x = clamp(foe.x + foe.facing * 0.75 * h, foe.patrolMin, foe.patrolMax);
      if (foe.x <= foe.patrolMin) foe.facing = 1;
      if (foe.x >= foe.patrolMax) foe.facing = -1;
    } else if (foe.type === 'drone') {
      const authored = level.enemies.find(item => item.id === foe.id);
      foe.y = authored.y + Math.sin(run.time * 2 + authored.x) * 0.12;
    }
    const near = foe.type === 'walker'
      ? Math.abs(foe.x - p.x) < 0.9 && Math.abs(foe.y - p.y) < 1.25
      : Math.abs(foe.x - p.x) < 10;
    if (near && foe.timer <= 0) {
      foe.phase = 'telegraph'; foe.timer = 0.7 * (run.mode === 'gentle' ? 1.25 : 1);
      foe.facing = p.x < foe.x ? -1 : 1;
    }
  }
}

function bossAttack(run, events) {
  const b = run.boss; const p = run.player; const speed = run.mode === 'gentle' ? 0.85 : 1;
  const type = b.type === 'ram' ? 'wave' : b.type === 'spindle' ? (run._bossCycle % 2 ? 'beam' : 'wave') : (run._bossCycle % 2 === 1 ? 'beam' : 'wave');
  const direction = p.x < b.x ? -1 : 1;
  if (type === 'beam') run.projectiles.push({ id: `projectile-${run._nextProjectile++}`, type: 'beam', x: b.x, y: 2.1, vx: 0, vy: 0, life: 0.38, length: 12, width: 0.28 });
  else {
    run.projectiles.push({ id: `projectile-${run._nextProjectile++}`, type: 'wave', x: b.x + direction * 0.8, y: 0.32, vx: direction * 5 * speed, vy: 0, life: 3 });
    if (b.type === 'crown' && run._bossCycle % 2 === 0) run._bossWavePending = 0.35;
  }
  run._bossCycle += 1;
}

function updateBoss(run, h, events) {
  const b = run.boss; const p = run.player;
  if (!b.alive) return;
  if (Math.abs(p.x - b.x) < 1.2 && p.y < 2.8) {
    p.x = b.x + (p.x < b.x ? -1.2 : 1.2); p.vx = 0;
  }
  if (run._bossWavePending > 0) {
    run._bossWavePending -= h;
    if (run._bossWavePending <= 0) { const direction = p.x < b.x ? -1 : 1; run.projectiles.push({ id: `projectile-${run._nextProjectile++}`, type: 'wave', x: b.x + direction * 0.8, y: 0.32, vx: direction * 5 * (run.mode === 'gentle' ? 0.85 : 1), vy: 0, life: 3 }); }
  }
  const near = Math.abs(p.x - b.x) <= 15;
  if (!near) { b.phase = 'dormant'; b.tell = ''; return; }
  if (b.phase === 'dormant') { b.phase = 'telegraph'; b.timer = 1.1 * (run.mode === 'gentle' ? 1.25 : 1); const next = b.type === 'ram' ? '낮은 충격파' : b.type === 'spindle' ? (run._bossCycle % 2 ? '높은 광선' : '낮은 파동') : (run._bossCycle % 2 === 1 ? '높은 광선' : '낮은 파동'); const particle = next === '높은 광선' ? '높은 광선을' : next === '낮은 충격파' ? '낮은 충격파를' : '낮은 파동을'; b.tell = `${particle} 준비합니다.`; emit(run, events, 'boss-tell', { x: b.x, y: b.y, text: `${b.tell} 경고를 읽고 움직이세요.` }); return; }
  b.timer -= h;
  if (b.phase === 'telegraph' && b.timer <= 0) { b.phase = 'attack'; b.timer = 0.42; bossAttack(run, events); return; }
  if (b.phase === 'attack' && b.timer <= 0) { b.phase = 'recovery'; b.timer = b.type === 'ram' ? 1.7 : b.type === 'spindle' ? 1.5 : 1.3; b.tell = '방패가 열렸습니다. 지금 공격하세요.'; emit(run, events, 'boss-open', { x: b.x, y: b.y, text: b.tell }); return; }
  if (b.phase === 'recovery' && b.timer <= 0) { b.phase = 'dormant'; b.tell = ''; }
}

function updateProjectiles(run, level, h, events) {
  const p = run.player;
  for (const shot of run.projectiles) {
    shot.x += shot.vx * h; shot.y += shot.vy * h; shot.life -= h;
    let touches = false;
    if (shot.type === 'beam') touches = Math.abs(p.x - shot.x) < (shot.length || 12) / 2 + RULES.playerWidth / 2 && p.y < shot.y + (shot.width || 0.28) / 2 && p.y + RULES.playerHeight > shot.y - (shot.width || 0.28) / 2;
    else if (shot.type === 'wave') touches = Math.abs(p.x - shot.x) < 0.55 && p.y < 1.0;
    else touches = Math.abs(p.x - shot.x) < RULES.playerWidth / 2 + 0.1 && p.y < shot.y + 0.1 && p.y + RULES.playerHeight > shot.y - 0.1;
    if (touches) { hurtPlayer(run, events, 1, shot.x, shot.y); shot.life = 0; }
  }
  run.projectiles = run.projectiles.filter((shot) => shot.life > 0 && shot.x > -2 && shot.x < level.length + 2);
}

function respawn(run, events) {
  const p = run.player; p.x = run.checkpoint.x; p.y = run.checkpoint.y; p.vx = 0; p.vy = 0; p.grounded = true; p.invulnerable = 1;
  for (const item of run.plates) { item.status = 'attached'; item.x = p.x; item.y = p.y + 0.9; item.vx = 0; item.vy = 0; item.returnTime = 0; }
  emit(run, events, 'hit', { x: p.x, y: p.y, amount: 1, text: '추락했습니다. 체크포인트에서 재기동합니다.' });
}

function stepPhysics(run, level, input, h, events) {
  const p = run.player; const wasGrounded = p.grounded; const oldY = p.y;
  p.invulnerable = Math.max(0, p.invulnerable - h); p.dashCooldown = Math.max(0, p.dashCooldown - h); p.punchTime = Math.max(0, p.punchTime - h); p.fireCooldown = Math.max(0, p.fireCooldown - h);
  const armor = getArmorCount(run); const maxSpeed = RULES.baseSpeed + RULES.speedPerPlate * (6 - armor); const jumpSpeed = RULES.baseJump + RULES.jumpPerPlate * (6 - armor);
  if (p.dashTime > 0) { p.dashTime = Math.max(0, p.dashTime - h); p.vx = p.facing * RULES.dashSpeed; }
  else {
    const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (axis) { p.facing = axis; p.vx += axis * RULES.horizontalAcceleration * h; }
    else p.vx *= Math.max(0, 1 - RULES.horizontalFriction * h);
    p.vx = clamp(p.vx, -maxSpeed, maxSpeed);
  }
  p.x = clamp(p.x + p.vx * h, 0, level.length);
  p.vy -= RULES.gravity * h; p.y += p.vy * h; p.grounded = false;
  const landing = platformUnder(level, p.x, p.y, oldY, p.vy);
  if (landing) { p.y = landing.y; p.vy = 0; p.grounded = true; if (!wasGrounded) emit(run, events, 'land', { x: p.x, y: p.y }); }
  if (p.grounded && Math.abs(p.x - run._checkpointTarget.x) <= 0.8 && Math.abs(p.y - run._checkpointTarget.y) < 0.05) run.checkpoint = { ...run._checkpointTarget };
  if (p.grounded) run._coyote = RULES.coyoteTime; else run._coyote = Math.max(0, run._coyote - h);
  updateRecall(run, events, input, h);
  if (p.y < RULES.fallLimit) { run.hits += 1; run.coreHits += 1; p.hp = Math.max(0, p.hp - 1); if (p.hp <= 0) { run.status = 'lost'; emit(run, events, 'lose', { x: p.x, y: p.y, text: '코어가 추락 충격으로 정지했습니다.' }); } else respawn(run, events); }
  updatePlates(run, level, h, events); updateEnemies(run, level, h, events); updateBoss(run, h, events); updateProjectiles(run, level, h, events);
}

export function step(run, rawInput = {}, dt = 0) {
  if (!run || run.status !== 'playing') { if (run) run.events = []; return []; }
  const level = getLevel(run.levelId); if (!level) { run.status = 'lost'; run.events = [{ type: 'lose', text: '존재하지 않는 임무입니다.' }]; return run.events; }
  const input = inputOf(rawInput); const events = []; const duration = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05); const risingJump = input.jump && !run._prevInput.jump; const risingDash = input.dash && !run._prevInput.dash;
  run._prevInput = input; run.time += duration; run._jumpBuffer = Math.max(0, run._jumpBuffer - duration); if (risingJump) run._jumpBuffer = RULES.jumpBuffer;
  const count = Math.max(1, Math.ceil(duration / (1 / 120))); const h = duration / count;
  for (let i = 0; i < count && run.status === 'playing'; i += 1) {
    const p = run.player;
    if (run._jumpBuffer > 0 && (p.grounded || run._coyote > 0) && !run._recallTriggered) { p.vy = RULES.baseJump + RULES.jumpPerPlate * (6 - getArmorCount(run)); p.grounded = false; run._jumpBuffer = 0; run._coyote = 0; emit(run, events, 'jump', { x: p.x, y: p.y }); }
    if (risingDash && i === 0 && p.dashCooldown <= 0 && p.dashTime <= 0 && !run._recallTriggered && !(input.recall && p.grounded)) { p.dashTime = RULES.dashDuration; p.dashCooldown = RULES.dashCooldown; p.invulnerable = Math.max(p.invulnerable, RULES.dashInvulnerability); emit(run, events, 'dash', { x: p.x, y: p.y }); }
    const recallBlocking = run._recallTriggered || (input.recall && p.grounded);
    if (input.fire && !recallBlocking) fire(run, events);
    if (input.punch && !recallBlocking) punch(run, events);
    stepPhysics(run, level, input, h, events);
  }
  if (run.status === 'playing' && run.boss.alive === false && run.relays.every((relayItem) => relayItem.active) && run.player.x >= level.length - 1) { run.status = 'cleared'; emit(run, events, 'clear', { x: run.player.x, y: run.player.y, text: '릴레이와 보스를 모두 넘어 출구에 도착했습니다.' }); }
  run.events = events; return events;
}

export function summarize(run) {
  const grade = run?.status !== 'cleared' ? null : run.coreHits === 0 && run.hits <= 3 && run.time <= 180 ? 'S' : run.coreHits <= 1 ? 'A' : 'B';
  return { levelId: run?.levelId, mode: run?.mode, status: run?.status, time: run?.time ?? 0, hits: run?.hits ?? 0, coreHits: run?.coreHits ?? 0, grade };
}

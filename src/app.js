import { LEVELS, getLevel, RULES } from './levels.js';
import { createRun, step, getArmorCount, summarize } from './game.js';
import { createScene } from './scene.js';
import { createAudio } from './audio.js';

(() => {
  'use strict';
  const shell = document.querySelector('.app-shell');
  const screenIds = ['title', 'select', 'play', 'pause', 'guide', 'cleared', 'lost', 'ending'];
  const keys = new Map([
    ['a', 'left'], ['arrowleft', 'left'], ['d', 'right'], ['arrowright', 'right'],
    [' ', 'jump'], ['spacebar', 'jump'], ['shift', 'dash'], ['j', 'punch'], ['k', 'fire'], ['r', 'recall']
  ]);
  const store = key => { try { return window.localStorage; } catch (_) { return null; } };
  const clone = value => { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; } };
  const finite = (value, min = 0, max = Infinity) => Number.isFinite(value) && value >= min && value <= max;
  const levelIds = () => (Array.isArray(LEVELS) ? LEVELS.map(level => level.id) : []);
  const defaultSettings = { mode: 'standard', volume: .24, muted: false };
  let settings = loadSettings(), records = loadRecords(), screen = 'title', previousScreen = 'title', guideReturn = 'title';
  let selectedLevel = levelIds()[0] || null, run = null, scene = null, audio = null, sceneError = null;
  let heldKeys = new Set(), heldPointers = new Map(), pressed = new Set(), lastMessage = '', messageUntil = 0, accumulator = 0, lastFrame = performance.now();

  function loadSettings() {
    try { const raw = store('castoff-settings-v1')?.getItem('castoff-settings-v1'); const parsed = JSON.parse(raw); if (parsed && (parsed.mode === 'standard' || parsed.mode === 'gentle') && finite(parsed.volume, 0, 1) && typeof parsed.muted === 'boolean') return { mode: parsed.mode, volume: parsed.volume, muted: parsed.muted }; } catch (_) { /* guarded storage */ }
    return { ...defaultSettings };
  }
  function saveSettings() { try { store('castoff-settings-v1')?.setItem('castoff-settings-v1', JSON.stringify(settings)); } catch (_) { /* unavailable storage */ } }
  function loadRecords() {
    const empty = { standard: {}, gentle: {} }; let parsed;
    try { parsed = JSON.parse(store('castoff-records-v1')?.getItem('castoff-records-v1')); } catch (_) { return empty; }
    if (!parsed || typeof parsed !== 'object') return empty;
    for (const mode of ['standard', 'gentle']) for (const id of levelIds()) {
      const record = parsed[mode]?.[id];
      const expected = record?.coreHits === 0 && record?.hits <= 3 && record?.time <= 180 ? 'S' : record?.coreHits <= 1 ? 'A' : 'B';
      if (record && ['S', 'A', 'B'].includes(record.grade) && record.grade === expected && finite(record.time, 0.001, 3600) && Number.isInteger(record.hits) && record.hits >= 0 && record.hits <= 999 && Number.isInteger(record.coreHits) && record.coreHits >= 0 && record.coreHits <= record.hits) empty[mode][id] = { grade: record.grade, time: record.time, hits: record.hits, coreHits: record.coreHits };
    }
    return empty;
  }
  function saveRecords() { try { store('castoff-records-v1')?.setItem('castoff-records-v1', JSON.stringify(records)); } catch (_) { /* unavailable storage */ } }
  function unlocked(id) { const index = levelIds().indexOf(id); return index <= 0 || !!(records.standard[levelIds()[index - 1]] || records.gentle[levelIds()[index - 1]]); }
  function level() { return getLevel(selectedLevel) || LEVELS.find(item => item.id === selectedLevel) || LEVELS[0]; }
  function inputClear() { heldKeys.clear(); heldPointers.clear(); pressed.clear(); document.querySelectorAll('[data-input].held').forEach(button => button.classList.remove('held')); }
  function setMessage(text, seconds = 3) { lastMessage = text || ''; messageUntil = performance.now() + seconds * 1000; renderHud(); }
  function relayJumpRequirement(relay, player) {
    if (!relay || !player || !player.grounded || !Number.isFinite(relay.y) || !Number.isFinite(player.y)) return null;
    const fixed = 1 / 120, punchVerticalWindow = 0.3, rise = Math.max(0, relay.y - 0.9 - punchVerticalWindow - player.y);
    for (let attached = 6; attached >= 0; attached--) {
      const jump = RULES.baseJump + RULES.jumpPerPlate * (6 - attached);
      let y = 0, velocity = jump, apex = 0;
      for (let tick = 0; tick < 240; tick++) {
        velocity -= RULES.gravity * fixed;
        y += velocity * fixed;
        apex = Math.max(apex, y);
        if (y <= 0 && velocity < 0) break;
      }
      if (apex >= rise) return attached;
    }
    return null;
  }
  function sound(event) { try { audio?.play?.(event); } catch (error) { console.error(error); } }
  function show(next) {
    if (!screenIds.includes(next)) return;
    screen = next; shell.dataset.screen = next;
    for (const id of screenIds) { const element = document.getElementById(`${id}-screen`); if (!element) continue; element.hidden = id !== next; element.setAttribute('aria-hidden', String(id !== next)); }
    if (next === 'play') { audio?.resume?.(); scene?.resize?.(); }
    else if (['cleared', 'lost'].includes(next)) { audio?.stop?.(); scene?.resize?.(); }
    else audio?.pause?.();
    inputClear(); render();
  }
  function renderTitle() {
    const button = document.getElementById('continue-button'); const available = levelIds().some(id => records.standard[id] || records.gentle[id]);
    button.disabled = !available || !!sceneError; button.textContent = available ? '기록 이어하기' : '기록 없음'; document.querySelector('#title-screen [data-action="start"]').disabled = !!sceneError;
  }
  function renderSelect() {
    const list = document.getElementById('level-list'); list.replaceChildren();
    for (const item of LEVELS) { const button = document.createElement('button'); const record = records[settings.mode][item.id]; button.className = `level-card ${item.id === selectedLevel ? 'selected' : ''}`; button.dataset.levelId = item.id; button.disabled = !unlocked(item.id); button.innerHTML = `<strong></strong><small></small><em></em>`; button.querySelector('strong').textContent = item.title; button.querySelector('small').textContent = item.subtitle || ''; button.querySelector('em').textContent = record ? `${settings.mode === 'gentle' ? '완화' : '표준'} ${record.grade} · ${record.time.toFixed(1)}s` : (button.disabled ? '잠김' : '미정복'); list.append(button); }
    document.getElementById('mode-select').value = settings.mode; document.getElementById('volume-range').value = settings.volume; document.getElementById('mute-button').textContent = settings.muted ? '음소거 해제' : '음소거'; document.querySelector('#select-screen [data-action="begin"]').disabled = !!sceneError;
  }
  function renderHud() {
    if (!run) return;
    const item = getLevel(run.levelId) || level(); const armor = getArmorCount(run); const player = run.player || {};
    document.getElementById('level-title').textContent = item.title || run.levelId; document.getElementById('level-subtitle').textContent = item.subtitle || '';
    document.getElementById('armor-count').textContent = armor; document.getElementById('core-hp').textContent = `${Math.max(0, player.hp ?? 0)} / ${player.maxHp ?? (run.mode === 'gentle' ? 5 : 3)}`;
    const icons = document.getElementById('plate-icons'); icons.replaceChildren(); for (let i = 0; i < 6; i++) { const icon = document.createElement('i'); if (i >= armor) icon.className = 'empty'; icons.append(icon); }
    document.getElementById('relay-objective').textContent = `릴레이 ${(run.relays || []).filter(relay => relay.active).length} / ${(run.relays || []).length}`;
    const distance = item.length && Number.isFinite(player.x) ? Math.max(0, item.length - 1 - player.x) : 0; document.getElementById('objective-distance').textContent = `출구까지 ${distance.toFixed(1)}m`;
    const boss = run.boss; const bossDistance = boss && Number.isFinite(player.x) && Number.isFinite(boss.x) ? Math.abs(boss.x - player.x) : Infinity; const tell = boss?.alive && bossDistance <= 15 ? `${boss.tell || '보스가 움직입니다'} · HP ${Math.max(0, boss.hp ?? 0)} / ${boss.maxHp ?? 0}` : ''; document.getElementById('boss-tell').textContent = tell;
    const meter = document.getElementById('recall-meter'); meter.style.width = `${Math.round(Math.min(1, Math.max(0, (player.recallTime || 0) / .8)) * 100)}%`;
    const nextRelay = run.relays.find(relay => !relay.active);
    const tip = document.getElementById('context-tip');
    const requiredArmor = nextRelay ? relayJumpRequirement(nextRelay, player) : null;
    tip.textContent = run.time < 6 && player.x < 9 ? 'A/D 이동 · Space 점프 · K 장갑 발사 · J 펀치'
      : nextRelay && Math.abs(nextRelay.x - player.x) < 6 && !player.grounded ? '공중에서는 J로 릴레이를 맞추세요.'
      : nextRelay && Math.abs(nextRelay.x - player.x) < 6 && requiredArmor !== null ? (armor > requiredArmor ? `현재 장갑 ${armor}장 · 점프 높이에는 장갑 ${requiredArmor}장 이하가 필요합니다. K로 한 장씩 벗긴 뒤 Space 점프 · J 릴레이` : `현재 장갑 ${armor}장 · 점프 높이 충족. Space 점프 · 공중에서 J로 다음 릴레이 켜기`)
      : nextRelay && Math.abs(nextRelay.x - player.x) < 6 ? '이 릴레이는 현재 위치에서 직선 점프 범위를 벗어났습니다. 아래 발판을 먼저 찾으세요.'
      : armor < 3 ? '지상에서 R을 길게 눌러 장갑을 회수하세요.'
      : boss?.alive && bossDistance <= 15 ? '낮은 파동은 점프 · 높은 광선은 지상에서 · 방패가 열리면 K'
      : 'A/D 이동 · Space 점프 · Shift 대시 · J 펀치 · K 발사 · R 회수';
    document.getElementById('feedback').textContent = lastMessage && performance.now() < messageUntil ? lastMessage : '';
  }
  function renderResult() {
    const summary = run ? summarize(run) : null; const target = screen === 'cleared' ? 'cleared' : 'lost'; const stats = document.getElementById(`${target}-stats`); if (summary && stats) stats.textContent = `시간 ${summary.time.toFixed(1)}초 · 총 피격 ${summary.hits}회 · 코어 피해 ${summary.coreHits}회 · 등급 ${summary.grade || '—'}`;
    if (screen === 'cleared') { document.getElementById('cleared-title').textContent = `${level()?.title || '임무'} 연결 완료`; document.getElementById('cleared-copy').textContent = level()?.subtitle || '릴레이가 응답했습니다.'; document.querySelector('#cleared-screen [data-action="next"]').textContent = levelIds().indexOf(run?.levelId) === levelIds().length - 1 ? '결말 보기' : '다음 임무'; }
  }
  function renderEnding() { const stats = levelIds().map(id => records.standard[id] || records.gentle[id]).filter(Boolean); document.getElementById('ending-stats').textContent = `복구한 임무 ${stats.length} / ${levelIds().length} · 최고 기록 ${stats.length ? Math.min(...stats.map(item => item.time)).toFixed(1) + '초' : '—'}`; }
  function render() { if (screen === 'title') renderTitle(); else if (screen === 'select') renderSelect(); else if (screen === 'play') renderHud(); else if (screen === 'cleared' || screen === 'lost') renderResult(); else if (screen === 'ending') renderEnding(); }
  function begin(levelId = selectedLevel) {
    if (sceneError) return setMessage('3D 장면을 시작할 수 없습니다. 페이지를 새로고침해 주십시오.');
    selectedLevel = levelId; inputClear(); run = createRun(selectedLevel, settings.mode); audio?.stop?.(); try { audio?.unlock?.(); audio?.start?.(); } catch (error) { console.error(error); setMessage('오디오는 사용할 수 없지만 게임은 계속할 수 있습니다.'); } show('play');
  }
  function continueRun() { if (sceneError) return setMessage('3D 장면을 초기화하지 못해 출격할 수 없습니다.'); const first = levelIds().find(id => unlocked(id) && !records.standard[id] && !records.gentle[id]) || levelIds().at(-1); if (first) { selectedLevel = first; settings.mode = records.gentle[first] && !records.standard[first] ? 'gentle' : settings.mode; saveSettings(); show('select'); } else show('select'); }
  function persistClear() { const summary = summarize(run); if (!summary || summary.status !== 'cleared') return; const bucket = records[run.mode]; const prior = bucket[run.levelId]; const rank = { S: 3, A: 2, B: 1 }; if (!prior || rank[summary.grade] > rank[prior.grade] || (summary.grade === prior.grade && summary.time < prior.time)) bucket[run.levelId] = { grade: summary.grade, time: summary.time, hits: summary.hits, coreHits: summary.coreHits }; saveRecords(); }
  function processEvents(batch) { for (const event of batch) { if (event.text && !['shot', 'armor-return', 'boss-tell', 'boss-open'].includes(event.type)) setMessage(event.text, 2.2); if (event.type === 'clear') { persistClear(); show('cleared'); sound(event); } else if (event.type === 'lose') { show('lost'); sound(event); } else sound(event); } }
  function nextMission() { const index = levelIds().indexOf(run?.levelId); if (index >= 0 && index < levelIds().length - 1) { selectedLevel = levelIds()[index + 1]; begin(selectedLevel); } else { run = null; show('ending'); } }
  function isHeld(action) { for (const key of heldKeys) if (keys.get(key) === action) return true; for (const pointerAction of heldPointers.values()) if (pointerAction === action) return true; return false; }
  function activeInput() { const input = {}; for (const action of ['left', 'right', 'jump', 'dash', 'punch', 'fire', 'recall']) input[action] = isHeld(action) || pressed.has(action); return input; }
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (screen === 'play' && run?.status === 'playing') { accumulator += dt; let loops = 0, batch = []; while (accumulator >= 1 / 120 && loops < 8) { const input = activeInput(); const result = step(run, input, 1 / 120) || []; if (Array.isArray(result)) batch.push(...result); accumulator -= 1 / 120; loops++; pressed.clear(); } if (batch.length) processEvents(batch); scene?.update?.(run, dt, { screen, levelId: run.levelId, events: batch, shake: batch.some(event => event.type === 'hit'), flash: batch.some(event => event.type === 'relay' || event.type === 'enemy-down') }); audio?.update?.(run, dt); renderHud(); } else { accumulator = 0; scene?.update?.(run, 0, { screen, levelId: run?.levelId || selectedLevel, events: [], shake: false, flash: false }); }
    requestAnimationFrame(frame);
  }
  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === 'm' && !event.repeat) { settings.muted = !settings.muted; saveSettings(); audio?.setMuted?.(settings.muted); render(); return; }
    if (screen === 'play') { const action = keys.get(key); if (action) { heldKeys.add(key); if (['jump', 'dash', 'punch', 'fire'].includes(action) && !event.repeat) pressed.add(action); event.preventDefault(); return; } if (key === 'escape' && !event.repeat) { previousScreen = 'play'; inputClear(); audio?.pause?.(); show('pause'); event.preventDefault(); return; } }
    if (screen === 'select' && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { const available = levelIds().filter(unlocked), index = available.indexOf(selectedLevel), direction = ['arrowup', 'arrowleft'].includes(key) ? -1 : 1; selectedLevel = available[(index + direction + available.length) % available.length]; renderSelect(); event.preventDefault(); return; }
    if (!event.repeat && key === 'escape') { if (screen === 'select') show('title'); else if (screen === 'guide') show(guideReturn); else if (screen === 'pause') show(previousScreen === 'play' && run ? 'play' : 'title'); event.preventDefault(); return; }
    if (screen === 'lost' && key === 'r' && !event.repeat) { begin(run?.levelId || selectedLevel); event.preventDefault(); return; }
    if (!event.repeat && key === 'enter') { if (screen === 'title') { if (sceneError) setMessage('3D 장면을 초기화하지 못해 출격할 수 없습니다.'); else show('select'); } else if (screen === 'select') begin(); else if (screen === 'cleared') nextMission(); else if (screen === 'lost') begin(run?.levelId || selectedLevel); else if (screen === 'ending') show('title'); event.preventDefault(); }
  }
  function onKeyUp(event) { const key = event.key.toLowerCase(); if (keys.has(key)) { heldKeys.delete(key); event.preventDefault(); } }
  function onPointer(event) { const button = event.target.closest?.('[data-input]'); const action = event.type === 'pointerdown' ? button?.dataset.input : heldPointers.get(event.pointerId); if (!action || screen !== 'play') return; if (event.type === 'pointerdown') { heldPointers.set(event.pointerId, action); if (['jump', 'dash', 'punch', 'fire'].includes(action)) pressed.add(action); button.classList.add('held'); button.setPointerCapture?.(event.pointerId); event.preventDefault(); } else { heldPointers.delete(event.pointerId); if (![...heldPointers.values()].includes(action)) document.querySelector(`[data-input="${action}"]`)?.classList.remove('held'); event.preventDefault(); } }
  function onClick(event) {
    const levelButton = event.target.closest?.('[data-level-id]'); if (levelButton && !levelButton.disabled) { selectedLevel = levelButton.dataset.levelId; renderSelect(); return; }
    const button = event.target.closest?.('[data-action]'); if (!button || button.disabled) return; const action = button.dataset.action;
    if (action === 'start') { if (sceneError) setMessage('3D 장면을 초기화하지 못해 출격할 수 없습니다.'); else show('select'); } else if (action === 'begin') { if (screen === 'ending') { run = null; show('select'); } else begin(); } else if (action === 'continue') continueRun(); else if (action === 'next') nextMission(); else if (action === 'retry') begin(run?.levelId || selectedLevel); else if (action === 'resume') { show(previousScreen === 'play' && run ? 'play' : 'title'); } else if (action === 'pause' && screen === 'play') { previousScreen = 'play'; inputClear(); audio?.pause?.(); show('pause'); } else if (action === 'guide') { guideReturn = screen; inputClear(); audio?.pause?.(); show('guide'); } else if (action === 'back') { if (screen === 'guide') show(guideReturn); else if (['pause', 'cleared', 'lost'].includes(screen)) show('select'); else show('title'); } else if (action === 'mute') { settings.muted = !settings.muted; saveSettings(); audio?.setMuted?.(settings.muted); render(); }
  }
  function boot() {
    try { scene = createScene(document.getElementById('world')); scene.resize?.(); } catch (error) { sceneError = error; console.error(error); const banner = document.getElementById('error-banner'); banner.hidden = false; banner.textContent = '3D 장면을 초기화하지 못했습니다. 브라우저의 그래픽 가속을 확인해 주십시오.'; document.querySelectorAll('[data-action="begin"]').forEach(button => { button.disabled = true; }); }
    try { audio = createAudio(); audio.setVolume?.(settings.volume); audio.setMuted?.(settings.muted); } catch (error) { console.error(error); audio = null; }
    document.getElementById('mode-select').addEventListener('change', event => { settings.mode = event.target.value === 'gentle' ? 'gentle' : 'standard'; saveSettings(); renderSelect(); }); document.getElementById('volume-range').addEventListener('input', event => { settings.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0)); saveSettings(); audio?.setVolume?.(settings.volume); });
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp); document.addEventListener('click', onClick); document.addEventListener('pointerdown', onPointer, { passive: false }); document.addEventListener('pointerup', onPointer, { passive: false }); document.addEventListener('pointercancel', onPointer, { passive: false }); document.addEventListener('lostpointercapture', onPointer, { passive: false }); window.addEventListener('pointerup', onPointer, { passive: false }); window.addEventListener('pointercancel', onPointer, { passive: false }); window.addEventListener('blur', () => { if (screen === 'play' && run?.status === 'playing') { previousScreen = 'play'; inputClear(); audio?.pause?.(); show('pause'); } else inputClear(); }); document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && run?.status === 'playing') { previousScreen = 'play'; inputClear(); audio?.pause?.(); show('pause'); } }); window.addEventListener('resize', () => scene?.resize?.());
    Object.defineProperty(window, '__castoff', { configurable: false, enumerable: true, get: () => ({ get ready() { return !sceneError; }, get screen() { return screen; }, get run() { return clone(run); }, get settings() { return clone(settings); }, get records() { return clone(records); }, get sceneStats() { return clone(scene?.stats || {}); }, get selection() { return { levelId: selectedLevel }; } }) });
    render(); requestAnimationFrame(frame);
  }
  boot();
})();

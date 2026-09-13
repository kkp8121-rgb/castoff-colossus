// Observer-only test driver. The same inputs run in the pure engine and real browser.
class RoutePolicy {
  constructor(level) { this.level = level; this.recalling = false; this.lastJump = false; this.lastDash = false; this.phase = ''; }
  decide(run) {
    const p = run.player, n = run.plates.filter(plate => plate.status === 'attached').length;
    const keys = [], push = (...items) => keys.push(...items);
    const moveTo = target => { const predicted = p.x + p.vx * .045; if (predicted < target - .12) push('d'); else if (predicted > target + .12) push('a'); };
    const jump = () => { if (p.grounded && !this.lastJump) push('Space'); };
    const relay = run.relays.find(item => !item.active);
    this.phase = relay ? relay.id : run.boss.alive ? 'boss' : 'exit';
    if (this.recalling || run._recallTriggered) {
      if (n === 6) this.recalling = false;
      else push('r');
    }
    if (!this.recalling && !run._recallTriggered) {
      if (relay) {
        const target = relay.x - .8, distance = target - p.x;
        if (Math.abs(distance) > .3) moveTo(target);
        else {
          if (p.facing !== 1) push('d');
          const required = Math.max(0, Math.min(6, Math.floor(6 - (Math.sqrt(52 * (relay.y - .9 + .12)) - 9) / .7)));
          if (n > required) push('k');
          else if (p.grounded) jump();
          if (Math.abs(relay.y - (p.y + .9)) < .45) push('j');
        }
        const foe = run.enemies.find(item => item.alive && (item.x - p.x) * p.facing >= 0 && Math.abs(item.x - p.x) < 5 && Math.abs(item.y - p.y) < 1);
        if (foe && Math.abs(distance) > 1) { if (n > 0) push('k'); if (Math.abs(foe.x - p.x) < 1.6) push('j'); }
        if (n === 0 && p.grounded && Math.abs(distance) > 5 && !foe) { keys.length = 0; push('r'); this.recalling = true; }
      } else if (run.boss.alive) {
        const target = run.boss.x - 4.5;
        moveTo(target);
        const foe = run.enemies.find(item => item.alive && item.x >= p.x - .1 && item.x - p.x < 6 && Math.abs(item.y - p.y) < 1);
        if (foe) { if (n > 0) push('k'); if (foe.x - p.x < 1.6) push('j'); }
        else if (run.boss.phase === 'recovery' && p.y < .85 && p.facing === 1) { if (n > 0) push('k'); if (run.boss.x - p.x < 1.6) push('j'); }
        if (n === 0 && p.grounded) { keys.length = 0; push('r'); this.recalling = true; }
      } else moveTo(this.level.length - .7);
    }
    const ground = this.level.platforms.find(item => item.y === 0 && p.x >= item.x && p.x <= item.x + item.width);
    if (keys.includes('d') && p.grounded && p.y < .05 && ground && ground.x + ground.width < this.level.length && ground.x + ground.width - p.x < 1.15) {
      jump(); if (!this.lastDash && p.dashCooldown <= 0) push('Shift');
    }
    const incoming = run.projectiles.some(shot => shot.type === 'wave' && (p.x - shot.x) * shot.vx > 0 && Math.abs(p.x - shot.x) < 1.4);
    const bolt = run.projectiles.some(shot => shot.type === 'bolt' && (p.x - shot.x) * shot.vx > 0 && Math.abs(p.x - shot.x) < 1.5 && shot.y < p.y + 1.8);
    if ((incoming || bolt) && p.grounded && !run._recallTriggered) {
      keys.splice(0, keys.length, ...keys.filter(key => key !== 'r')); this.recalling = false; jump();
    }
    this.lastJump = keys.includes('Space'); this.lastDash = keys.includes('Shift');
    return [...new Set(keys)];
  }
}
const inputFor = keys => Object.fromEntries(Object.entries({ left: 'a', right: 'd', jump: 'Space', dash: 'Shift', punch: 'j', fire: 'k', recall: 'r' }).map(([action, key]) => [action, keys.includes(key)]));
module.exports = { RoutePolicy, inputFor };

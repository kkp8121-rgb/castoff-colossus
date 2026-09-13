const platform = (id, x, width, y) => Object.freeze({ id, x, width, y });
const relay = (id, x, y) => Object.freeze({ id, x, y });
const enemy = (id, type, x, y, patrolMin, patrolMax) => Object.freeze({ id, type, x, y, patrolMin, patrolMax });

export const RULES = Object.freeze({
  playerWidth: 0.84, playerHeight: 1.8, gravity: 26,
  baseSpeed: 4.4, speedPerPlate: 0.17, baseJump: 9, jumpPerPlate: 0.7,
  horizontalAcceleration: 30, horizontalFriction: 20, coyoteTime: 0.1, jumpBuffer: 0.12,
  dashSpeed: 11.5, dashDuration: 0.18, dashCooldown: 1.1, dashInvulnerability: 0.12,
  punchRange: 1.65, punchCooldown: 0.32, punchDamage: 2,
  fireSpeed: 17, fireCooldown: 0.22, fireDamage: 4, recallCharge: 0.8, recallDuration: 0.55,
  hitInvulnerability: 0.85, fallLimit: -5, standardHp: 3, gentleHp: 5,
  enemyDamage: 1, bossContactDamage: 1
});

export const LEVELS = Object.freeze([
  Object.freeze({
    id: 'foundry', title: '빈 장갑의 도약', subtitle: '무게를 벗어 첫 릴레이를 깨우세요.', length: 64,
    platforms: Object.freeze([
      platform('ground-a', 0, 20, 0), platform('relay-a', 10, 4, 2.2), platform('ground-b', 22, 42, 0), platform('relay-b', 30, 4, 2.8)
    ]),
    relays: Object.freeze([relay('foundry-relay-a', 12, 3.1), relay('foundry-relay-b', 32, 3.7)]),
    enemies: Object.freeze([
      enemy('foundry-walker-a', 'walker', 7, 0, 4, 11), enemy('foundry-walker-b', 'walker', 28, 0, 25, 35),
      enemy('foundry-walker-c', 'walker', 39, 0, 36, 44), enemy('foundry-turret', 'turret', 46, 0, 46, 46)
    ]),
    boss: Object.freeze({ id: 'foundry-ram', type: 'ram', x: 55, y: 0, hp: 18 }),
    checkpoint: Object.freeze({ x: 43, y: 0 }),
    intro: '처음에는 무겁습니다. 세 장의 장갑판을 발사하면 점프가 높아지고, 릴레이에 닿은 뒤에는 지상에서 R을 길게 눌러 회수하세요.'
  }),
  Object.freeze({
    id: 'bridges', title: '허공의 회수선', subtitle: '빈틈을 넘고 높은 릴레이를 이어 붙이세요.', length: 78,
    platforms: Object.freeze([
      platform('ground-a', 0, 24, 0), platform('relay-a', 15, 4, 2.5), platform('ground-b', 27, 21, 0),
      platform('relay-b', 30, 4, 1.2), platform('relay-c', 39, 4, 3.1), platform('ground-c', 50, 28, 0)
    ]),
    relays: Object.freeze([relay('bridges-relay-a', 17, 3.4), relay('bridges-relay-b', 41, 4)]),
    enemies: Object.freeze([
      enemy('bridges-drone', 'drone', 10, 2.5, 7, 14), enemy('bridges-walker', 'walker', 33, 0, 29, 37),
      enemy('bridges-turret', 'turret', 45, 0, 45, 45), enemy('bridges-walker-b', 'walker', 57, 0, 53, 62)
    ]),
    boss: Object.freeze({ id: 'bridges-spindle', type: 'spindle', x: 69, y: 0, hp: 24 }),
    checkpoint: Object.freeze({ x: 57, y: 0 }),
    intro: '다리는 끊겼지만 릴레이는 남아 있습니다. 발사한 장갑판은 바닥에 떨어져도 사라지지 않으니, 안전한 발판에서 회수하세요.'
  }),
  Object.freeze({
    id: 'crown', title: '가장 가벼운 거인', subtitle: '모든 릴레이를 되살리고 네트워크를 탈환하세요.', length: 92,
    platforms: Object.freeze([
      platform('ground-a', 0, 22, 0), platform('relay-a', 16, 4, 2.7), platform('ground-b', 25, 31, 0),
      platform('relay-b', 47, 4, 3), platform('ground-c', 59, 33, 0), platform('relay-c-low', 63, 3, 1.4), platform('relay-c-high', 67, 4, 3)
    ]),
    relays: Object.freeze([relay('crown-relay-a', 18, 3.6), relay('crown-relay-b', 49, 3.9), relay('crown-relay-c', 69, 3.9)]),
    enemies: Object.freeze([
      enemy('crown-drone-a', 'drone', 12, 2.5, 9, 15), enemy('crown-turret-a', 'turret', 36, 0, 36, 36),
      enemy('crown-walker', 'walker', 47, 0, 43, 51), enemy('crown-drone-b', 'drone', 62, 2.5, 60, 66),
      enemy('crown-turret-b', 'turret', 74, 0, 74, 74)
    ]),
    boss: Object.freeze({ id: 'crown-crown', type: 'crown', x: 83, y: 0, hp: 30 }),
    checkpoint: Object.freeze({ x: 75, y: 0 }),
    intro: '왕관형 거인은 낮은 파동과 높은 광선을 번갈아 준비합니다. 경고를 읽고 뛰거나 낮게 머문 뒤, 방패가 열린 순간을 노리세요.'
  })
]);

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) || null;
}

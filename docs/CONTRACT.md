# CASTOFF COLOSSUS · 벗어던진 거인

## Root design

Genre: 2.5D side-scrolling mech action platformer, three missions with boss encounters. The camera looks along +Z toward a playable X/Y plane. This is a small complete action game, not a top-down arena or a modelling demo.

Theme: protection has weight. Hook: **장갑을 탄환으로 쏠수록 더 높이 도약하는 거대로봇으로, 버리고 되찾는 전투를 펼친다.** The six visible armor plates are ammunition, damage protection, and movement weight. Fire them to reach high relay platforms, then choose a safe grounded window to recall them. The exposed core remains vulnerable.

Compared candidates: a botanical ecosystem simulation, a volleyball action game, and an armor-shedding mech platformer. The mech game follows the illustrated courtroom adventure with direct spatial control, kinetic feedback, articulated 3D modelling and a mechanic that changes both combat and traversal. Do not drift into unrelated upgrades, a shop, or a long RPG.

Original adult pilot **Rhea / 레아, 31**, copper-orange short hair, charcoal pilot suit, cobalt harness, yellow signal scarf. Her machine has an ivory tapered shell, charcoal joints, cobalt core light and warning-yellow edges. Six distinct detachable plates: two shoulders, two forearms, chest and back. Root creates original key art; procedural Three.js models are original code-native geometry.

## Controls and loop

- A/D or Left/Right: move/facing. Space: buffered jump. Shift: short dash. J: punch. K: fire one attached plate forward. Hold R while grounded: recall plates. Esc: pause. M: mute. Enter: title/select start, clear next, loss retry. R also retries only when lost.
- Touch: seven labelled buttons left/right/jump/dash/punch/fire/recall, actual pointer down/up holds and simultaneous touches. Menus work with touch. No pointer lock or mouse aiming is required. Mouse clicks on menu buttons never fire.
- First 30 seconds: movement, fire three plates to lighten, jump to the first relay, shoot or punch it, recall on the ground. In-level tips explain current armor count and jump difference. Controls remain readable; avoid an obstructive mandatory text modal.
- Each mission: activate every elevated relay, defeat the end boss, reach the exit. Clear unlocks the next mission. Final clear leads to a concise ending with Rhea and the recovered evacuation network. Two difficulties plus per-mission records. No unfinished-run save.

## Engine API — core owns src/levels.js, src/game.js, tests/game.test.mjs

`levels.js` exports `LEVELS`, `getLevel(id)`, `RULES`.
Each level: `{id,title,subtitle,length,platforms:[{id,x,width,y}],relays:[{id,x,y}],enemies:[{id,type:'walker'|'turret'|'drone',x,y,patrolMin,patrolMax}],boss:{id,type:'ram'|'spindle'|'crown',x,y,hp},checkpoint:{x,y},intro}`.
Platform x is LEFT edge, y is TOP. Relays x/y are CENTER. Actor x is horizontal center, actor y is FEET. All gameplay lies at z=0. Ground consists of platform intervals, not an invisible whole-floor collider.

`game.js` exports `createRun(levelId,mode='standard')`, `step(run,input,dt)`, `getArmorCount(run)`, `summarize(run)`.
Input exactly `{left,right,jump,dash,punch,fire,recall}` booleans. step mutates the private run and returns this step's events; it also replaces `run.events`. Continuous hold of fire/punch respects cooldown. Jump/dash must require a fresh press or buffer; holding jump must not repeatedly jump on landing. R hold is deliberate continuous recall.

Run minimum:
`{levelId,mode,status:'playing'|'cleared'|'lost',time,player:{x,y,vx,vy,facing,grounded,hp,maxHp,invulnerable,dashTime,dashCooldown,punchTime,fireCooldown,recallTime},plates:[{id,status:'attached'|'flying'|'loose'|'returning',x,y,vx,vy,returnTime}],enemies:[{id,type,x,y,hp,maxHp,alive,facing,phase,timer}],relays:[{id,x,y,active}],boss:{id,type,x,y,hp,maxHp,alive,phase,timer,tell},projectiles:[{id,type:'bolt'|'wave'|'beam',x,y,vx,vy,life}],checkpoint:{x,y},hits,coreHits,feedback,events}`.
Additional internal numeric fields are allowed; keep this public shape. Never put Three objects or DOM objects in the run. All state must serialize. Exactly six plate IDs 0..5 exist for the whole run. Do not duplicate or permanently lose them.

Events: `{type:'jump'|'land'|'dash'|'punch'|'shot'|'recall'|'armor-return'|'hit'|'enemy-down'|'relay'|'boss-tell'|'boss-open'|'clear'|'lose'|'denied',x?,y?,amount?,text?}`. Feedback and tell are Korean player-facing text. Core runs only while status playing. Terminal step is inert. Invalid ids fail explicitly. Unknown mode normalizes standard.

## Movement, armor, damage

Use substeps <=1/120 s for collisions if needed; accept dt up to .05 s. No frame-rate dependent timers.
- Player width .84, height 1.8. Gravity 26. Attached plate count n: speed `4.4 + .17*(6-n)`, jump velocity `9 + .7*(6-n)` (heavy apex 1.56, empty apex 3.35). Horizontal acceleration and friction, coyote .10 s, jump buffer .12 s. No double jump.
- Dash duration .18 s at 11.5 speed, cooldown 1.1 s; invulnerability during first .12 s. Punch range 1.65, cooldown .32, damage 2. Horizontal plate shot speed 17, cooldown .22, damage 4. Fire originates facing*.55 and feet+.95. Mild recoil and animation. Shot does not home; jumping aligns height with elevated targets.
- Firing selects an attached plate; it flies, damages one enemy/relay/boss and then becomes loose. Ground/platform impacts also make it loose. Loose plates settle on platforms or clamp back into the recoverable level if they leave its bounds. Six plates are always recoverable.
- Grounded R hold slows motion, prevents attack/dash, builds recall charge .8 s. Jumping interrupts charge. On completion all non-attached plates become returning and reattach over .55 s; each returns its original body part. Releasing R after initiation does not cancel returning plates. Do not repeatedly start empty recalls. A visible charge bar explains the vulnerable window.
- Standard core hp3; gentle hp5. Enemy damage detaches one attached armor plate first; only an empty chassis loses core hp. Hit invulnerability .85 s and knockback prevent multi-hit stacks. Track hits/coreHits. Gentle telegraphs ×1.25 and hostile projectile speed ×.85. Falling below y=-5 costs one core hp and respawns at the current checkpoint with relays/enemies preserved; armor is recoverable. At hp0: lost.
- One-way platform landing uses feet crossing from above; horizontal movement can pass beneath raised platforms. Do not let a player fall through a platform when a long frame is split. World x clamps to level bounds. Exit remains closed until relays and boss are complete.

## Authored missions (keep coordinates physically reachable)

1. `foundry` / **빈 장갑의 도약**, length64. Ground [0,20], [22,64] at y0. Relay platforms x10 width4 y2.2 and x30 width4 y2.8. Relay centers (12,3.1),(32,3.7). Walker x7 and28 and39, turret46. Checkpoint(43,0). Ram boss(55,0), hp18. First relay requires shedding at least three plates before jumping from ground; communicate this with a contextual tip.
2. `bridges` / **허공의 회수선**, length78. Ground [0,24],[27,48],[50,78]. Raised platforms x15 width4 y2.5; x30 width4 y1.2; x39 width4 y3.1. Relays(17,3.4),(41,4). Drone(10,2.5), walker33, turret45, walker57. Checkpoint(57,0). Spindle boss(69,0), hp24.
3. `crown` / **가장 가벼운 거인**, length92. Ground [0,22],[25,56],[59,92]. Raised platforms x16 width4 y2.7; x47 width4 y3; x63 width3 y1.4; x67 width4 y3. Relays(18,3.6),(49,3.9),(69,3.9). Drone(12,2.5), turret36, walker47, drone(62,2.5), turret74. Checkpoint(75,0). Crown boss(83,0), hp30.

Enemy patrol intervals must avoid walking over pits or through relay platforms. Keep ordinary enemies readable with telegraphs/cooldowns, not unavoidable contact damage every frame. Boss arena begins within 15 m of boss; bosses remain dormant earlier so long-range unseen projectiles do not cross the level.
Ram: telegraph ~1.1 s, low horizontal shock wave (jump), then vulnerable recovery ~1.7 s.
Spindle: alternate low wave and a high beam at feet+2.1 (stay low); recovery ~1.5 s. Beam must have a clear warning and finite active duration, not a permanent wall.
Crown: two spaced low waves followed next cycle by a high beam; recovery ~1.3 s. Shield closed outside recovery; closed hits give explicit feedback and drop the plate. Punch/shot damages during recovery. Gentle extends tells. All boss attacks must be dodgeable through movement/jump/dash; never spawn a bolt inside the player.
Clear when boss defeated, all relays active and player x>=length-1. Enter advances through three missions; stage loss retry resets that stage only. `summarize` returns `{levelId,mode,status,time,hits,coreHits,grade}`. S: cleared/coreHits0/hits<=3/time<=180; A: cleared/coreHits<=1; B: other cleared. Grade null before clear. Records compare grade then time.

## Presentation API — presentation owns src/models.js, src/scene.js, src/audio.js

`createScene(container)` returns `{update(run|null,dt,view),resize(),dispose(),get stats()}`. View `{screen,levelId,shake,flash}`. Stats copies `{software,pixels,frames,drawCalls,triangles,levelId,attachedPlates,geometries}`. The actual canvas lives in `#world` host and is visible during play. Camera follows X smoothly, includes ground and elevated relays, and fits portrait/mobile safely. Read only existing level/run shapes, no speculative aliases.
Software400k pixels/no shadows, hardware<=1.5M/restrained shadows. Dispose old level geometry only when levelId changes. Reuse actor/plate meshes; no per-frame rebuild. Plate body parts match ids and status exactly. Articulated mech feet align collision feet, ordinary enemies and three distinctive bosses match their colliders; platforms have anchored pillars or hanging supports. Side camera shows 3D depth but does not obscure jump surfaces. Use beveled/tapered armor, pistons, joints, exhaust, lights, reactive poses, projectiles and brief hit sparks. Rhea's key art is UI only, no need to texture WebGL.
`createAudio()` returns `{unlock,setVolume,setMuted,start,pause,resume,stop,play,update,dispose}`. Synthesized mech motors, cannon, metallic land, recall and restrained music. Volume zero/missing AudioContext supported; pause suspends context and clears scheduled motifs; resume restores exactly once. `play` accepts event type or event object. Avoid continuous-tone/source leaks.

## App API — app owns index.html, style.css, src/app.js

Screens exactly `title/select/play/pause/guide/cleared/lost/ending`. Core statuses map only after checking status. Controls above, touch seven distinct held actions, blur/visibility auto-pause stores previous screen, clears held keys. Pause→guide→back stays suspended; Escape from select returns title; no menu click enters gameplay input. Events drained once per simulation step. Use RAF dt cap plus core substep; optional tiny hit-stop on hits must not accumulate stale dt.
HUD: six plate icons/count, core hp, active relays/total, objective distance, boss tell/health when nearby, recall charge, concise contextual tip. No debug/implementation details in product UI. Start/title has original `assets/key-art.webp` and strong hook; controls/guide/settings accessible. Mobile controls>=44px, visible and center hittable at390x844 and844x390. Keyboard is primary; game never auto-launches browser.
Storage keys `castoff-records-v1`, `castoff-settings-v1`. Records `{standard:{levelId:{grade,time,hits,coreHits}},gentle:{...}}` strict knownIDs, validgrade, finitepositive time<=3600, nonnegativeinteger hits/coreHits<=999, coreHits<=hits. Settings `{mode:'standard'|'gentle',volume:.24,muted:false}`. Unlock next when previous completed in either mode. Default first level. All localStorage reads/writes guarded. No active run save.
Inspection `window.__castoff` getters: ready,screen,run,settings,records,sceneStats,selection `{levelId}`; copies only, no setters or debug win functions.
Selectors `[data-action=start|begin|continue|next|retry|resume|guide|back|pause|mute]`, `[data-level-id]`, `[data-input=left|right|jump|dash|punch|fire|recall]`, `#mode-select`, `#volume-range`, host `#world`, canvas `#world-canvas`.

## Release ownership

Root owns tests/browser-tools.cjs and all browser/interaction/campaign/geometry/package tests, art, docs/tooling, integration and Git. Workers never build, browse visibly, commit or push. Root will headlessly play all missions with real inputs and independently verify fall/retry, touch holds, audio, file://, HTTP subpath, performance and ZIP hashes. Public repo `kkp8121-rgb/castoff-colossus`, Pages main/root only after per-push approval. Port4181, local subpath `/castoff-colossus/`, test env `CASTOFF_URL`.

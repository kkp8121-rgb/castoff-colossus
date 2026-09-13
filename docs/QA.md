# Verification — 2026-09-13

All browser sessions were headless Chromium. No visible browser was opened. Test drivers use actual keyboard/CDP touch inputs and copied inspection snapshots; they never write live game state. Unit tests use isolated fixtures. Storage fixtures are explicitly separate from campaign play.

## Complete campaign

Final JavaScript SHA-256: `46eabe7b8e7917cf28d83f41f03e45dfcdecf53232b07e1f55ecb9725676590f`.

| Mission | Time | Relays | Hits / core damage | Grade |
|---|---:|---:|---:|---|
| Foundry | 19.675 s | 2 | 1 / 0 | S |
| Bridges | 22.000 s | 2 | 2 / 1 | A |
| Crown | 38.258 s | 3 | 3 / 1 | A |

186 actual key transitions completed all seven relays, three bosses, exits and the final ending. All three records persisted after reload. These are an automated practiced route's times, not an estimate of a first-time human playthrough. The driver includes real jumps, shots, recall, boss dodges and a recovered fall; it does not grant health, skip time, warp or force victory.

The campaign sampled 4,793 active frames: mean 16.701 ms, p95 16.8 ms. Final active scene used 1,296,000 pixels, 134 draw calls and 6,352 triangles. Audio peak was 0.0838703, with no page or request errors. This is a local machine measurement, not a guarantee for other devices.

## Gameplay and interaction

`npm test`: 14 tests passed. Coverage includes weight-dependent jump height, six persistent plate IDs and recall, armor before core damage, invulnerability, actual checkpoint acquisition, one-way landing, input partitioning, expired enemy tells, grounded/airborne beam collision, crown double-wave/beam alternation, gentle tells, relay reach, empty-fire cooldown, boss shields, terminal completion, model plate parenting and visible feet/platform alignment.

`test:browser`: direct file and HTTP `/castoff-colossus/` loading, actual three-plate shedding and higher jump, recall to six, copied inspection isolation, pause/guide/resume, audible output and mute to zero. The measured three-plate jump apex was 2.32194 m. Relative assets, classic bundled script and offline audio load without external runtime requests.

`test:interaction`: 11 scenarios passed. Actual two-finger movement+jump reached y=1.2583 m; movement+fire left four plates; ground recall restored six; outside release/cancel stopped movement. Keyboard aliases and keyboard/touch sources remain independently held. Pause freezes simulation/audio, blur clears inputs, three actual pit falls cause loss and R starts a fresh mission. Malformed/throwing storage, three inconsistent records, a valid gentle record, zero-volume persistence, missing audio and blocked WebGL are covered.

`tests/visual.cjs`: title, selection and play inspected at 1440×900, 390×844 and 844×390. Enabled controls are in the viewport, center hittable and at least 44 px high; seven touch controls remain usable. Short landscape title controls and mission selection were repaired after screenshots exposed clipping. Final screenshots were visually inspected for terrain gaps, chassis grounding, UI readability and industrial depth.

## Final scene performance

Opening foundry scene, 2-second warmup then 6-second sample; no gameplay speed override:

| Renderer | CPU throttle | Pixels | Mean / p95 |
|---|---:|---:|---:|
| SwiftShader | 1× | 400,000 | 16.666 / 16.7 ms |
| SwiftShader | 4× | 400,000 | 23.419 / 33.4 ms |
| NVIDIA RTX 3060 Ti, ANGLE D3D11 | 1× | 1,296,000 | 16.666 / 16.7 ms |

Software rendering disables shadows and caps pixels. Hardware shadows follow the player. The final opening hardware scene uses 179 draw calls and 7,472 triangles. These short samples measure this scene; the separate full campaign exercises all missions.

## Package and release

`dist/castoff-colossus-web.zip`: 447,155 bytes, seven entries. Every extracted entry's SHA-256 matches its source, including the 636,244-byte JavaScript bundle. PNG source art and development dependencies are excluded from the web ZIP. The authored-file whitespace check passes; bundled upstream Three.js shader whitespace is excluded from that check.

All sibling repositories `C:/Projects/1` through `15` remained clean. Play at https://kkp8121-rgb.github.io/castoff-colossus/. Publication evidence for each revision is generated separately in ignored `artifacts/improvement-publication.json` after checking the deployed commit and asset hashes.

For deployment verification, use Pages from main/root, wait for a successful build, and rerun browser loading/audio checks with `CASTOFF_URL` set to the actual Pages URL.

## Relay guidance regression — 2026-09-13

The contextual relay message now computes the vertical requirement only while grounded, using the engine's 1/120-second semi-implicit gravity step and the actual punch window. A grounded probe reported the current armor and required armor threshold; an airborne probe switched to the short J relay instruction, with no live-state mutation. Measured isolated `step()` apexes were 1.769 m at five attached plates and 2.037 m at four attached plates. Evidence: `artifacts/qa-castoff-probe.json` and `artifacts/qa-after-grounded-air-tip.png`.

`artifacts/visual-390-844-play.png` is a historical baseline, not a fresh before capture. The interaction suite still passed all 11 scenarios after rebuilding the bundle.

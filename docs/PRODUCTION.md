# Design and production notes

Candidate directions included an ecological garden simulation, a physical sports game and an armor-shedding mech platformer. CASTOFF COLOSSUS was selected for direct keyboard movement, a side camera and a mechanic that links combat, protection and traversal. It differs from the preceding courtroom adventure, naval construction game, first-person stealth heist, deckbuilder, racer and rhythm game.

The theme is the weight of protection. Six detachable plates are simultaneously ammunition, shields and movement weight. Firing exposes the core but raises the jump; grounded recall restores safety while committing the player during its charge. Raised relay objectives make shedding necessary, and the three bosses reward reading low waves, high beams and recovery windows. All missions contribute to restoring an evacuation network.

Core gameplay is deterministic plain JavaScript. Three.js renders hand-authored articulated models, six plate meshes following their real limb parents, grounded structures and an instanced industrial backdrop. Web Audio supplies the motor, impacts, recall motif and music. The release is a single classic-script bundle with relative local assets, so both file loading and a GitHub Pages project subpath work.

Play verification exposed and corrected: an unreached checkpoint being used after a fall; overly generous relay punch height bypassing the weight mechanic; beam and bolt collision not matching the visible body; stale enemy tells; a wrong crown pattern; an unbound R retry; invalid record grading; competing keyboard/touch releases; and short landscape menu clipping. Screenshots also exposed missing platform geometry and invalid enemy transforms, then insufficient environmental depth. These were fixed before release.

Final scope is three compact missions with distinct bosses, standard/gentle modes, touch/keyboard input, records and an ending. It is a small completed action game, not an open-world RPG. The title painting is original raster artwork; the playable mech and environment are actual meshes. No runtime CDN or external account is required to play.

The release ZIP and quantitative evidence are documented in `QA.md`. Public GitHub/Pages publication remains pending per-push approval; an expected URL must not be presented as live.

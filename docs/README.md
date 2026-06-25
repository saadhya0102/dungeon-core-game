# Dungeon Core — Design & Product Documentation Suite

This `/docs` directory is the **single source of truth** for the Dungeon Core game. It is written to be detailed enough that an engineer (human or AI build-subagent) can pick up any one file and implement that system correctly, in isolation, while staying consistent with the rest of the game.

Read `00-vision-and-pillars.md` first, then `04-stats-and-affinities.md` and `02-core-and-economy.md` — those three establish the canonical vocabulary and numbers that every other document depends on.

---

## How to read this suite

- **Canonical numbers** live in `02-core-and-economy.md`, `04-stats-and-affinities.md`, `11-balancing-and-formulas.md`, and the consolidated tables in `19-content-appendix.md`. If a number appears in two places and they disagree, the appendix + balancing doc win, and the discrepancy is a bug to fix.
- **All tunable constants** are centralized conceptually in `11-balancing-and-formulas.md` and map 1:1 to a `config/` module in code (see `17-architecture.md`). Designers should be able to retune the game without touching logic.
- **Diagrams** are written in Mermaid and render in the IDE / GitHub.
- **Requirement IDs**: normative requirements are tagged like `[R-COMBAT-012]` so build tasks and tests can reference them.

---

## Document index

| # | File | What it defines |
|---|------|-----------------|
| — | `README.md` | This index, glossary, conventions |
| 00 | `00-vision-and-pillars.md` | Vision, pillars, target feel, platform, tech stack, top-level loop |
| 01 | `01-game-loop-and-sessions.md` | Macro/micro loops, run lifecycle, session flow, win/loss |
| 02 | `02-core-and-economy.md` | Core levels, Dungeon Points, capacity, size caps, scaling tables |
| 03 | `03-map-and-expansion.md` | Grid model, digging/expansion, entrance gate, path rules |
| 04 | `04-stats-and-affinities.md` | All stats, affinity system, the tier/power-score heuristic |
| 05 | `05-units-roster.md` | Full monster roster, families, per-unit stat tables |
| 06 | `06-research-tree.md` | Unit research tree: nodes, unlocks, costs, diagram |
| 07 | `07-equipment-and-drops.md` | Weapons/armor catalog, affinities, drops, equip rules |
| 08 | `08-traps-and-turrets.md` | Trap types, hidden rating, turrets, placement |
| 09 | `09-enemies-and-classes.md` | Adventurer archetypes, class trees, uniques, group comps |
| 10 | `10-combat-and-ai.md` | Deterministic combat sim, damage math, pathfinding, AI |
| 11 | `11-balancing-and-formulas.md` | Master balance reference and all config constants |
| 12 | `12-h2h.md` | Asynchronous head-to-head mode |
| 13 | `13-accounts-saves-achievements.md` | Auth, save schema, achievements |
| 14 | `14-ui-ux.md` | Screens, HUD, tooltips, drag-drop, equip flow |
| 15 | `15-tutorial-onboarding.md` | Scripted tutorial and first-session funnel |
| 16 | `16-data-model-and-api.md` | Firestore schema, security mapping, Functions API |
| 17 | `17-architecture.md` | Frontend/engine architecture, Pixi↔React, sim model |
| 18 | `18-art-and-assets.md` | Sprite/asset list, placeholder & sourcing strategy |
| 19 | `19-content-appendix.md` | Consolidated master content tables |
| 20 | `20-build-roadmap.md` | Milestones + subagent task breakdown |

---

## Glossary (canonical terms)

| Term | Meaning |
|------|---------|
| **Core** | The Dungeon Core — the player's avatar/objective. If its HP hits 0, the run ends. |
| **Run** | A single playthrough of a dungeon from creation until the core dies (or the player retires it). |
| **Wave** | One assault by a group of adventurers against the dungeon. The main combat unit of play. |
| **Round** | Synonym for the build→wave→reward cycle within a run; also the unit of H2H length. |
| **DP (Dungeon Points)** | The single soft currency. Earned by defeating invaders; spent on everything. |
| **Core Level (CL)** | The upgrade level of the core. Gates capacity, size, research, and features. |
| **Capacity** | Total unit "space" the dungeon can field at once. Units cost space by tier. |
| **Size Cap** | Maximum number of dug (opened) tiles allowed, set by Core Level. |
| **Tier** | Power band T1–T10 (Bronze…Mythic). Applies to units, adventurers, and gear. |
| **Power Score** | The pluggable heuristic that maps a unit's stats to a single number; defines its tier. |
| **Family** | A unit subset that shares research synergies (Goblinoid, Undead, Beast, Demon, Construct, Aberration). |
| **Affinity** | A per-damage-type multiplier (0–200%) that gates how effective a unit is with that attack/weapon type. |
| **Invader / Adventurer** | An attacking unit controlled by the game (or by the H2H AI). |
| **Archetype** | Top-level adventurer role: Warrior, Archer, Mage, Rogue (plus extended classes). |
| **Group** | The composition of a wave: Solo, Party, Horde, Crusade. |
| **Unique** | A named, buffed adventurer (party leader / boss) with the `unique` tag. |
| **Turret** | An immobile, tanky ranged unit that occupies unit space and can reposition/flee slowly. |
| **Entrance Portal / Gate** | The single tile where adventurers spawn and enter. Movable; no traps allowed adjacent. |
| **Stone / Unexplored** | Undug tiles, rendered as rock; impassable until opened with the pickaxe. |
| **H2H** | Asynchronous head-to-head: your dungeon vs. a snapshot of an opponent's dungeon, run by AI. |
| **Sim** | The deterministic, seeded simulation that resolves a wave or H2H match server-side. |

---

## Conventions

- **Units of measure**: distances in **tiles**; time in **ticks** (sim) and **seconds** (presentation). Default `1 tick = 100 ms`, `10 ticks = 1 s` (see `10-combat-and-ai.md`).
- **Currency**: DP is an integer. No fractional DP.
- **Tier indexing**: tiers are referenced as `T1`…`T10` in data and by name (Bronze…Mythic) in UI. The mapping is fixed (see `04`).
- **IDs**: all content uses stable string ids (`goblin_grunt`, `trap_spike_pit`, `res_goblinoid_ferocity`). Never reuse or renumber ids.
- **Determinism**: anything that affects a sim outcome MUST be a pure function of `(initial state, seed)`. No wall-clock, no `Math.random` outside the seeded RNG.

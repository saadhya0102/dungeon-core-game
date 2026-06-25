# 05 — Units Roster (Monsters)

The player's army. Units are organized into six **families** that share research synergies (`06`). Each unit has: stable `id`, family, declared tier, role, space cost (by tier, `02` §3.1), primary stats, affinities (band shorthand, `04` §3.2), and optional abilities (`04` §6).

> Stat columns: `hp / def / phys / mag / rng` (primary five). Secondary stats not shown default per `04` §1.2 unless noted in **Notes**. All `phys/mag/rng` are the *intrinsic* attack stats; effective output applies affinity (`04` §3.3). Every unit's stats are authored so `tierOf(stats)` equals its declared tier (`04` §4).

> This document is the **design-authoritative roster**. The consolidated machine-friendly table is duplicated in `19-content-appendix.md`. If they diverge, that's a content bug.

---

## 0. Families overview

| Family | Theme | Identity | Signature stats | Research synergy theme |
|--------|-------|----------|-----------------|------------------------|
| **Goblinoid** | Goblins, orcs, ogres, trolls | Cheap, numerous, scaling brutes; "swarm → bruiser" | `phys`, `atkSpeed`, numbers | Ferocity (atk/atkSpeed), Pack tactics (bonus when adjacent allies) |
| **Undead** | Skeletons, ghouls, liches, wraiths | Expendable front + powerful casters; revive themes | split: `phys` fodder + `mag`/`arcane` casters | Necromancy (revive/summon), Soul magic (arcane/shadow) |
| **Beast** | Wolves, spiders, wyverns, basilisks | Fast, high `moveSpeed`/`crit`, flankers; rogue-counter-ish | `moveSpeed`, `crit`, `acc` | Predation (speed/crit), Venom (DoT) |
| **Demon** | Imps, hellhounds, succubi, balor | Elite, expensive, magic/fire, high power-per-space | `mag`,`fire`, burst | Infernal (fire/arcane), Dominion (auras/fear) |
| **Construct** | Animated armor, golems, sentinels | Tanky, slow, high `def`/`hp`/`block`; anchors & turrets base | `hp`,`def`,`block` | Fortification (def/hp), Siege (armorPen, anti-armor) |
| **Aberration** | Oozes, beholders, mind-flayers, eldritch | Weird utility: debuffs, stealth-reveal, splash, anti-rogue detection | `mag`, `detection`, control | Aberrant (debuffs/control), Eyes (detection/anti-stealth) |

Design intent: a player typically specializes 1–2 families (research is family-themed) but mixes for counters. Each family fields units across the tier range so a family can "carry" a run.

---

## 1. Goblinoid family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `gob_grunt` | Goblin Grunt | T1 | melee swarm | 110 | 7 | 24 | 0 | 4 | melee B, ranged D, arcane F | Cheapest body. `atkSpeed 1.1`. |
| `gob_archer` | Goblin Slinger | T1 | ranged | 90 | 5 | 6 | 0 | 22 | ranged B, melee D | `range 4`, `atkSpeed 1.2` (mini-spammer). |
| `gob_cutter` | Goblin Cutthroat | T2 | melee dps | 170 | 10 | 42 | 0 | 6 | melee A, ranged D | `crit .12`. Pack-tactics scaler. |
| `orc_warrior` | Orc Warrior | T3 | bruiser | 360 | 24 | 66 | 0 | 4 | melee A | `block .08`. Backbone bruiser. |
| `orc_shaman` | Orc Shaman | T3 | hybrid caster | 280 | 16 | 20 | 52 | 8 | arcane B, nature B, melee D | `auraBuff`: +phys to nearby goblinoids (radius 3). |
| `gob_ogre` | Ogre | T4 | bruiser/AoE | 620 | 36 | 110 | 0 | 0 | melee A | `cleave`. Slow `moveSpeed .8`. |
| `orc_warlord` | Orc Warlord | T5 | bruiser/aura | 920 | 56 | 175 | 0 | 0 | melee S | `auraBuff` +atkSpeed to goblinoids; high `threat`. |
| `gob_troll` | War Troll | T6 | bruiser/regen | 1600 | 78 | 285 | 0 | 0 | melee A, nature B | `regen` high (between hits); `executeLowHp`. |
| `gob_battlemother` | Goblin Battle-Matron | T7 | summoner/aura | 2100 | 120 | 420 | 0 | 0 | melee S | `summon` 2× `gob_grunt` on wave start; family aura. |
| `gob_warbringer` | Ogre Warbringer | T8 | elite bruiser | 3700 | 205 | 800 | 0 | 0 | melee S | `cleave`+`splash`. Anchor. |
| `gob_titan` | Mountain Troll-Titan | T9 | colossus | 6100 | 330 | 1320 | 0 | 0 | melee S, nature A | `executeLowHp`, huge `threat`, knockback onHit. |
| `gob_godslayer` | Gruumsh's Chosen | T10 | capstone | 9900 | 540 | 2280 | 0 | 60 | melee S | Unique-feel capstone; `firstStrike`, AoE cleave, family-wide aura. |

---

## 2. Undead family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `und_skeleton` | Skeleton | T1 | melee fodder | 100 | 9 | 20 | 0 | 2 | melee B, shadow C, arcane E | Cheap; `revive` synergy target. |
| `und_skel_archer` | Skeleton Archer | T2 | ranged | 140 | 8 | 6 | 0 | 40 | ranged A, melee E | `range 5`. |
| `und_ghoul` | Ghoul | T3 | melee dps | 330 | 18 | 64 | 0 | 0 | melee A, shadow B | `lifesteal .15`, `poisonDot` onHit. |
| `und_necromancer` | Necromancer | T4 | summoner/caster | 460 | 24 | 12 | 96 | 0 | arcane A, shadow A, melee F | `summon` skeletons; `range 6`. |
| `und_wight` | Wight | T5 | caster/debuff | 780 | 44 | 30 | 160 | 0 | arcane A, shadow A | `slowOnHit`; reduces target def aura. |
| `und_wraith` | Wraith | T5 | evasive caster | 700 | 30 | 20 | 150 | 0 | shadow S, arcane A, melee F | high `dodge .25`; phases (takes reduced phys). |
| `und_bonegolem` | Bone Colossus | T6 | tank | 1900 | 110 | 240 | 0 | 0 | melee B, arcane D | very high `hp/def`; `block .15`. |
| `und_lich` | Lich | T7 | elite caster | 1700 | 90 | 18 | 560 | 30 | arcane S, shadow A, ranged E, melee F | AoE `splash` magic; `range 7`; phylactery: one self-revive/wave. |
| `und_deathknight` | Death Knight | T8 | bruiser/caster | 3500 | 210 | 620 | 240 | 0 | melee S, shadow A | `lifesteal .2`, fear aura, hybrid. |
| `und_archlich` | Archlich | T9 | elite caster | 5600 | 300 | 30 | 1320 | 0 | arcane S, shadow S | mass `splash`; `summon` wights; ward shield. |
| `und_deathlord` | The Deathlord | T10 | capstone | 9600 | 510 | 400 | 2150 | 0 | arcane S, shadow S, melee D | Battlefield-wide debuff aura; mass revive of fallen undead; capstone. |

---

## 3. Beast family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `bst_direwolf` | Dire Wolf | T1 | fast melee | 105 | 6 | 23 | 0 | 0 | melee B, nature B | `moveSpeed 1.6`, `crit .12`. Flanker. |
| `bst_giantspider` | Giant Spider | T2 | dps/venom | 150 | 9 | 34 | 0 | 6 | melee A, nature B | `poisonDot`; web `slowOnHit`. |
| `bst_harpy` | Harpy | T3 | ranged skirmisher | 250 | 12 | 14 | 0 | 58 | ranged A, nature B | `moveSpeed 1.5`, `range 4`, high `acc` — mini rogue-counter. |
| `bst_basilisk` | Basilisk | T4 | dps/debuff | 540 | 30 | 96 | 24 | 0 | melee A, nature A | petrify: chance `slowOnHit` to near-stun. |
| `bst_manticore` | Manticore | T5 | bruiser/ranged | 880 | 48 | 150 | 0 | 90 | melee A, ranged A, nature A | tail-spikes ranged + melee; `moveSpeed 1.3`. |
| `bst_wyvern` | Wyvern | T6 | flying dps | 1300 | 60 | 250 | 40 | 60 | melee A, nature A, fire B | high `moveSpeed 1.5`, `crit .2`; dive `firstStrike`. |
| `bst_chimera` | Chimera | T7 | hybrid bruiser | 2300 | 130 | 430 | 120 | 0 | melee S, fire A, nature A | `cleave`, fire-breath `splash`. |
| `bst_behemoth` | Behemoth | T8 | colossus | 4000 | 230 | 820 | 0 | 0 | melee S, nature A | trample `splash`, knockback; huge `threat`. |
| `bst_rocdragon` | Roc | T9 | flying colossus | 6000 | 310 | 1250 | 0 | 180 | melee S, ranged A, nature A | very high `moveSpeed`; aerial; `crit .25`. |
| `bst_worldserpent` | World Serpent | T10 | capstone | 9700 | 520 | 2180 | 200 | 0 | melee S, nature S, frost A | swallow (`executeLowHp` strong), arena-wide quake `splash`. |

---

## 4. Demon family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `dem_imp` | Imp | T1 | ranged caster | 80 | 4 | 4 | 24 | 8 | arcane B, fire B, melee E | `range 4`; cheap caster body. |
| `dem_hellhound` | Hellhound | T2 | fast melee | 160 | 10 | 38 | 10 | 0 | melee A, fire B | `moveSpeed 1.5`; burn `poisonDot`(fire). |
| `dem_cambion` | Cambion | T3 | hybrid | 290 | 16 | 40 | 50 | 10 | melee B, arcane A, fire B | flexible; `range 3`. |
| `dem_succubus` | Succubus | T4 | control/caster | 470 | 22 | 20 | 110 | 0 | arcane A, shadow A | `fear` aura (lowers enemy threat/causes hesitation); `lifesteal .2`. |
| `dem_barbed` | Barbed Devil | T5 | bruiser | 920 | 60 | 185 | 30 | 40 | melee A, fire A | retaliate `onTakeDamage` (thorns). |
| `dem_infernal` | Infernal | T6 | AoE bruiser | 1500 | 85 | 290 | 120 | 0 | melee A, fire S | fire `splash` onHit; immolation aura. |
| `dem_pitfiend` | Pit Fiend | T7 | elite hybrid | 2400 | 140 | 430 | 280 | 0 | melee S, fire S, arcane A | `summon` lesser demons; fear aura. |
| `dem_balor` | Balor | T8 | elite bruiser/caster | 3800 | 215 | 780 | 360 | 0 | melee S, fire S | whip pull + flame `splash`; `firstStrike`. |
| `dem_archdevil` | Arch-Devil | T9 | elite caster | 5700 | 300 | 300 | 1400 | 0 | arcane S, fire S, shadow A | meteor `splash` (big AoE); dominion aura buffs demons. |
| `dem_demonprince` | Demon Prince | T10 | capstone | 9500 | 500 | 900 | 2050 | 0 | melee S, fire S, arcane S | capstone; battlefield immolation; mass `summon`; fear. |

---

## 5. Construct family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `con_animarmor` | Animated Armor | T1 | tank | 150 | 14 | 16 | 0 | 0 | melee C | high `def`/`block .12`, slow `moveSpeed .8`. Wall. |
| `con_sentry` | Clockwork Sentry | T2 | ranged | 170 | 12 | 6 | 0 | 34 | ranged B | stationary-ish; turret-base chassis. |
| `con_ironguard` | Iron Guardian | T3 | tank | 420 | 34 | 44 | 0 | 0 | melee C | `block .18`, very high `threat`. Anchor. |
| `con_ballista` | Siege Ballista | T4 | ranged | 380 | 24 | 6 | 0 | 150 | ranged A | `range 7`, slow `atkSpeed .7`, `armorPen` high. Turret-grade. |
| `con_stonegolem` | Stone Golem | T5 | tank | 1200 | 80 | 140 | 0 | 0 | melee C, nature C | `block .2`; immune to crit. |
| `con_arcaneturret` | Arcane Turret | T6 | ranged caster | 900 | 50 | 0 | 230 | 0 | arcane A | `range 8`, `splash`. Immobile turret. |
| `con_irongolem` | Iron Golem | T6 | tank | 1700 | 130 | 230 | 0 | 0 | melee B | huge `def`; `magPen` weakness offset by high `mres`. |
| `con_colossus` | War Colossus | T7 | tank/dps | 2600 | 165 | 420 | 0 | 0 | melee A | `block .2`, `cleave`; anchor + threat. |
| `con_sentinel` | Adamant Sentinel | T8 | elite tank | 4200 | 280 | 600 | 0 | 80 | melee A, ranged B | reflect `onTakeDamage`; very high `mres`. |
| `con_titanforge` | Titanforge Golem | T9 | elite tank/dps | 6300 | 380 | 1150 | 0 | 0 | melee A | quake `splash`; near-unkillable anchor. |
| `con_worldengine` | World Engine | T10 | capstone | 10200| 620 | 1900 | 300 | 200 | melee S, arcane A, ranged A | capstone fortress; ally def aura; multi-mode attacks. |

---

## 6. Aberration family

| id | Unit | Tier | Role | hp | def | phys | mag | rng | Affinities | Abilities / Notes |
|----|------|-----:|------|---:|----:|-----:|----:|----:|-----------|-------------------|
| `abr_ooze` | Gray Ooze | T1 | tanky debuff | 140 | 6 | 16 | 8 | 0 | melee C, nature C | corrosive `onHit` (reduce target def); splits? (v1: no). |
| `abr_gazer` | Lesser Gazer | T2 | detector/caster | 120 | 8 | 4 | 30 | 6 | arcane B | high `detection` (anti-rogue/stealth, reveals traps for *enemies*? no—reveals enemies for your units, see Notes). `range 5`. |
| `abr_mindling` | Mind-Eater Spawn | T3 | control | 260 | 14 | 24 | 56 | 0 | arcane A, shadow B | `slowOnHit`, threat-scramble (confuse targeting). |
| `abr_chokethorn` | Chokethorn | T4 | control/AoE | 560 | 30 | 60 | 70 | 0 | nature A, arcane B | root `slowOnHit` AoE; high `threat`. |
| `abr_beholder` | Beholder | T5 | caster/utility | 760 | 40 | 0 | 200 | 60 | arcane S | multi-beam (`splash`); very high `detection` (anti-stealth aura). |
| `abr_hivemind` | Hive Mind | T6 | summoner/control | 1300 | 70 | 20 | 250 | 0 | arcane A, shadow A | `summon` spawn; debuff aura (−acc to enemies). |
| `abr_mindflayer` | Mind Flayer | T7 | elite control | 2200 | 120 | 60 | 470 | 0 | arcane S, shadow A | stun-ish `slowOnHit`, drains; `fear`. |
| `abr_nightgaunt` | Star-Spawn | T8 | elite caster | 3600 | 200 | 120 | 760 | 0 | arcane S, shadow S | reality-warp `splash`; lowers enemy mres aura. |
| `abr_elderbrain` | Elder Brain | T9 | elite control | 5500 | 290 | 40 | 1350 | 0 | arcane S, shadow S | mass confuse + slow; massive `detection`. |
| `abr_outergod` | Spawn of the Outer Dark | T10 | capstone | 9400 | 490 | 600 | 2100 | 0 | arcane S, shadow S, frost A | capstone; battlefield debuff + AoE; anti-everything utility. |

---

## 7. Authoring rules & validation

`[R-UNIT-001]` Every unit declares `id, family, tier, role, baseStats (StatBlock), affinities, abilities[]`. Space cost is derived from tier (`02` §3.1) — not stored per unit.
`[R-UNIT-002]` Content validation must assert `tierOf(baseStats) === declaredTier` for all units (`04` §4). When secondary stats (dodge/crit/atkSpeed) push the score, authors adjust primaries to land in-band.
`[R-UNIT-003]` `dpCost` and shop availability are computed from power score + role multiplier (`02` §4.1); a unit is purchasable when its tier ≤ CL `Max Unit Tier` AND it is unlocked via research (`06`).
`[R-UNIT-004]` "Detection" on aberrations reveals **enemy** rogues/stealth and traps-already-known to *your* units' targeting (improves your hit chance vs rogues — the in-house rogue counter alongside spammers). It does NOT reveal *your* traps to enemies.
`[R-UNIT-005]` Abilities reference only the v1 ability library (`04` §6) or are added there first.

## 8. Coverage summary

- 6 families × ~11 units = ~66 units spanning T1–T10.
- Every family has: a T1 cheap body, mid-tier role pieces, a tank or bruiser, a caster or ranged option, and a T10 capstone.
- Counter-web coverage: tanks (Construct), anti-rogue (Beast harpy, Aberration detection, spammer-style Goblin slinger), AoE vs hordes (Demon/Undead casters, cleavers), burst vs tanks (armorPen Construct ballista, magPen casters).

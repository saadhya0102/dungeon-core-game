# 19 — Content Appendix (Master Tables)

Consolidated quick-reference tables for build subagents. The design-authoritative versions live in their respective docs; this is a lookup index + the data that doesn't have a natural home. When implementing, encode this as typed data in `sim/content/`.

> If any table here disagrees with its source doc, treat it as a bug and reconcile (source doc wins for design intent; this doc + `11` win for raw numbers used in code).

---

## 1. Tiers (canonical)

| Tier | Name | Space | Power Budget | Lower Threshold | Color |
|------|------|------:|-------------:|----------------:|-------|
| T1 | Bronze | 1 | 100 | 0 | `#b08d57` |
| T2 | Silver | 2 | 190 | 145 | `#c0c0c8` |
| T3 | Gold | 3 | 361 | 275 | `#e3c34e` |
| T4 | Platinum | 5 | 686 | 523 | `#d9e3ea` |
| T5 | Mithril | 10 | 1303 | 994 | `#7fd6d1` |
| T6 | Adamant | 20 | 2476 | 1889 | `#5fa8d3` |
| T7 | Orichalcum | 30 | 4705 | 3590 | `#b06fd6` |
| T8 | Dragon | 50 | 8939 | 6822 | `#e0533d` |
| T9 | Celestial | 80 | 16984 | 12961 | `#f2e9a0` |
| T10 | Mythic | 200 | 32270 | 24627 | `#ff5db1` |

---

## 2. Core Level table (from `02`)

| CL | Cost | Core HP | Capacity | Size Cap | Max Unit Tier | Research Tier | Feature |
|----|-----:|--------:|---------:|---------:|:-------------:|:-------------:|---------|
| 1 | — | 200 | 5 | 25 | T2 | R1 | Pickaxe, basic units/traps |
| 2 | 120 | 320 | 9 | 49 | T2 | R1 | Turrets |
| 3 | 220 | 480 | 14 | 81 | T3 | R2 | Buy Gear, 2nd equip |
| 4 | 380 | 700 | 22 | 121 | T3 | R2 | Full Scout |
| 5 | 620 | 1000 | 34 | 169 | T4 | R3 | Family synergies |
| 6 | 980 | 1400 | 50 | 225 | T4 | R3 | Field traps |
| 7 | 1500 | 1950 | 72 | 289 | T5 | R4 | 3rd accessory |
| 8 | 2300 | 2700 | 100 | 361 | T6 | R4 | Free entrance move |
| 9 | 3400 | 3700 | 140 | 441 | T6 | R5 | Turret mobility |
| 10 | 5000 | 5000 | 190 | 529 | T7 | R5 | Elite research |
| 11 | 7200 | 6800 | 255 | 625 | T7 | R6 | Core Ward |
| 12 | 10200 | 9200 | 340 | 729 | T8 | R6 | — |
| 13 | 14500 | 12500 | 450 | 841 | T8 | R7 | Dual-family stacking |
| 14 | 20500 | 17000 | 600 | 961 | T9 | R7 | — |
| 15 | 29000 | 23000 | 800 | 1089 | T9 | R8 | Capstone research |
| 16 | 41000 | 31000 | 1050 | 1225 | T10 | R8 | T10 units |
| 17 | 58000 | 42000 | 1380 | 1369 | T10 | R9 | — |
| 18 | 82000 | 57000 | 1800 | 1521 | T10 | R9 | — |
| 19 | 116000 | 77000 | 2350 | 1681 | T10 | R10 | — |
| 20 | 164000 | 104000 | 3050 | 1849 | T10 | R10 | Mythic capstone |

---

## 3. Units master list (from `05`) — id ⇒ family/tier/role

| id | family | tier | role |
|----|--------|-----:|------|
| gob_grunt | goblinoid | 1 | melee swarm |
| gob_archer | goblinoid | 1 | ranged |
| gob_cutter | goblinoid | 2 | melee dps |
| orc_warrior | goblinoid | 3 | bruiser |
| orc_shaman | goblinoid | 3 | hybrid caster |
| gob_ogre | goblinoid | 4 | bruiser/AoE |
| orc_warlord | goblinoid | 5 | bruiser/aura |
| gob_troll | goblinoid | 6 | bruiser/regen |
| gob_battlemother | goblinoid | 7 | summoner/aura |
| gob_warbringer | goblinoid | 8 | elite bruiser |
| gob_titan | goblinoid | 9 | colossus |
| gob_godslayer | goblinoid | 10 | capstone |
| und_skeleton | undead | 1 | melee fodder |
| und_skel_archer | undead | 2 | ranged |
| und_ghoul | undead | 3 | melee dps |
| und_necromancer | undead | 4 | summoner/caster |
| und_wight | undead | 5 | caster/debuff |
| und_wraith | undead | 5 | evasive caster |
| und_bonegolem | undead | 6 | tank |
| und_lich | undead | 7 | elite caster |
| und_deathknight | undead | 8 | bruiser/caster |
| und_archlich | undead | 9 | elite caster |
| und_deathlord | undead | 10 | capstone |
| bst_direwolf | beast | 1 | fast melee |
| bst_giantspider | beast | 2 | dps/venom |
| bst_harpy | beast | 3 | ranged skirmisher |
| bst_basilisk | beast | 4 | dps/debuff |
| bst_manticore | beast | 5 | bruiser/ranged |
| bst_wyvern | beast | 6 | flying dps |
| bst_chimera | beast | 7 | hybrid bruiser |
| bst_behemoth | beast | 8 | colossus |
| bst_rocdragon | beast | 9 | flying colossus |
| bst_worldserpent | beast | 10 | capstone |
| dem_imp | demon | 1 | ranged caster |
| dem_hellhound | demon | 2 | fast melee |
| dem_cambion | demon | 3 | hybrid |
| dem_succubus | demon | 4 | control/caster |
| dem_barbed | demon | 5 | bruiser |
| dem_infernal | demon | 6 | AoE bruiser |
| dem_pitfiend | demon | 7 | elite hybrid |
| dem_balor | demon | 8 | elite bruiser/caster |
| dem_archdevil | demon | 9 | elite caster |
| dem_demonprince | demon | 10 | capstone |
| con_animarmor | construct | 1 | tank |
| con_sentry | construct | 2 | ranged (turret) |
| con_ironguard | construct | 3 | tank |
| con_ballista | construct | 4 | ranged (turret) |
| con_stonegolem | construct | 5 | tank |
| con_arcaneturret | construct | 6 | ranged caster (turret) |
| con_irongolem | construct | 6 | tank |
| con_colossus | construct | 7 | tank/dps |
| con_sentinel | construct | 8 | elite tank (turret) |
| con_titanforge | construct | 9 | elite tank/dps |
| con_worldengine | construct | 10 | capstone (turret) |
| abr_ooze | aberration | 1 | tanky debuff |
| abr_gazer | aberration | 2 | detector/caster |
| abr_mindling | aberration | 3 | control |
| abr_chokethorn | aberration | 4 | control/AoE |
| abr_beholder | aberration | 5 | caster/utility |
| abr_hivemind | aberration | 6 | summoner/control |
| abr_mindflayer | aberration | 7 | elite control |
| abr_nightgaunt | aberration | 8 | elite caster |
| abr_elderbrain | aberration | 9 | elite control |
| abr_outergod | aberration | 10 | capstone |

> Full stat blocks + affinities + abilities: see `05`. Content code must include them and pass the `tierOf(stats)==tier` validation (`04`,`05` §7).

---

## 4. Adventurer classes master list (from `09`)

| id | archetype | tier | branch? |
|----|-----------|-----:|---------|
| adv_w_militia | warrior | 1 | main |
| adv_w_soldier | warrior | 2 | main |
| adv_w_knight | warrior | 3 | main |
| adv_w_berserker | warrior | 4 | branch |
| adv_w_templar | warrior | 5 | main |
| adv_w_guardian | warrior | 6 | branch (tank) |
| adv_w_warlord | warrior | 7 | main |
| adv_w_paladin | warrior | 9 | main |
| adv_a_slinger | archer | 1 | main |
| adv_a_bowman | archer | 2 | main |
| adv_a_ranger | archer | 3 | main |
| adv_a_beastmaster | archer | 4 | branch (pet) |
| adv_a_marksman | archer | 5 | main |
| adv_a_arbalest | archer | 6 | branch (armorPen) |
| adv_a_sharpshooter | archer | 7 | main |
| adv_a_storm | archer | 9 | main |
| adv_m_apprentice | mage | 1 | main |
| adv_m_adept | mage | 2 | main |
| adv_m_mage | mage | 3 | main |
| adv_m_cleric | mage | 4 | branch (support) |
| adv_m_sorcerer | mage | 5 | main |
| adv_m_elementalist | mage | 6 | branch (AoE) |
| adv_m_archmage | mage | 7 | main |
| adv_m_magus | mage | 9 | main |
| adv_r_cutpurse | rogue | 1 | main |
| adv_r_thief | rogue | 2 | main |
| adv_r_rogue | rogue | 3 | main |
| adv_r_scout | rogue | 4 | branch (detection) |
| adv_r_assassin | rogue | 5 | main |
| adv_r_trickster | rogue | 6 | branch (debuff) |
| adv_r_shadowblade | rogue | 7 | main |
| adv_r_nightlord | rogue | 9 | main |

`[R-APX-001]` Content pipeline tweens T8/T10 mainline entries from neighbors so every tier T1–T10 has all four archetypes available (`09` R-ENE-010).

---

## 5. Named uniques (starter pool, from `09`)

| name | base class | flavor |
|------|-----------|--------|
| Sir Aldric the Bold | adv_w_knight/paladin | party phys aura |
| The Iron Warden | adv_w_guardian | taunt tank |
| Lyra Quickbow | adv_a_marksman/sharpshooter | volley |
| Magister Veylin | adv_m_archmage | nukes |
| Brother Cassian | adv_m_cleric | priority heal target |
| Vex the Unseen | adv_r_shadowblade | mass trap reveal, backline killer |
| Grimjaw | adv_w_berserker | execute |
| Sister Morwenna | adv_m_sorcerer | AoE |
| Captain Roderic | adv_w_warlord | army buff aura |
| Nightingale | adv_r_assassin | first-strike on core |

> Mechanics = base class × `UNIQUE_STAT_MULT` + aura/ability (`09` §4). Add more freely; names are flavor.

---

## 6. Traps master list (from `08`)

| id | tier | category | trigger | hidden | charges | consumable |
|----|-----:|----------|---------|-------:|---------|-----------|
| trap_spike_pit | 1 | damage | step | 35 | 3 | no |
| trap_dart | 1 | damage | proximity1 | 45 | 4 | no |
| trap_snare | 1 | control | step | 40 | 3 | no |
| trap_caltrops | 2 | debuff | step | 50 | inf | no |
| trap_firejet | 2 | damage | proximity1 | 48 | 3 | no |
| trap_net | 2 | control | step | 55 | 2 | no (anti-rogue) |
| trap_poisongas | 3 | debuff | proximity2 | 55 | 2 | no |
| trap_boulder | 3 | damage | tripwire | 50 | 1 | yes |
| trap_glyph_silence | 3 | special | proximity1 | 65 | 3 | no (anti-mage) |
| trap_revealward | 3 | special | proximity2 | 70 | inf | no (anti-rogue) |
| trap_frost | 4 | control | proximity2 | 58 | 3 | no |
| trap_arcane_mine | 4 | damage | step | 62 | 3 | no |
| trap_pitfall | 5 | special | step | 68 | 1 | yes |
| trap_lightning | 5 | damage | proximity2 | 66 | 2 | no |
| trap_curse | 6 | debuff | proximity2 | 72 | inf | no |
| trap_banish | 7 | special | step | 78 | 2 | no |
| trap_hellfire | 8 | damage | proximity3 | 80 | 2 | no |
| trap_voidrift | 9 | special | proximity2 | 85 | 1 | yes |
| trap_annihilation | 10 | damage | proximity3 | 92 | 1 | yes |

---

## 7. Research nodes master list (from `06`)

> ~90 nodes: 14 general + ~13 per family × 6. See `06` for full per-node effects/costs/prereqs. Build a content test asserting every `unlockUnit` node → real unit id and every `familyUpgrade` → valid family+stat. Node id naming: `res_<branch>_<name>`.

Branches & counts: `general` (≈14), `goblinoid` (≈13), `undead` (≈13), `beast` (≈13), `demon` (≈12), `construct` (≈14), `aberration` (≈12).

---

## 8. Gear catalog skeleton (from `07`)

### 8.1 Weapon types
sword, axe, mace, spear, dagger (melee/phys); bow, crossbow (ranged); staff, wand, orb, tome (arcane/mag). Scaling affinity per `07` §2.1.

### 8.2 Armor types
light, medium, heavy, robe, shield.

### 8.3 Accessory types
ring, amulet, charm, banner.

### 8.4 Quality → affix budget / price mult (from `11`)
| quality | affixes | priceMult |
|---------|--------:|----------:|
| common | 1 | 1.0 |
| uncommon | 2 | 1.6 |
| rare | 3 | 2.5 |
| epic | 4 | 4.0 |
| legendary | 5 | 6.0 |
| mythic | 6 | 9.0 |

### 8.5 Affix pool (starter)
`+%crit`, `+critMult`, `+%atkSpeed`, `+acc`, `+detection`, `+dodge`, `+block`, `+lifesteal`, `+armorPen`, `+magPen`, `+%hp`, `+def`, `+mres`, `+range`, `+moveSpeed`, `+threat (taunt)`, `+<school> affinity`, `slowOnHit`, `poisonOnHit`, `chain (mini-splash)`, `pierce`, `-incoming magic`, `+regen`. Values scale with item tier; counts limited by quality budget.

---

## 9. Abilities library (from `04` §6)
`cleave, splash, slowOnHit, poisonDot, auraBuff, fear, summon, shieldOnWaveStart, executeLowHp, firstStrike` (+ enemy-specific: `healAlly` (cleric), `petSummon` (beastmaster), `blink` (shadowblade), `partyBuff` (warlord/paladin), `confuse` (mindflayer)). Each has an `abilityPowerAdjust` for tiering (`04` R-ABIL-001); default table:

| ability | power adjust (approx, at tier scale) |
|---------|--------------------------------------|
| cleave | +8% of mainAtk budget |
| splash | +12% |
| slowOnHit | +6% |
| poisonDot | +8% |
| auraBuff | +10% |
| fear | +8% |
| summon | +12% |
| shieldOnWaveStart | +8% |
| executeLowHp | +6% |
| firstStrike | +5% |
| healAlly | +14% (priority target value) |

---

## 10. Achievements master list (from `13`)
~50 starter achievements across categories progression/combat/building/economy/collection/h2h/challenge/meta. See `13` §4.2 for the full list with conditions. Each maps to a stat counter; adding one = a new `AchievementDef`.

---

## 11. Config constants
The single `CONFIG` object is in `11` §1. Code imports it from `sim/config.ts`. This appendix does not duplicate the values to avoid drift — `11` is authoritative for constants.

---

## 12. Content validation checklist (CI)
`[R-APX-010]` A `content.test.ts` must assert:
1. Every unit/class: `tierOf(baseStats) === declaredTier`.
2. Every research `unlockUnit` → existing unit id; `familyUpgrade` → valid family + stat key.
3. Every trap tier has a matching research unlock gate.
4. Every gear def references valid type/affix ids.
5. Every ability id used exists in the library.
6. Every content id has an `artId` with real or placeholder art (`18`).
7. Every achievement condition references real counters.
8. Tier thresholds derived from budgets are monotonic.
9. Wave generator never exceeds tier band or returns empty for W≥1.

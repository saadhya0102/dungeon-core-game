# 04 — Stats, Affinities & the Tier / Power-Score System

This is one of the three canonical foundation docs. It defines **every stat**, the **affinity system**, and the **pluggable power-score → tier** heuristic that the spec specifically asked to be easy to change later. Units (`05`), enemies (`09`), gear (`07`), and combat (`10`) all build on these definitions.

---

## 1. Stat model

Every combatant (player monster, turret, or adventurer) has the same stat schema. Stats split into **primary** (the spec's required five) and **secondary / affinity-specific** stats.

### 1.1 Primary stats (the core five)
| Key | Name | Meaning |
|-----|------|---------|
| `hp` | Health | Hit points. At 0 the combatant dies. |
| `def` | Defense | Mitigates incoming **physical & ranged-physical** damage. |
| `phys` | Physical Attack | Damage of melee physical strikes. |
| `mag` | Magic Attack | Damage of magical strikes/spells. |
| `rng` | Ranged Attack | Damage of ranged physical strikes (bows, thrown). |

> A combatant's *offense* uses whichever of `phys`/`mag`/`rng` matches its chosen attack mode (and its equipped weapon's type, modified by affinity — §3).

### 1.2 Secondary / affinity-specific stats
These give archetypes identity and create the counter-web (pillar P3). All have sensible defaults so content doesn't have to specify every field.

| Key | Name | Default | Meaning |
|-----|------|---------|---------|
| `moveSpeed` | Move Speed | 1.0 | Tiles per second of movement (sim converts to per-tick). |
| `atkSpeed` | Attack Speed | 1.0 | Attacks per second multiplier (base interval scaled by this). |
| `range` | Attack Range | 1 (melee) | Attack reach in tiles. Ranged/mage > 1. |
| `acc` | Accuracy | 1.0 | Hit-chance factor; counters target `dodge` and rogue evasion. |
| `dodge` | Dodge / Evasion | 0.0 | Chance to avoid an incoming hit (pre-mitigation). |
| `crit` | Crit Chance | 0.05 | Chance a hit is critical. |
| `critMult` | Crit Multiplier | 1.5 | Damage multiplier on crit. |
| `mres` | Magic Resist | 0.0 | Mitigates incoming **magic** damage (parallel to `def` for phys). |
| `armorPen` | Armor Penetration | 0.0 | Ignores a fraction/flat of target `def`. |
| `magPen` | Magic Penetration | 0.0 | Ignores a fraction/flat of target `mres`. |
| `stealth` | Stealth | 0.0 | (Mostly enemy rogues) hides the unit / lowers others' hit chance vs it. |
| `detection` | Detection / Perception | 0.0 | Reveals traps & stealth within radius; see `08`,`09`. |
| `block` | Block | 0.0 | Chance to block (reduce) a hit; flavor for shields/tanks. |
| `lifesteal` | Lifesteal | 0.0 | Fraction of damage dealt returned as HP. |
| `regen` | HP Regen | 0.0 | HP/sec regenerated (between-attacks; mostly out-of-combat/between waves). |
| `aggroRadius` | Aggro Radius | 4 | Tiles at which a monster notices an adventurer (monster AI, `10`). |
| `threat` | Threat | 1.0 | Targeting weight; how much enemies prioritize attacking this unit. |

`[R-STAT-001]` All combat-affecting stats are defined in **one** `StatBlock` TS type (see `17`). Adding a stat = adding a field + default; no system should hardcode "the stats are exactly these five."

### 1.3 Derived/combat values (not stored, computed in sim)
- `attackInterval = BASE_ATTACK_INTERVAL / atkSpeed` (default base 1.0s).
- `effectiveDef = max(0, def - attacker.armorPen)` (and fractional variant — see `10`).
- Hit chance, crit, mitigation: all defined in `10-combat-and-ai.md`.

---

## 2. Stat ranges & scaling

Stats are anchored to the **power budget per tier** (`02` §3.2: `100 · 1.9^(tier-1)`). A "stock" unit of tier `T` should have stats that sum (via the power-score function, §4) to ≈ that tier's budget. This keeps content authoring consistent: designers distribute a tier's budget across stats to express a role.

Reference primary-stat magnitudes for a *balanced* stock unit per tier (illustrative midpoints; real units skew these by role):

| Tier | ~hp | ~def | ~atk (the unit's main of phys/mag/rng) | Power budget |
|------|----:|-----:|---------------------------------------:|-------------:|
| T1  | 120 | 8   | 22  | 100 |
| T2  | 200 | 14  | 38  | 190 |
| T3  | 320 | 22  | 62  | 361 |
| T4  | 520 | 34  | 100 | 686 |
| T5  | 850 | 52  | 165 | 1303 |
| T6  | 1350| 80  | 270 | 2476 |
| T7  | 2200| 125 | 450 | 4705 |
| T8  | 3600| 200 | 760 | 8939 |
| T9  | 5900| 320 | 1280| 16984 |
| T10 | 9800| 520 | 2200| 32270 |

(Exact per-unit numbers live in `05` and `19`. The above is the skeleton authors fill in.)

---

## 3. Affinities

Affinities express **what kind of fighter a unit is** and **what gear suits it** (spec: liches = high magic affinity, low ranged, abysmal physical).

### 3.1 Model
An affinity is a **multiplier** applied to (a) the unit's own attacks of that type and (b) the contribution of equipped gear of that type. Stored per unit as a map:

```ts
type AffinityType = 'melee' | 'ranged' | 'arcane' | 'holy' | 'shadow' | 'nature' | 'fire' | 'frost';
type Affinities = Partial<Record<AffinityType, number>>; // multiplier, default 1.0
```

- **Core combat affinities** (always present, default 1.0): `melee` (physical melee), `ranged` (physical ranged), `arcane` (generic magic).
- **Elemental/school affinities** (optional flavor, gate elemental gear & resist interactions): `holy`, `shadow`, `nature`, `fire`, `frost`. Used by gear and some abilities; default 1.0 (neutral) if unspecified.

### 3.2 Affinity bands (authoring shorthand)
Authors specify affinities with letter bands that map to multipliers:

| Band | Multiplier | Flavor |
|------|-----------:|--------|
| S | 1.8 | Exceptional |
| A | 1.5 | Strong |
| B | 1.2 | Good |
| C | 1.0 | Neutral |
| D | 0.7 | Weak |
| E | 0.4 | Poor |
| F | 0.15 | Abysmal |

Example — **Lich**: `arcane: S(1.8)`, `shadow: A(1.5)`, `ranged: E(0.4)`, `melee: F(0.15)`.

### 3.3 How affinities affect combat & gear
`[R-AFF-001]` A unit's **effective attack** for a given attack uses the matching affinity:
`outgoing = baseAtk(type) * affinity[type]` where `baseAtk(type)` is the relevant primary stat (`phys`/`rng`/`mag`) plus weapon contribution.
`[R-AFF-002]` **Weapon contribution** scales with the wielder's affinity for that weapon's type: a +50 magic staff gives a Lich `50 * 1.8 = 90` effective, but a Goblin (`arcane F`) only `50 * 0.15 = 7.5`. This is what makes "the right tool for the unit" matter (spec).
`[R-AFF-003]` Affinities **do not** change a unit's **tier rating / power score** (per spec: gear and affinity-as-applied-to-gear don't change tier). The *base* affinity is part of the unit's identity but the power-score function (§4) is computed on the unit's intrinsic stats with a **neutral** affinity assumption (see §4.3) so that "having a great affinity" doesn't inflate tier — it's expressed through stat allocation instead.
`[R-AFF-004]` Some **resist** interactions: incoming elemental damage can be modified by the *target's* affinity to that school acting as a resistance (e.g., a Fire-affinity demon takes reduced fire). v1: target's elemental affinity >1 grants proportional resist to that school; <1 grants vulnerability. Tunable; can be disabled per-school.

### 3.4 Equip eligibility (cross-ref `07`)
`[R-AFF-010]` A unit may equip gear of tier ≤ (unit tier + 1) — "no one can wear something more than 1 tier above them" (spec).
`[R-AFF-011]` There is **no hard affinity lock** on equipping (a goblin *can* hold a staff), but low affinity makes it nearly useless — soft-gating by effectiveness, not hard restriction. (Tunable: a "strict" mode could hard-lock.)

---

## 4. Power Score & Tier (the pluggable heuristic)

The spec: *"tier of a unit is defined by smth, make this easy to change in the future... start with just stat total... figure out some decent heuristic for overall power."*

### 4.1 Contract
```ts
// The ONLY place tier is decided. Swap this implementation to retune tiering.
function powerScore(stats: StatBlock): number;          // -> a single number
function tierOf(stats: StatBlock): Tier;                 // -> T1..T10 via thresholds
```
- `[R-POW-001]` Power score and tier derivation live in **one module** (`sim/power.ts`). No other code computes tier. All systems call `tierOf()` / read a cached `tier`.
- `[R-POW-002]` A unit's tier is computed from its **intrinsic base stats only** (no gear, neutral affinity) so gear can't change tier (spec) and affinity doesn't inflate it.

### 4.2 v1 implementation (weighted stat total)
Start simple (spec) but weight stats so HP and a glass-cannon aren't equated naively:

```
powerScore =
    hp        * 0.5
  + def       * 4.0
  + mainAtk   * 4.0        // mainAtk = max(phys, mag, rng) -- the unit's primary offense
  + offAtk    * 1.5        // offAtk  = secondary offense contributions (the other two, summed)
  + (atkSpeed - 1) * 60
  + (moveSpeed- 1) * 25
  + range     * 8
  + acc       * 20
  + dodge     * 200
  + crit      * 150 + (critMult-1.5)*60
  + mres      * 4.0
  + (armorPen + magPen) * 3.0
  + block     * 120
  + lifesteal * 200
```

- Weights are **config constants** (`POWER_WEIGHTS` in `11`). The formula is intentionally linear and explainable (pillar P1/P4). A future version may use a combat-sim-based "TTK rating," but v1 is this transparent weighted sum.
- `[R-POW-003]` `mainAtk` uses the **max** of the three attack stats so a pure-mage isn't penalized for having 0 ranged.

### 4.3 Tier thresholds
Tier is the band whose power budget the score falls into. Using the canonical budgets (`02` §3.2), thresholds are the **midpoints between consecutive budgets**:

| Tier | Budget | Lower threshold (≥) |
|------|-------:|--------------------:|
| T1  | 100   | 0    |
| T2  | 190   | 145  |
| T3  | 361   | 275  |
| T4  | 686   | 523  |
| T5  | 1303  | 994  |
| T6  | 2476  | 1889 |
| T7  | 4705  | 3590 |
| T8  | 8939  | 6822 |
| T9  | 16984 | 12961|
| T10 | 32270 | 24627|

```
function tierOf(stats):
  s = powerScore(stats)
  for t from 10 down to 1:
    if s >= LOWER_THRESHOLD[t]: return t
  return 1
```

`[R-POW-004]` Authors design a unit to a target tier by allocating stats until `powerScore` lands in that tier's band. The content pipeline (`19`) includes a validation check: every catalog unit's computed tier must equal its declared tier (else it's a content bug).

### 4.4 Why this satisfies the spec
- "Easy to change later": one module, config weights, thresholds derived from one budget formula.
- "Start with stat total": v1 is a (weighted) stat total.
- "Gear/affinity don't change tier": tier computed on intrinsic stats, neutral affinity (`R-POW-002`, `R-AFF-003`).
- "Stronger faster than space": power budget grows 1.9× while space grows per the fixed curve → higher tiers more power-efficient (`02` §3.2).

---

## 5. Affinity-specific stat suites (role identities)

To make archetypes feel distinct, certain stats are *thematically owned* by roles. This guides both monster and adventurer authoring:

| Role flavor | Signature stats |
|-------------|-----------------|
| **Bruiser / Warrior** (melee phys) | high `hp`,`def`,`phys`, `block`; low `dodge`,`range` |
| **Archer / Ranged** | high `rng`,`range`,`acc`,`atkSpeed`; counters rogues via accuracy & volume (spammer) |
| **Mage / Caster** | high `mag`,`range`, `magPen`; low `def`,`hp`; AoE potential |
| **Rogue / Assassin** | high `dodge`,`stealth`,`crit`,`moveSpeed`; (enemy rogues also have `detection` to reveal traps) |
| **Tank / Turret** | very high `hp`,`def`,`block`, `threat`; low `moveSpeed` |
| **Skirmisher / Spammer** | high `atkSpeed`,`moveSpeed`,`acc`, modest `rng`; the rogue-counter |
| **Support (later)** | `regen`, auras (reserved design space) |

`[R-STAT-010]` These are guidelines, not engine rules; the engine only knows the StatBlock. Roles are expressed via stat allocation + affinities + abilities.

---

## 6. Abilities (lightweight, data-driven)

Beyond stats, units/enemies may have **abilities** (passives or simple triggers) to add identity without a full skill engine.

```ts
interface Ability {
  id: string;
  trigger: 'passive' | 'onHit' | 'onKill' | 'onTakeDamage' | 'onWaveStart' | 'periodic';
  effect: EffectSpec;   // e.g., aura buff, cleave, splash, slow, fear, summon, dot
  params: Record<string, number>;
  radius?: number;      // for auras/AoE, in tiles
}
```

- v1 ability library (kept small, data-driven, resolved in sim): `cleave`, `splash` (AoE on hit), `slowOnHit`, `poisonDot`, `auraBuff` (family/nearby stat buff), `fear` (reduce enemy threat/cause flee), `summon` (spawn weak adds), `shieldOnWaveStart`, `executeLowHp`, `firstStrike`.
- `[R-ABIL-001]` Abilities affect combat but their **power-score contribution** is handled via a flat `abilityPowerAdjust` field the author sets (so abilities are accounted for in tiering without auto-evaluation). Default contributions table in `11`.

---

## 7. Summary for implementers

- Implement `StatBlock`, `Affinities`, `Ability` types exactly once (`17`).
- Implement `powerScore`, `tierOf` once (`sim/power.ts`) with config weights/thresholds.
- Everything else (units, enemies, gear, combat) consumes these. Never re-derive tier elsewhere.
- Content validation: `tierOf(unit.baseStats) === unit.declaredTier` for every catalog entry.

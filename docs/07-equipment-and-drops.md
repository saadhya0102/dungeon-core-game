# 07 — Equipment & Drops

Units can equip **weapons, armor, and accessories** looted from defeated adventurers or bought (CL≥3). Gear interacts with **affinities** (`04` §3) and **tiers** (`04` §4) but **does not change a unit's tier rating** (spec).

---

## 1. Core rules (from spec + derived)

`[R-GEAR-001]` A unit has **equipment slots**: `weapon` (1), `armor` (1), `accessory` (1–3 depending on CL: 1 at CL1, +1 at CL3, +1 at CL7). (See `02` CL table features.)
`[R-GEAR-002]` **Tier cap**: a unit may equip gear of tier ≤ `unitTier + 1` (spec: "no one can wear something more than 1 tier above them").
`[R-GEAR-003]` Gear does **not** alter the unit's tier/power-score (`04` §4.2 computes tier on intrinsic stats only).
`[R-GEAR-004]` Gear effectiveness scales with the wielder's **affinity** for the gear's damage/defense type (`04` §3.3). A staff's magic bonus is multiplied by the wielder's `arcane` affinity; a bow's ranged bonus by `ranged`; heavy armor's mitigation is flat (affinity-agnostic) but some armors have typed warding.
`[R-GEAR-005]` Equipping/unequipping is **free** and only allowed during BUILD, via the hover panel (`14`).
`[R-GEAR-006]` One item instance can only be equipped on one unit at a time. Unequipping returns it to inventory.

---

## 2. Equipment model

```ts
type GearSlot = 'weapon' | 'armor' | 'accessory';
type WeaponType = 'sword'|'axe'|'mace'|'spear'|'dagger'|'bow'|'crossbow'|'staff'|'wand'|'orb'|'tome';
type ArmorType  = 'light'|'medium'|'heavy'|'robe'|'shield';

interface GearItem {
  id: string;            // instance id (unique per item in inventory)
  defId: string;         // catalog definition id
  slot: GearSlot;
  tier: number;          // T1..T10
  quality: Quality;      // common..mythic (affix budget)
  // Stat contributions (added to wielder, weapon dmg scaled by affinity):
  mods: Partial<StatBlock>;
  affinityTypeForScaling?: AffinityType;  // which affinity scales this item's main bonus
  affixes: Affix[];      // additional rolled modifiers
}
type Quality = 'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic';
```

### 2.1 Weapons (define the unit's attack mode)
A weapon sets/boosts the unit's effective offense and which attack stat/affinity is used.

| Weapon type | Scales with | Affinity | Flavor stats |
|-------------|-------------|----------|--------------|
| sword | `phys` | melee | balanced, small `crit` |
| axe | `phys` | melee | high dmg, `armorPen`, low `atkSpeed` |
| mace | `phys` | melee | `armorPen`, `block` synergy, anti-armor |
| spear | `phys` | melee | `range 2` melee, modest dmg |
| dagger | `phys` | melee | high `atkSpeed`,`crit`, low base (fits skirmishers/spammers) |
| bow | `rng` | ranged | `range 4-5`, `atkSpeed` |
| crossbow | `rng` | ranged | `range 5-6`, `armorPen`, slow |
| staff | `mag` | arcane | `range 6`, `splash` chance |
| wand | `mag` | arcane | fast `atkSpeed`, single target |
| orb | `mag` | arcane | `magPen`, `mres` |
| tome | `mag` | arcane | aura/utility affixes |

`[R-GEAR-010]` A weapon's main bonus is `mods.<phys|mag|rng>` and is multiplied by the wielder's matching affinity at combat time. Equipping a weapon whose type mismatches a unit's high-affinity is allowed but weak (soft-gate, `04` §3.4).

### 2.2 Armor (mitigation)
| Armor type | Grants | Best for |
|-----------|--------|----------|
| light | small `def`, `dodge`, `moveSpeed` | rogues/skirmishers |
| medium | balanced `def`, small `mres` | generalists |
| heavy | high `def`, `block`, −`moveSpeed` | tanks/bruisers |
| robe | `mres`, `mag`, low `def` | casters |
| shield (accessory-like, but armor slot variant) | `block`, `def`, `threat` | front-liners |

### 2.3 Accessories (utility)
Rings/amulets/charms/banners: `crit`, `lifesteal`, `acc`, `detection`, `regen`, elemental affinity boosts, aura affixes. Accessories are where build-defining affixes live.

### 2.4 Affixes & quality
- `quality` sets an **affix budget**: common 0–1, uncommon 1–2, rare 2–3, epic 3–4, legendary 4–5, mythic 5–6 affixes plus higher base.
- Affix examples: `+X% crit`, `+detection (reveal rogues)`, `+fire affinity`, `lifesteal`, `slowOnHit`, `+threat (taunt)`, `−incoming magic`, `pierce`, `chain` (mini-splash). Full affix pool table in `19`.
- `[R-GEAR-020]` Affix values scale with item `tier`. Affix power contributes to drop value but **never** to unit tier.

---

## 3. Drops (loot from the fallen)

Spec: "You will also collect armor weapons etc from defeating opponents sometimes."

### 3.1 Drop rules
`[R-GEAR-030]` On adventurer death, roll a drop using the **drop table** keyed by the adventurer's archetype, tier, and unique status:
- Drop chance `pDrop = DROP_BASE + tier*DROP_TIER_STEP (+ DROP_UNIQUE_BONUS if unique)`. Defaults `DROP_BASE=0.06`, `DROP_TIER_STEP=0.015`, `DROP_UNIQUE_BONUS=0.5` (uniques almost always drop).
- If a drop occurs, roll **item type** weighted by the adventurer's archetype (warriors → swords/heavy armor; archers → bows/light; mages → staves/robes; rogues → daggers/light/accessories).
- Roll **tier**: centered on the adventurer's tier (±1, clamped), so loot keeps pace with threats.
- Roll **quality**: weighted table, with uniques shifting toward epic+ and a small chance for `legendary`/`mythic` from high-tier uniques.
- Roll **affixes** up to quality budget from the type-appropriate affix pool.

`[R-GEAR-031]` Drops are **deterministic** from the wave seed (so server/client agree and replays match; see `10`,`16`).
`[R-GEAR-032]` Drops go to the run's **inventory** (`13` save schema). No inventory size cap in v1 (tunable).

### 3.2 Drop table schema
```ts
interface DropTable {
  archetype: AdventurerArchetype;
  typeWeights: Record<WeaponType|ArmorType|'accessory', number>;
  qualityWeights: Record<Quality, number>;     // shifted by unique flag
}
```

---

## 4. Buying gear (CL≥3 shop)

Spec: "maybe also add a buy armor thing at like core level 3."

`[R-GEAR-040]` From CL3, a **Gear Shop** offers a **rotating stock** of items (refreshes each wave; manual reroll for DP). Stock tier is capped near the player's CL Max-Tier. Prices scale with tier × quality × affix budget: `gearPrice = GEAR_BASE * tier^1.3 * qualityMult` (`GEAR_BASE=10`, qualityMult 1…6).
`[R-GEAR-041]` Bought gear is identical in kind to drops; the shop is the *reliable* path, drops are the *lucky* path.
`[R-GEAR-042]` Players may **salvage** unwanted gear for partial DP (`SALVAGE_REFUND` default 25% of equivalent buy price), giving inventory cleanup + minor economy.

---

## 5. Affinity worked examples

| Wielder | Item | Naive bonus | Affinity | Effective |
|---------|------|------------:|----------|----------:|
| Lich (`arcane S=1.8`) | T7 Staff (+560 mag... wait, mods.mag e.g. +180) | +180 mag | ×1.8 | **+324 mag** |
| Goblin Grunt (`arcane F=0.15`) | same staff | +180 mag | ×0.15 | **+27 mag** (useless) |
| Orc Warrior (`melee A=1.5`) | T3 Axe (+40 phys, +armorPen) | +40 phys | ×1.5 | **+60 phys** + pen |
| Lich | T3 Axe | +40 phys | melee F ×0.15 | +6 phys (don't) |

This is the central optimization loop: **match gear type to the unit's strong affinity**, respect the tier cap, and use accessories/affixes to patch weaknesses (e.g., a `+detection` ring on a frontline unit to help against rogues).

---

## 6. UI hooks (see `14`)
- Hover a unit → panel shows slots, current gear, stats *with* gear, and **affinity-adjusted** previews (green/red deltas).
- Drag gear from inventory onto a slot; invalid (over-tier) drops are rejected with reason.
- Gear Shop is a panel with stock cards, reroll button, salvage drop-zone.

## 7. Validation
`[R-GEAR-050]` Content test: every `defId` referenced exists in the gear catalog (`19`); affixes reference real affix defs; weapon scaling affinity matches its type table (§2.1).
`[R-GEAR-051]` Equipping logic must enforce tier cap (`R-GEAR-002`) and slot limits (`R-GEAR-001`) both client and server.

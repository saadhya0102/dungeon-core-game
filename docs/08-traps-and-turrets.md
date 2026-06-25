# 08 — Traps & Turrets

Two non-unit defenses. **Traps** are placed on floor tiles, are hidden until triggered/revealed, and fire when adventurers step on/near them. **Turrets** are immobile, tanky ranged units that occupy unit Capacity and can slowly reposition/flee.

---

## PART A — TRAPS

### 1. Trap model

```ts
interface TrapDef {
  id: string;
  name: string;
  tier: number;             // T1..T10; gates unlock (research `06`) & power
  category: TrapCategory;   // see below
  hiddenRating: number;     // 0..100; how hard to detect (vs adventurer detection)
  trigger: TrapTrigger;     // 'step' | 'proximity' | 'tripwire-line'
  radius?: number;          // AoE radius in tiles (proximity/explosive)
  charges: number | 'infinite';  // uses per wave before depleting
  cooldownTicks: number;    // re-arm time after firing
  consumable: boolean;      // one-shot (rebuy) vs reusable
  effect: TrapEffect;       // damage and/or status
  cost: number;             // DP
}
type TrapCategory = 'damage' | 'control' | 'debuff' | 'utility' | 'special';
type TrapTrigger = 'step' | 'proximity' | 'tripwire-line';
```

### 2. The hidden-rating / detection model

Spec: each trap has "a rating that determines how hidden it is"; rogues reveal traps within a radius.

`[R-TRAP-001]` A trap is **hidden** from adventurers until **revealed**. A hidden trap triggers normally when stepped on (adventurers can't avoid what they can't see). A **revealed** trap can be **avoided** by adventurer pathfinding (they path around it if a route exists) and is shown to the player as "revealed."
`[R-TRAP-002]` **Reveal check**: an adventurer with `detection D` within range of a trap with `hiddenRating H` reveals it if `D ≥ H` (with distance falloff). Rogues have high `detection` and a **reveal radius** (`09`): within a rogue's radius, **all** traps become revealed (spec: "all traps become apparent within that radius").
`[R-TRAP-003]` Reveal is **shared** across the adventurer party (shared info, spec) — once any adventurer reveals a trap, the whole group avoids it.
`[R-TRAP-004]` Higher-tier traps have higher `hiddenRating`, so they resist detection longer; this is the trap "arms race" vs rogue detection — countered by the player killing rogues fast (spammers) or using **anti-rogue traps** (below).

### 3. Trigger types
- `step`: fires when an adventurer enters the trap's tile.
- `proximity`: fires when an adventurer enters within `radius` of the trap tile (AoE).
- `tripwire-line`: a line/field trap (CL6 field placement) spanning multiple tiles; fires when crossed.

### 4. Trap catalog (canonical)

> Costs/values are defaults (config in `11`). `hiddenRating` rises with tier. Damage scales to be meaningful vs same-tier adventurers (see `11` for the scaling anchor).

| id | Name | Tier | Category | Trigger | Hidden | Effect | Charges | Notes |
|----|------|-----:|----------|---------|-------:|--------|--------|-------|
| `trap_spike_pit` | Spike Pit | T1 | damage | step | 35 | phys burst to stepper | 3 | Cheap starter. |
| `trap_dart` | Dart Trap | T1 | damage | proximity(1) | 45 | small phys to nearby | 4 | Pokes groups. |
| `trap_snare` | Snare | T1 | control | step | 40 | root (slow→0) 2s | 3 | Sets up unit kills. |
| `trap_caltrops` | Caltrops | T2 | debuff | step | 50 | −moveSpeed & bleed DoT | inf | Field-able later. |
| `trap_firejet` | Flame Jet | T2 | damage | proximity(1) | 48 | fire AoE + burn | 3 | Good vs hordes. |
| `trap_net` | Net Trap | T2 | control | step | 55 | root + −dodge | 2 | **Anti-rogue** (strips dodge). |
| `trap_poisongas` | Poison Cloud | T3 | debuff | proximity(2) | 55 | DoT + −acc cloud | 2 | Lingering AoE. |
| `trap_boulder` | Rolling Boulder | T3 | damage | tripwire-line | 50 | heavy phys line, knockback | 1 (consumable) | Big single use. |
| `trap_glyph_silence` | Silencing Glyph | T3 | special | proximity(1) | 65 | disables enemy mage casting briefly | 3 | **Anti-mage**. |
| `trap_revealward` | Truesight Ward | T3 | special | proximity(2) | 70 | **removes rogue dodge & stealth in radius** | inf | **Anti-rogue** (spec's example trap). |
| `trap_frost` | Frost Trap | T4 | control | proximity(2) | 58 | AoE slow + small frost dmg | 3 | Kites hordes. |
| `trap_arcane_mine` | Arcane Mine | T4 | damage | step | 62 | magic burst, ignores def | 3 | Anti-tank (magPen). |
| `trap_pitfall` | Collapsing Floor | T5 | special | step | 68 | removes stepper (instakill low-tier) / heavy dmg high-tier | 1 (consumable) | High value vs fodder. |
| `trap_lightning` | Chain Lightning Rune | T5 | damage | proximity(2) | 66 | chains magic across nearby | 2 | Anti-horde. |
| `trap_curse` | Curse Sigil | T6 | debuff | proximity(2) | 72 | −all stats aura on enemies in radius | inf | Force-multiplier. |
| `trap_banish` | Banishment Circle | T7 | special | step | 78 | teleports stepper back to entrance | 2 | Tempo reset vs elites. |
| `trap_hellfire` | Hellfire Array | T8 | damage | proximity(3) | 80 | massive fire AoE + burn | 2 | Crusade-buster. |
| `trap_voidrift` | Void Rift | T9 | special | proximity(2) | 85 | pull + heavy magic + −mres | 1 (consumable) | Elite killer. |
| `trap_annihilation` | Annihilation Glyph | T10 | damage | proximity(3) | 92 | enormous true-damage AoE | 1 (consumable) | Capstone trap. |

`[R-TRAP-010]` **Anti-rogue traps** (`trap_net`, `trap_revealward`) specifically strip dodge/stealth — the spec's "trap that... removes rogue dodge ability." These let trap-heavy builds answer rogues without spammers.
`[R-TRAP-011]` Trap unlocks are gated by research (`res_basic_traps`/`res_adv_traps`/`res_elite_traps`, `06`) and tier by CL.

### 5. Placement rules (cross-ref `03`)
- Floor tiles only; 1 trap per tile (field traps span tiles, CL6+).
- Not within entrance safe radius; not in core halo.
- Must not eliminate the trap-free fair lane (`03` §5).
- A tile holds **either** a trap or a unit, not both (v1; `03` §6).

### 6. Trap combat resolution (cross-ref `10`)
`[R-TRAP-020]` On trigger: apply `effect` to valid targets (steppers / in-radius enemies), respect `charges`/`cooldownTicks`, then mark depleted/consumed. Damage uses the same damage pipeline as units (typed dmg vs def/mres), with traps able to deal `true` (unmitigated) damage where specified.
`[R-TRAP-021]` Trap triggers, reveals, and damage are all part of the deterministic sim timeline and are shown in the RESULT "notable events" (e.g., "Spike Pit triggered 6×, 4 kills").

---

## PART B — TURRETS

Spec: "maybe make turrets too that can take up some unit space for just immobile tankier ranged units that can run away."

### 7. Turret model
Turrets are a special class of **unit** (same StatBlock, same Capacity cost via tier) flagged `isTurret`, with movement constraints:

```ts
interface TurretFlags {
  isTurret: true;
  mobility: 'immobile' | 'reposition';   // 'reposition' unlocked via research/CL
  fleeThreshold: number;                  // hp% at which it tries to retreat (if mobility allows)
  repositionSpeed: number;                // very low moveSpeed when repositioning
}
```

`[R-TURR-001]` Turrets are **ranged**, **tanky** (high `hp`/`def`), **low/zero base `moveSpeed`**. They attack from range and have high `threat` (soak) options.
`[R-TURR-002]` By default turrets are **immobile**. With `res_turret_mobility` (R5) + CL9 upgrade, they gain a slow **reposition/flee** behavior: when HP < `fleeThreshold`, they crawl away from the nearest threat toward safety (spec: "can run away").
`[R-TURR-003]` Turrets occupy Capacity per their tier (`02` §3.1). A turret-specific cost multiplier (`TURRET_COST_MULT`, default 0.9) makes them slightly cheaper than mobile units of equal power, trading mobility for value.

### 8. Turret roster
Turrets are sourced from the **Construct** family chassis (and a couple cross-family options). The following units are flagged as turrets when placed in "turret mode":

| Unit (from `05`) | Tier | Turret role |
|------------------|-----:|-------------|
| `con_sentry` | T2 | basic ranged turret |
| `con_ballista` | T4 | heavy single-target, armorPen |
| `con_arcaneturret` | T6 | AoE magic turret (`splash`) |
| `con_sentinel` | T8 | elite turret, reflect, ranged option |
| `con_worldengine` | T10 | capstone multi-mode (counts as super-turret) |

`[R-TURR-010]` Additional families can have a "turret-like" unit later; v1 leans on Construct. Non-construct ranged units are **not** turrets (they move normally).

### 9. Turret AI (cross-ref `10`)
- Acquire nearest in-range target by `threat`-weighted priority; attack on `attackInterval`.
- If `reposition` enabled and HP < `fleeThreshold`, path 1 tile/period away from nearest enemy toward the core-side, resuming fire when safe.
- Immobile turrets simply fire and die in place if overrun — placement matters (put them behind tanks/in alcoves).

### 10. Strategy & UI
- Turrets anchor **kill-corridors**: place tanks/units in front, turrets behind to rain fire.
- UI: placing a Construct ranged unit offers "Turret mode" toggle (immobile, cheaper) vs "mobile" (if applicable). Hover shows range cones (see `14`).

### 11. Validation
`[R-TURR-020]` Turret flags only valid on units marked turret-capable in `05`. Reposition behavior must respect the same pathing/passability as adventurers (`03`,`10`).
`[R-TRAP-030]` Every trap `effect` references the shared effect library (`04` §6 / `10`); content test cross-checks trap tiers vs research unlocks (`06`).

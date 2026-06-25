# 02 — Core, Levels & Economy

This document defines the **single currency (DP)**, the **Core Level** progression that gates everything, **unit Capacity**, **map size caps**, and the buy/sell economy. All numbers here are **canonical defaults** and are mirrored as config constants in `11-balancing-and-formulas.md`.

> Notation: `CL` = Core Level. `W` = current wave number. `DP` = Dungeon Points. Tiers `T1`…`T10`.

---

## 1. Dungeon Points (DP)

DP is the **only** currency. Integer-valued.

### 1.1 Sources
| Source | Amount | Notes |
|--------|--------|-------|
| Kill an adventurer | `dpKill(tier, isUnique)` | Scales with the adventurer's power score; uniques pay a multiplier. |
| Clear a wave | `dpWaveClear(W)` | Bonus for surviving the wave with the core alive. |
| First-time kill of a new class | small one-time bounty | "Bestiary" incentive, optional. |
| Achievements | fixed grants | Some achievements grant DP for the *current* run (see `13`). |

Canonical formulas (defaults; see `11`):
- `dpKill(tier, unique) = round( BASE_KILL * powerScoreOfTier(tier) / 100 * (unique ? UNIQUE_DP_MULT : 1) )`, with `BASE_KILL = 4`, `UNIQUE_DP_MULT = 5`.
- `dpWaveClear(W) = round( WAVE_CLEAR_BASE * (1 + W * WAVE_CLEAR_GROWTH) )`, with `WAVE_CLEAR_BASE = 25`, `WAVE_CLEAR_GROWTH = 0.15`.

### 1.2 Sinks (what DP buys)
- **Core Level upgrades** (§2)
- **Digging tiles** / expansions (`03`)
- **Units** (`05`) and **Turrets** (`08`)
- **Traps** (`08`)
- **Research nodes** (`06`)
- **Gear** purchases, unlocked at CL≥3 (`07`)

`[R-ECON-001]` All purchases are validated server-side against the player's current DP balance and CL gates (see `16`). The client UI disables unaffordable/locked actions but the server is authoritative.

---

## 2. Core Level (CL)

The core is both the **win/loss objective** (its HP) and the **progression spine**. Upgrading CL is the primary long-term DP sink. CL governs:

- **Core HP** (how much punishment before the run ends)
- **Unit Capacity** (total unit space)
- **Size Cap** (max dug tiles)
- **Max placeable unit tier** (you can't field T8 units at CL2)
- **Research tier access** (which research nodes are purchasable)
- **Feature unlocks** (buy-gear, full-scout, extra equip slots, etc.)

### 2.1 Canonical CL table

> These are defaults tuned to the pacing targets in `01` §8. Treat as config. `Upgrade Cost` is the DP to go *from the previous level to this one*. Costs grow ~1.6×/level early, easing later.

| CL | Upgrade Cost (DP) | Core HP | Capacity | Size Cap (tiles) | Max Unit Tier | Research Tier | Feature unlocked |
|----|-------------------|---------|----------|------------------|---------------|---------------|------------------|
| 1  | — (start)         | 200     | 5        | 25 (5×5)         | T2            | R1            | Pickaxe, basic units, basic traps |
| 2  | 120               | 320     | 9        | 49               | T2            | R1            | Turrets unlocked |
| 3  | 220               | 480     | 14       | 81               | T3            | R2            | **Buy Gear** shop; 2nd equip slot region |
| 4  | 380               | 700     | 22       | 121              | T3            | R2            | Full Scout (exact wave readout) |
| 5  | 620               | 1000    | 34       | 169              | T4            | R3            | Family research synergies |
| 6  | 980               | 1400    | 50       | 225              | T4            | R3            | Trap "field" placement (multi-tile) |
| 7  | 1500              | 1950    | 72       | 289              | T5            | R4            | 3rd accessory slot |
| 8  | 2300              | 2700    | 100      | 361              | T6            | R4            | Reposition entrance freely |
| 9  | 3400              | 3700    | 140      | 441              | T6            | R5            | Turret mobility upgrade path |
| 10 | 5000              | 5000    | 190      | 529              | T7            | R5            | "Elite" research unlocks |
| 11 | 7200              | 6800    | 255      | 625              | T7            | R6            | Second core "ward" (extra HP layer) |
| 12 | 10200             | 9200    | 340      | 729              | T8            | R6            | — |
| 13 | 14500             | 12500   | 450      | 841              | T8            | R7            | Dual-family synergy stacking |
| 14 | 20500             | 17000   | 600      | 961              | T9            | R7            | — |
| 15 | 29000             | 23000   | 800      | 1089             | T9            | R8            | Capstone research |
| 16 | 41000             | 31000   | 1050     | 1225             | T10           | R8            | T10 units fieldable |
| 17 | 58000             | 42000   | 1380     | 1369             | T10           | R9            | — |
| 18 | 82000             | 57000   | 1800     | 1521             | T10           | R9            | — |
| 19 | 116000            | 77000   | 2350     | 1681             | T10           | R10           | — |
| 20 | 164000            | 104000  | 3050     | 1849             | T10           | R10           | Mythic capstone; prestige-ready |

Notes:
- **Size Cap** is expressed as a count of opened tiles; the convenient square `(2·CL+3)²` is used as a guide but the **count** is what's enforced — players can shape non-square dungeons up to the cap (see `03`).
- **Max Unit Tier** intentionally lags raw capacity so that fielding the newest tier is an *event*, not automatic.
- **Core HP** is the run's life total. Late waves can deal huge spike damage if they reach the core, so HP scaling is generous but never a substitute for defense.

### 2.2 Core HP, wards, and damage
`[R-ECON-010]` The core only takes damage from adventurers **in melee/range of the core tile**; reaching the core is the fail condition pressure.
`[R-ECON-011]` From CL11, the core gains a **Ward** — a regenerating shield layer (regens between waves, not during) that absorbs a % of core max HP, giving a buffer against single bad waves. Ward amount/regen are config.

---

## 3. Unit Capacity

Every unit and turret occupies **space**. The sum of placed units' space must not exceed **Capacity** (from the CL table).

### 3.1 Space cost by tier (canonical, from spec)
| Tier | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 |
|------|----|----|----|----|----|----|----|----|----|-----|
| **Space** | 1 | 2 | 3 | 5 | 10 | 20 | 30 | 50 | 80 | 200 |

`[R-ECON-020]` Space cost is a pure function of **unit tier**, independent of family or gear. Turrets use the same table but may have a turret-specific multiplier (see `08`).
`[R-ECON-021]` Placing a unit is blocked if it would exceed Capacity. Selling/removing frees the space immediately during BUILD.

### 3.2 Power-per-space intent
Higher tiers are designed to be **more power-efficient per space** (the spec: "in theory they become stronger faster than their space limit goes up"). The canonical power budget per tier (see `04` §Power Score and the table below) rises faster than space, so investing in capacity + higher tiers is rewarded — except the **T10 capstone** which is deliberately space-expensive (prestige units, not spammable).

| Tier | Space | Nominal Power Budget | Power / Space |
|------|------:|---------------------:|--------------:|
| T1  | 1   | 100    | 100 |
| T2  | 2   | 190    | 95  |
| T3  | 3   | 361    | 120 |
| T4  | 5   | 686    | 137 |
| T5  | 10  | 1303   | 130 |
| T6  | 20  | 2476   | 124 |
| T7  | 30  | 4705   | 157 |
| T8  | 50  | 8939   | 179 |
| T9  | 80  | 16984  | 212 |
| T10 | 200 | 32270  | 161 |

(Power budget defaults to `100 · 1.9^(tier-1)`, rounded. This is the **target total** a stock unit of that tier should score on the power-score heuristic; see `04`. It is the anchor for all unit stat tables in `05` and `19`.)

---

## 4. Buy / Sell economy

### 4.1 Unit & turret costs
`[R-ECON-030]` Base DP cost to buy a unit scales with its power score, with a family/role flavor multiplier:
- `unitCost(unit) = round( UNIT_COST_BASE * unit.powerScore / 100 * familyMult * roleMult )`, `UNIT_COST_BASE = 6`.
- Defaults: `familyMult` 0.9–1.2, `roleMult` 0.85 (fragile dps) – 1.25 (elite/utility). Full table in `19`.

### 4.2 Selling / refunds
| Action | Refund |
|--------|--------|
| Sell a unit/turret during BUILD | `SELL_REFUND` of paid cost (default **60%**) |
| Sell a trap | `SELL_REFUND_TRAP` (default **50%**; one-shot consumed traps: 0% once triggered) |
| Un-dig a tile (collapse) | `DIG_REFUND` of dig cost (default **40%**), only if it doesn't break the required path |
| Refund research | **Not refundable** |
| Refund a Core Level | **Not refundable** |

`[R-ECON-031]` Refund percentages are config. Selling is only allowed in BUILD.

### 4.3 Research costs
Research node costs scale by research tier and node weight; see `06`. Research is a permanent (per-run) unlock; not refundable.

### 4.4 Gear costs (CL≥3)
Buying gear from the shop costs DP by gear tier/quality; drops are free. See `07`.

---

## 5. Economy tuning levers (summary → see `11`)

| Constant | Default | Effect |
|----------|---------|--------|
| `BASE_KILL` | 4 | Global DP income from kills |
| `UNIQUE_DP_MULT` | 5 | Reward for killing uniques |
| `WAVE_CLEAR_BASE` / `WAVE_CLEAR_GROWTH` | 25 / 0.15 | Survival income |
| `UNIT_COST_BASE` | 6 | Global unit price level |
| `SELL_REFUND` | 0.6 | How freely players can re-comp |
| CL upgrade cost curve | ~1.6×/level | Pace of permanent progression |
| Power budget base/growth | 100 / 1.9 | Master power scaling across tiers |

`[R-ECON-040]` Income (DP/wave) and outgo (costs) are tuned so a player who plays well sits at a **slight surplus**, enabling steady growth, while a player who over-invests in one axis feels the pinch — preserving the breadth/depth/tempo tension from `01` §2.4.

---

## 6. Worked example (early game)

1. Start: CL1, 200 core HP, Capacity 5, 5×5 open (25 tiles), DP 100 (starting grant).
2. Buy 3× Goblin Grunt (T1, space 1 each, ~6 DP each = 18 DP). Place near a corridor. Capacity used 3/5.
3. Buy 1× Spike Pit trap (~20 DP). DP left ~62.
4. Run W1 (Solo Bronze warrior). Goblins + pit kill it. Earn ~`dpKill(T1)` + `dpWaveClear(1)` ≈ 4 + 29 = ~33 DP.
5. W2–W4: accumulate, buy 2 more goblins + a 2nd trap.
6. ~W4–5: afford **CL2** (120 DP) → Capacity 9, size 49, turrets unlock. Dig outward to build a kill-corridor.

# 11 — Balancing & Formulas (Master Config Reference)

The single place every tunable number and formula is listed. These map 1:1 to a `config/` module in code (`17`). Designers retune here; code reads constants, never hardcodes. Where another doc states a default, this doc is the authority if they ever disagree.

---

## 1. Master constants table

```ts
export const CONFIG = {
  // --- Tiers & power (04) ---
  POWER_BUDGET_BASE: 100,          // T1 budget
  POWER_BUDGET_GROWTH: 1.9,        // budget_T = BASE * GROWTH^(T-1)
  SPACE_COST: [1,2,3,5,10,20,30,50,80,200],   // index 0 = T1
  POWER_WEIGHTS: {
    hp:0.5, def:4.0, mainAtk:4.0, offAtk:1.5,
    atkSpeed:60, moveSpeed:25, range:8, acc:20, dodge:200,
    crit:150, critMult:60, mres:4.0, pen:3.0, block:120, lifesteal:200,
  },
  // tier thresholds derived from budgets (midpoints), see 04 §4.3

  // --- Economy (02) ---
  STARTING_DP: 100,
  BASE_KILL: 4,                    // dpKill scale
  UNIQUE_DP_MULT: 5,
  WAVE_CLEAR_BASE: 25,
  WAVE_CLEAR_GROWTH: 0.15,
  UNIT_COST_BASE: 6,
  TURRET_COST_MULT: 0.9,
  SELL_REFUND: 0.6,
  SELL_REFUND_TRAP: 0.5,
  DIG_REFUND: 0.4,
  SALVAGE_REFUND: 0.25,

  // --- Map / digging (03) ---
  DIG_BASE: 8,
  DIG_GROWTH: 0.5,                 // per already-opened tile
  ENTRANCE_SAFE_RADIUS: 2,
  CORE_NOBUILD_HALO: 1,

  // --- Research (06) ---
  RES_BASE: 40,
  RES_TIER_MULT: 1.7,
  RES_WEIGHT: { unlockUnit:1.0, minorUpgrade:0.8, majorUpgrade:1.5, capstone:3.0 },

  // --- Gear (07) ---
  DROP_BASE: 0.06, DROP_TIER_STEP: 0.015, DROP_UNIQUE_BONUS: 0.5,
  GEAR_BASE: 10,                   // gearPrice = GEAR_BASE * tier^1.3 * qualityMult
  QUALITY_MULT: { common:1, uncommon:1.6, rare:2.5, epic:4, legendary:6, mythic:9 },
  QUALITY_AFFIX_BUDGET: { common:1, uncommon:2, rare:3, epic:4, legendary:5, mythic:6 },
  ACCESSORY_SLOTS_BY_CL: { 1:1, 3:2, 7:3 },   // cumulative thresholds

  // --- Combat (10) ---
  TICK_MS: 100, TICKS_PER_SEC: 10,
  BASE_ATTACK_INTERVAL: 1.0,       // seconds at atkSpeed 1.0
  BASE_HIT: 0.95, HIT_CAP: 0.99, HIT_CAP_ROGUE: 0.9, HIT_FLOOR: 0.2,
  MIT_K: 100,                      // mitigation = K/(K+def)
  BLOCK_REDUCTION: 0.5,
  MIN_DAMAGE: 1,
  LEASH_TILES: 4,
  MAX_TICKS_BASE: 600,             // scaled by wave size
  CRIT_DEFAULT: 0.05, CRITMULT_DEFAULT: 1.5,

  // --- Waves (09) ---
  THREAT_BUDGET_BASE: 60,
  THREAT_BUDGET_GROWTH: 1.18,      // soft-exp; see §3
  THREAT_BUDGET_SOFTCAP_WAVE: 40,  // growth eases after this
  MILESTONE_EVERY: 5,
  UNIQUE_STAT_MULT_RANGE: [1.6, 2.2],

  // --- H2H (12) ---
  H2H_BASELINE_BASE: 80,
  H2H_BASELINE_GROWTH: 1.35,       // escalates fast -> ~10 rounds
  H2H_MAX_ROUNDS: 12,

  // --- Core (02) ---
  WARD_PCT_BY_CL: { 11:0.1, 14:0.15, 17:0.2 },  // ward = pct of core max hp
};
```

---

## 2. Progression formulas

| Quantity | Formula | Notes |
|----------|---------|-------|
| Tier power budget | `budget(T) = 100 · 1.9^(T-1)` | anchor for all stats |
| Tier threshold | midpoint of consecutive budgets | `04` §4.3 |
| Unit space | `SPACE_COST[T-1]` | fixed curve |
| Dig cost | `round(8 + 0.5 · openedTiles)` | rises with sprawl |
| CL upgrade cost | table (`02` §2.1), ~1.6×/level early | not a clean formula by design |
| DP from kill | `round(4 · powerScore(adv)/100 · (unique?5:1))` | |
| Wave-clear DP | `round(25 · (1 + 0.15·W))` | |
| Unit price | `round(6 · powerScore/100 · familyMult · roleMult)` | |
| Gear price | `round(10 · tier^1.3 · qualityMult)` | |
| Research node | `round(40 · 1.7^(Rtier-1) · weight)` | |

---

## 3. Threat budget (wave scaling)

```
function threatBudget(W):
  if W <= SOFTCAP: return round(THREAT_BUDGET_BASE * THREAT_BUDGET_GROWTH^(W-1))
  else:
    capValue = THREAT_BUDGET_BASE * THREAT_BUDGET_GROWTH^(SOFTCAP-1)
    return round(capValue * (1 + 0.06*(W-SOFTCAP)) )   // linear-ish after softcap
```
Rationale: exponential early (fast escalation, satisfying ramp) then near-linear so late waves stay survivable into the dozens (pacing target `01` §8). All three constants are tunable.

### 3.1 Tier band schedule
```
minTier(W) = clamp( floor(W/6) , 1, 9 )
maxTier(W) = clamp( 2 + floor(W/3.5) , 2, 10 )
```
So W1: T1–T2; W10: T1–T4; W20: T3–T7; W35: T5–T10. Hordes widen the band downward (cheap fodder), crusades upward (elites). Tunable.

---

## 4. Stat budget allocation guide (authoring)

When authoring a unit/class to tier `T` with budget `B = budget(T)`:
1. Pick a **role template** (front/ranged/caster/rogue/tank) → stat weight profile.
2. Distribute `B` across stats using the profile, then compute `powerScore`; nudge primaries until `tierOf == T`.
3. Secondary stats (dodge/crit/atkSpeed) consume budget per `POWER_WEIGHTS` — a high-dodge rogue trades raw hp/atk for evasion.

Reference role profiles (fraction of budget spent on each axis):

| Role | hp | def | mainAtk | secondary (spd/crit/dodge/range...) |
|------|---:|----:|--------:|-------------------------------------|
| Front/Bruiser | 45% | 20% | 30% | 5% |
| Tank | 55% | 30% | 10% | 5% (block) |
| Ranged DPS | 25% | 8% | 47% | 20% (range/acc/atkSpeed) |
| Caster | 20% | 6% | 54% | 20% (range/magPen/splash) |
| Rogue | 22% | 8% | 35% | 35% (dodge/crit/stealth/speed) |
| Spammer | 25% | 8% | 35% | 32% (atkSpeed/moveSpeed/acc) |

---

## 5. Anchor fight checks (balance targets)

These are the "is it balanced?" assertions the balance test-suite should approximate (via running the sim, `10`):

| Check | Target |
|-------|--------|
| Same-tier 1v1, both stock front units | winner has 25–55% HP left; fight lasts 4–12s |
| Same-tier ranged vs front (open ground) | ranged wins if it can kite; front wins if it closes — map-dependent |
| One tier-up unit vs tier-down | tier-up wins comfortably (>60% HP) but not unscathed |
| 1 tank + 2 spammers vs 1 same-tier rogue | spammers kill rogue before it reaches backline ~80% of time |
| Stock dungeon at CL C vs scheduled wave at W(C) | clears with core >50% if reasonably built |
| Over-invested single-axis build | visibly punished (e.g., all-tank, no dps → stalemates/timeouts) |

`[R-BAL-001]` A CI "balance smoke test" runs a battery of seeded sims and asserts the above ranges; out-of-range results flag a tuning regression (not a hard fail; a report).

---

## 6. DP income vs outgo model (pacing)

Approximate per-wave net DP for a well-played run should be a **small positive** that lets the player afford ~1 meaningful purchase/wave and a CL every ~3–5 waves (`01` §8). The levers:
- Raise income: `BASE_KILL`, `WAVE_CLEAR_*`.
- Raise outgo: CL costs, unit/research/gear prices.
`[R-BAL-002]` Maintain `income(W) / costOfNextCL` so CL pace matches the CL feature schedule (`02`). Provide a spreadsheet/notebook (build task) that plots income vs CL/research curves for tuning.

---

## 7. Versioning
`[R-BAL-010]` `CONFIG` and the sim have a **version string**. Stored timelines / H2H snapshots record the version; replays only valid within the same major sim version (`16`). Bump on any determinism-affecting change.

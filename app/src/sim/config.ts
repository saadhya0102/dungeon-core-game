// ============================================================================
// CONFIG - single source of all tunable constants (docs/11)
// ============================================================================
import type { Tier, Quality } from "./types";

export const SIM_VERSION = "1.0.0";

export const CONFIG = {
  // Tiers & power (docs/04, 11)
  POWER_BUDGET_BASE: 100,
  POWER_BUDGET_GROWTH: 1.9,
  SPACE_COST: [1, 2, 3, 5, 10, 20, 30, 50, 80, 200] as number[],
  POWER_WEIGHTS: {
    hp: 0.5, def: 4.0, mainAtk: 4.0, offAtk: 1.5,
    atkSpeed: 60, moveSpeed: 25, range: 8, acc: 20, dodge: 200,
    crit: 150, critMult: 60, mres: 4.0, pen: 3.0, block: 120, lifesteal: 200,
  },

  // Economy (docs/02)
  STARTING_DP: 150,
  BASE_KILL: 8,
  UNIQUE_DP_MULT: 5,
  WAVE_CLEAR_BASE: 40,
  WAVE_CLEAR_GROWTH: 0.4,
  // Extra DP scaling for surviving deep waves (keeps income ahead of costs late).
  WAVE_CLEAR_LATE_POW: 1.4,
  UNIT_COST_BASE: 6,
  TURRET_COST_MULT: 0.9,
  CORE_COST_MULT: 1.1, // core upgrades scale a bit steeper (push toward more rooms/units)
  SELL_REFUND: 0.6,
  SELL_REFUND_TRAP: 0.5,
  DIG_REFUND: 0.4,
  SALVAGE_REFUND: 0.25,

  // Map / digging (docs/03)
  DIG_BASE: 4,
  DIG_GROWTH: 0.2,
  ENTRANCE_SAFE_RADIUS: 2,
  CORE_NOBUILD_HALO: 1,
  // A unit may be "close" to at most this many other units (within NEARBY_RADIUS
  // Chebyshev tiles). Encourages spreading the army across multiple rooms.
  MAX_NEARBY_UNITS: 5,
  NEARBY_RADIUS: 3,

  // Research (docs/06)
  RES_BASE: 40,
  RES_TIER_MULT: 1.7,

  // Gear (docs/07)
  DROP_BASE: 0.06, DROP_TIER_STEP: 0.015, DROP_UNIQUE_BONUS: 0.5,
  GEAR_BASE: 10,
  QUALITY_MULT: {
    common: 1, uncommon: 1.6, rare: 2.5, epic: 4, legendary: 6, mythic: 9,
  } as Record<Quality, number>,
  QUALITY_AFFIX_BUDGET: {
    common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6,
  } as Record<Quality, number>,

  // Combat (docs/10)
  TICK_MS: 100,
  TICKS_PER_SEC: 10,
  BASE_ATTACK_INTERVAL: 1.0,
  BASE_HIT: 0.95, HIT_CAP: 0.99, HIT_CAP_ROGUE: 0.9, HIT_FLOOR: 0.2,
  MIT_K: 100,
  BLOCK_REDUCTION: 0.5,
  MIN_DAMAGE: 1,
  LEASH_TILES: 4,
  MAX_TICKS_BASE: 600,

  // Waves (docs/09)
  THREAT_BUDGET_BASE: 60,
  THREAT_BUDGET_GROWTH: 1.18,
  THREAT_BUDGET_SOFTCAP_WAVE: 40,
  MILESTONE_EVERY: 5,
  UNIQUE_STAT_MULT_RANGE: [1.25, 1.6] as [number, number],

  // H2H (docs/12) - rounds map to gentle normal-wave checkpoints (h2hEffectiveWave)
  H2H_WAVE_BASE: 8,
  H2H_WAVE_STEP: 2,
  H2H_MAX_ROUNDS: 12,
};

// --- Derived tier tables (docs/02 §3.2, 04 §4.3) ---
export function tierBudget(tier: number): number {
  return Math.round(CONFIG.POWER_BUDGET_BASE * Math.pow(CONFIG.POWER_BUDGET_GROWTH, tier - 1));
}

/** Lower threshold for each tier = midpoint between consecutive budgets. */
export const TIER_LOWER_THRESHOLD: number[] = (() => {
  const t: number[] = [0]; // T1 lower = 0
  for (let tier = 2; tier <= 10; tier++) {
    const mid = (tierBudget(tier - 1) + tierBudget(tier)) / 2;
    t.push(Math.round(mid));
  }
  return t; // index 0 => T1
})();

export function spaceCost(tier: Tier): number {
  return CONFIG.SPACE_COST[tier - 1];
}

// --- Core Level table (docs/02 §2.1, 19 §2) ---
export interface CoreLevelRow {
  cl: number;
  cost: number;
  coreHp: number;
  capacity: number;
  sizeCap: number;
  maxUnitTier: Tier;
  researchTier: number;
}

export const CORE_LEVELS: CoreLevelRow[] = [
  { cl: 1, cost: 0, coreHp: 200, capacity: 5, sizeCap: 49, maxUnitTier: 2, researchTier: 1 },
  { cl: 2, cost: 120, coreHp: 320, capacity: 9, sizeCap: 81, maxUnitTier: 2, researchTier: 1 },
  { cl: 3, cost: 220, coreHp: 480, capacity: 14, sizeCap: 121, maxUnitTier: 3, researchTier: 2 },
  { cl: 4, cost: 380, coreHp: 700, capacity: 22, sizeCap: 169, maxUnitTier: 3, researchTier: 2 },
  { cl: 5, cost: 620, coreHp: 1000, capacity: 34, sizeCap: 225, maxUnitTier: 4, researchTier: 3 },
  { cl: 6, cost: 980, coreHp: 1400, capacity: 50, sizeCap: 289, maxUnitTier: 4, researchTier: 3 },
  { cl: 7, cost: 1500, coreHp: 1950, capacity: 72, sizeCap: 361, maxUnitTier: 5, researchTier: 4 },
  { cl: 8, cost: 2300, coreHp: 2700, capacity: 100, sizeCap: 441, maxUnitTier: 6, researchTier: 4 },
  { cl: 9, cost: 3400, coreHp: 3700, capacity: 140, sizeCap: 529, maxUnitTier: 6, researchTier: 5 },
  { cl: 10, cost: 5000, coreHp: 5000, capacity: 190, sizeCap: 625, maxUnitTier: 7, researchTier: 5 },
  { cl: 11, cost: 7200, coreHp: 6800, capacity: 255, sizeCap: 729, maxUnitTier: 7, researchTier: 6 },
  { cl: 12, cost: 10200, coreHp: 9200, capacity: 340, sizeCap: 841, maxUnitTier: 8, researchTier: 6 },
  { cl: 13, cost: 14500, coreHp: 12500, capacity: 450, sizeCap: 961, maxUnitTier: 8, researchTier: 7 },
  { cl: 14, cost: 20500, coreHp: 17000, capacity: 600, sizeCap: 1089, maxUnitTier: 9, researchTier: 7 },
  { cl: 15, cost: 29000, coreHp: 23000, capacity: 800, sizeCap: 1225, maxUnitTier: 9, researchTier: 8 },
  { cl: 16, cost: 41000, coreHp: 31000, capacity: 1050, sizeCap: 1369, maxUnitTier: 10, researchTier: 8 },
  { cl: 17, cost: 58000, coreHp: 42000, capacity: 1380, sizeCap: 1521, maxUnitTier: 10, researchTier: 9 },
  { cl: 18, cost: 82000, coreHp: 57000, capacity: 1800, sizeCap: 1681, maxUnitTier: 10, researchTier: 9 },
  { cl: 19, cost: 116000, coreHp: 77000, capacity: 2350, sizeCap: 1849, maxUnitTier: 10, researchTier: 10 },
  { cl: 20, cost: 164000, coreHp: 104000, capacity: 3050, sizeCap: 2025, maxUnitTier: 10, researchTier: 10 },
];

export const WARD_PCT_BY_CL: { cl: number; pct: number }[] = [
  { cl: 11, pct: 0.1 }, { cl: 14, pct: 0.15 }, { cl: 17, pct: 0.2 },
];

export function coreLevelRow(cl: number): CoreLevelRow {
  return CORE_LEVELS[Math.max(0, Math.min(CORE_LEVELS.length - 1, cl - 1))];
}

export function wardForCl(cl: number, maxHp: number): number {
  let pct = 0;
  for (const w of WARD_PCT_BY_CL) if (cl >= w.cl) pct = w.pct;
  return Math.round(maxHp * pct);
}

// Room-size requirement by unit tier (docs/03): higher-tier units need a larger
// centered open square ("room") of dug floor. Value = radius; room is (2r+1)^2.
export const ROOM_RADIUS_BY_TIER: number[] = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3];

export function roomRadius(tier: number): number {
  return ROOM_RADIUS_BY_TIER[Math.max(0, Math.min(9, tier - 1))];
}

// ============================================================================
// Economy helpers - costs, rewards, validation predicates (docs/02, 11)
// Used by both client preview and (future) server authority.
// ============================================================================
import type { Tier, UnitDef, Quality } from "./types";
import { CONFIG, coreLevelRow, tierBudget } from "./config";
import { powerScore } from "./power";

export function dpKill(advPowerScore: number, isUnique: boolean): number {
  return Math.round(
    CONFIG.BASE_KILL * (advPowerScore / 100) * (isUnique ? CONFIG.UNIQUE_DP_MULT : 1),
  );
}

export function dpWaveClear(wave: number): number {
  return Math.round(CONFIG.WAVE_CLEAR_BASE * (1 + wave * CONFIG.WAVE_CLEAR_GROWTH));
}

const ROLE_COST_MULT: Record<string, number> = {
  swarm: 0.85, melee: 0.95, ranged: 1.0, caster: 1.05, bruiser: 1.0,
  tank: 1.0, summoner: 1.15, control: 1.15, hybrid: 1.1, colossus: 1.1,
  capstone: 1.25, utility: 1.1,
};

const FAMILY_COST_MULT: Record<string, number> = {
  goblinoid: 0.9, undead: 0.95, beast: 1.0, demon: 1.15, construct: 1.05, aberration: 1.1,
};

export function unitCost(def: UnitDef): number {
  const ps = powerScore(def.stats);
  const fam = FAMILY_COST_MULT[def.family] ?? 1;
  const role = ROLE_COST_MULT[def.role] ?? 1;
  const base = CONFIG.UNIT_COST_BASE * (ps / 100) * fam * role;
  return Math.max(1, Math.round(base * (def.turretCapable && def.role === "tank" ? 1 : 1)));
}

export function turretCost(def: UnitDef): number {
  return Math.max(1, Math.round(unitCost(def) * CONFIG.TURRET_COST_MULT));
}

export function digCost(openedTiles: number): number {
  return Math.round(CONFIG.DIG_BASE + CONFIG.DIG_GROWTH * openedTiles);
}

export function clUpgradeCost(currentCl: number): number {
  const next = coreLevelRow(currentCl + 1);
  return next.cost;
}

export function researchCost(researchTier: number, weight: number): number {
  return Math.round(CONFIG.RES_BASE * Math.pow(CONFIG.RES_TIER_MULT, researchTier - 1) * weight);
}

export function gearPrice(tier: Tier, quality: Quality): number {
  return Math.round(CONFIG.GEAR_BASE * Math.pow(tier, 1.3) * CONFIG.QUALITY_MULT[quality]);
}

export function salvageValue(tier: Tier, quality: Quality): number {
  return Math.max(1, Math.round(gearPrice(tier, quality) * CONFIG.SALVAGE_REFUND));
}

/** Power budget per tier (anchor for content authoring + balance). */
export function powerBudget(tier: number): number {
  return tierBudget(tier);
}

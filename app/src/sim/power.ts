// ============================================================================
// Power score & tier - the ONLY place tier is decided (docs/04 §4).
// Swap powerScore() to retune tiering. Computed on intrinsic base stats only.
// ============================================================================
import type { StatBlock, Tier, ResolvedStats } from "./types";
import { DEFAULT_SECONDARY } from "./types";
import { CONFIG, TIER_LOWER_THRESHOLD } from "./config";

export function resolveStats(stats: StatBlock): ResolvedStats {
  return {
    hp: stats.hp,
    def: stats.def,
    phys: stats.phys,
    mag: stats.mag,
    rng: stats.rng,
    moveSpeed: stats.moveSpeed ?? DEFAULT_SECONDARY.moveSpeed,
    atkSpeed: stats.atkSpeed ?? DEFAULT_SECONDARY.atkSpeed,
    range: stats.range ?? DEFAULT_SECONDARY.range,
    acc: stats.acc ?? DEFAULT_SECONDARY.acc,
    dodge: stats.dodge ?? DEFAULT_SECONDARY.dodge,
    crit: stats.crit ?? DEFAULT_SECONDARY.crit,
    critMult: stats.critMult ?? DEFAULT_SECONDARY.critMult,
    mres: stats.mres ?? DEFAULT_SECONDARY.mres,
    armorPen: stats.armorPen ?? DEFAULT_SECONDARY.armorPen,
    magPen: stats.magPen ?? DEFAULT_SECONDARY.magPen,
    stealth: stats.stealth ?? DEFAULT_SECONDARY.stealth,
    detection: stats.detection ?? DEFAULT_SECONDARY.detection,
    block: stats.block ?? DEFAULT_SECONDARY.block,
    lifesteal: stats.lifesteal ?? DEFAULT_SECONDARY.lifesteal,
    regen: stats.regen ?? DEFAULT_SECONDARY.regen,
    aggroRadius: stats.aggroRadius ?? DEFAULT_SECONDARY.aggroRadius,
    threat: stats.threat ?? DEFAULT_SECONDARY.threat,
  };
}

export function powerScore(stats: StatBlock): number {
  const s = resolveStats(stats);
  const w = CONFIG.POWER_WEIGHTS;
  const mainAtk = Math.max(s.phys, s.mag, s.rng);
  const offAtk = s.phys + s.mag + s.rng - mainAtk;
  return (
    s.hp * w.hp +
    s.def * w.def +
    mainAtk * w.mainAtk +
    offAtk * w.offAtk +
    (s.atkSpeed - 1) * w.atkSpeed +
    (s.moveSpeed - 1) * w.moveSpeed +
    s.range * w.range +
    s.acc * w.acc +
    s.dodge * w.dodge +
    s.crit * w.crit +
    (s.critMult - 1.5) * w.critMult +
    s.mres * w.mres +
    (s.armorPen + s.magPen) * w.pen +
    s.block * w.block +
    s.lifesteal * w.lifesteal
  );
}

export function tierOf(stats: StatBlock): Tier {
  const score = powerScore(stats);
  for (let t = 10; t >= 1; t--) {
    if (score >= TIER_LOWER_THRESHOLD[t - 1]) return t as Tier;
  }
  return 1;
}

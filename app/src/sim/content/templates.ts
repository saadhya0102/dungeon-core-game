// ============================================================================
// Stat generator - allocates a tier's power budget by role so tierOf()==tier
// by construction (docs/04 §4, 11 §4). Content authors pick role+dmg+tier;
// stats are generated and guaranteed valid.
// ============================================================================
import type { StatBlock, Tier, AffinityType } from "../types";
import { DEFAULT_SECONDARY } from "../types";
import { CONFIG } from "../config";
import { powerScore, tierOf } from "../power";
import { tierBudget } from "../config";

export type GenRole =
  | "swarm" | "bruiser" | "tank" | "ranged" | "caster"
  | "rogue" | "spammer" | "colossus" | "summoner" | "skirmisher";
export type DmgKind = "melee" | "ranged" | "arcane";

interface Profile {
  hp: number; def: number; main: number; // primary ratios (normalized internally)
  sec: Partial<StatBlock>;                // secondary overrides (absolute values)
}

// Rebalanced so same-tier units of different roles have comparable combat value:
// every role keeps a survivability floor, and offense roles trade raw HP for
// damage rather than being one-shot glass cannons. Archers out-range mages;
// mages get AoE via abilities (content). Sight (aggroRadius) is set >= range.
const PROFILES: Record<GenRole, Profile> = {
  swarm: { hp: 0.40, def: 0.12, main: 0.48, sec: { atkSpeed: 1.15, moveSpeed: 1.1, threat: 1.0 } },
  bruiser: { hp: 0.45, def: 0.18, main: 0.37, sec: { atkSpeed: 1.05, threat: 1.3, block: 0.06 } },
  tank: { hp: 0.55, def: 0.28, main: 0.17, sec: { block: 0.18, threat: 2.4, moveSpeed: 0.9, mres: 8 } },
  ranged: { hp: 0.34, def: 0.10, main: 0.56, sec: { range: 5, acc: 1.15, atkSpeed: 1.1, moveSpeed: 1.05 } },
  caster: { hp: 0.32, def: 0.10, main: 0.58, sec: { range: 4, magPen: 6, mres: 6 } },
  rogue: { hp: 0.36, def: 0.10, main: 0.54, sec: { dodge: 0.25, crit: 0.25, stealth: 0.35, moveSpeed: 1.4, acc: 1.1, detection: 30 } },
  spammer: { hp: 0.34, def: 0.10, main: 0.56, sec: { atkSpeed: 1.55, moveSpeed: 1.25, acc: 1.2, range: 4 } },
  colossus: { hp: 0.50, def: 0.18, main: 0.32, sec: { threat: 2.0, block: 0.1, moveSpeed: 0.9 } },
  summoner: { hp: 0.34, def: 0.12, main: 0.54, sec: { range: 5, threat: 1.4 } },
  skirmisher: { hp: 0.40, def: 0.12, main: 0.48, sec: { moveSpeed: 1.45, crit: 0.15, atkSpeed: 1.15 } },
};

const W = CONFIG.POWER_WEIGHTS;

/** powerScore contribution of secondary stats only (primaries = 0). */
function secondaryScore(s: Required<Pick<StatBlock,
  "atkSpeed" | "moveSpeed" | "range" | "acc" | "dodge" | "crit" | "critMult" |
  "mres" | "armorPen" | "magPen" | "block" | "lifesteal">>): number {
  return (
    (s.atkSpeed - 1) * W.atkSpeed +
    (s.moveSpeed - 1) * W.moveSpeed +
    s.range * W.range +
    s.acc * W.acc +
    s.dodge * W.dodge +
    s.crit * W.crit +
    (s.critMult - 1.5) * W.critMult +
    s.mres * W.mres +
    (s.armorPen + s.magPen) * W.pen +
    s.block * W.block +
    s.lifesteal * W.lifesteal
  );
}

const SCALABLE_KEYS = [
  "atkSpeed", "moveSpeed", "range", "acc", "dodge", "crit", "critMult",
  "mres", "armorPen", "magPen", "block", "lifesteal",
] as const;

export function buildStats(tier: Tier, role: GenRole, dmg: DmgKind): StatBlock {
  const target = tierBudget(tier);
  const profile = PROFILES[role];

  // Resolve secondary stat set: defaults + profile overrides.
  const sec: Record<string, number> = {};
  for (const k of SCALABLE_KEYS) sec[k] = (DEFAULT_SECONDARY as Record<string, number>)[k];
  for (const [k, v] of Object.entries(profile.sec)) {
    if (v !== undefined) sec[k] = v as number;
  }

  // Neutral score (defaults only) and current secondary score.
  const neutral: Record<string, number> = {};
  for (const k of SCALABLE_KEYS) neutral[k] = (DEFAULT_SECONDARY as Record<string, number>)[k];
  const neutralScore = secondaryScore(neutral as never);
  let secScore = secondaryScore(sec as never);

  // Clamp so primaries get at least 25% of budget.
  const maxSec = 0.75 * target;
  if (secScore > maxSec && secScore > neutralScore) {
    const f = (maxSec - neutralScore) / (secScore - neutralScore);
    for (const k of SCALABLE_KEYS) sec[k] = neutral[k] + (sec[k] - neutral[k]) * f;
    secScore = secondaryScore(sec as never);
  }

  let primBudget = Math.max(target * 0.25, target - secScore);

  const sum = profile.hp + profile.def + profile.main;
  const rHp = profile.hp / sum, rDef = profile.def / sum, rMain = profile.main / sum;

  let hp = (primBudget * rHp) / W.hp;
  let def = (primBudget * rDef) / W.def;
  let main = (primBudget * rMain) / W.mainAtk;

  const stats: StatBlock = {
    hp: Math.round(hp),
    def: Math.round(def),
    phys: dmg === "melee" ? Math.round(main) : 0,
    mag: dmg === "arcane" ? Math.round(main) : 0,
    rng: dmg === "ranged" ? Math.round(main) : 0,
    moveSpeed: round2(sec.moveSpeed),
    atkSpeed: round2(sec.atkSpeed),
    range: dmg === "melee" ? Math.max(1, Math.round(sec.range > 2 ? 1 : sec.range)) : Math.max(2, Math.round(sec.range)),
    acc: round2(sec.acc),
    dodge: round2(sec.dodge),
    crit: round2(sec.crit),
    critMult: round2(sec.critMult),
    mres: Math.round(sec.mres),
    armorPen: Math.round(sec.armorPen),
    magPen: Math.round(sec.magPen),
    stealth: round2(profile.sec.stealth ?? 0),
    detection: Math.round(profile.sec.detection ?? 0),
    block: round2(sec.block),
    lifesteal: round2(sec.lifesteal),
    regen: 0,
    // Sight >= attack range so a unit can always see what it can hit.
    aggroRadius: Math.max(6, Math.round(dmg === "melee" ? 4 : sec.range + 2)),
    threat: round2(profile.sec.threat ?? 1),
  };

  // Correction pass: nudge primaries so tierOf == tier.
  let guard = 0;
  while (tierOf(stats) !== tier && guard < 24) {
    const score = powerScore(stats);
    const k = target / Math.max(1, score);
    stats.hp = Math.max(1, Math.round(stats.hp * k));
    stats.def = Math.max(0, Math.round(stats.def * k));
    if (stats.phys) stats.phys = Math.max(1, Math.round(stats.phys * k));
    if (stats.mag) stats.mag = Math.max(1, Math.round(stats.mag * k));
    if (stats.rng) stats.rng = Math.max(1, Math.round(stats.rng * k));
    guard++;
  }
  return stats;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function dmgToAffinity(dmg: DmgKind): AffinityType {
  return dmg === "melee" ? "melee" : dmg === "ranged" ? "ranged" : "arcane";
}

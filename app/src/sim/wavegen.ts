// ============================================================================
// Wave generation (docs/09). Pure function of (wave, seed) -> WaveDef.
// Relaxed, smooth scaling: solo for the first waves, then a biased group-size
// ramp (no sudden crusades), uniques only later.
// ============================================================================
import type { WaveDef, WaveInvader, GroupType, Archetype, Tier } from "./types";
import { CONFIG } from "./config";
import { makePRNG, hashSeed } from "./rng";
import type { PRNG } from "./rng";
import { classForTier, UNIQUES, CLASS_BY_ID } from "./content/enemies";
import { eligibleComps } from "./content/comps";
import type { TierBias } from "./content/comps";

/** Legacy threat budget (kept for reference/tools; not used for group size). */
export function threatBudget(wave: number): number {
  const { THREAT_BUDGET_BASE: base, THREAT_BUDGET_GROWTH: g, THREAT_BUDGET_SOFTCAP_WAVE: cap } = CONFIG;
  if (wave <= cap) return Math.round(base * Math.pow(g, wave - 1));
  const capValue = base * Math.pow(g, cap - 1);
  return Math.round(capValue * (1 + 0.06 * (wave - cap)));
}

export function tierBand(wave: number): [number, number] {
  const min = Math.max(1, Math.min(9, Math.floor(wave / 10)));
  const max = Math.max(1, Math.min(10, 1 + Math.floor(wave / 5)));
  return [min, Math.max(min, max)];
}

// First N waves are strictly single adventurers (gentle onboarding).
const SOLO_UNTIL = 6;
// Milestone "army" waves begin here, then every MILESTONE_GAP waves.
const MILESTONE_START = 20;
const MILESTONE_GAP = 10;

export function isMilestone(wave: number): boolean {
  return wave >= MILESTONE_START && (wave - MILESTONE_START) % MILESTONE_GAP === 0;
}

/** Upper bound on group size at a given wave (smooth, no sudden jumps). */
export function maxGroupSize(wave: number): number {
  if (wave <= SOLO_UNTIL) return 1;
  return 1 + Math.floor((wave - (SOLO_UNTIL + 1)) / 3);
}

/** Roll an actual group size: weighted toward the smaller end, growing with wave. */
function rollGroupSize(wave: number, rng: PRNG): number {
  const maxS = maxGroupSize(wave);
  if (maxS <= 1) return 1;
  const minS = Math.max(1, Math.floor(maxS * 0.25));
  const t = Math.pow(rng.next(), 1.7); // bias toward smaller groups
  return Math.max(1, minS + Math.floor(t * (maxS - minS + 1)));
}

export function groupTypeForSize(size: number): GroupType {
  if (size <= 1) return "solo";
  if (size <= 5) return "party";
  if (size <= 15) return "horde";
  return "crusade";
}

const ROLE_RATIOS: Record<GroupType, Record<Archetype, number>> = {
  solo: { warrior: 0.4, archer: 0.25, mage: 0.2, rogue: 0.15 },
  party: { warrior: 0.38, archer: 0.3, mage: 0.17, rogue: 0.15 },
  horde: { warrior: 0.52, archer: 0.27, mage: 0.09, rogue: 0.12 },
  crusade: { warrior: 0.4, archer: 0.26, mage: 0.18, rogue: 0.16 },
};

const ARCHES: Archetype[] = ["warrior", "archer", "mage", "rogue"];

function rollUniqueCount(wave: number, size: number, milestone: boolean, rng: PRNG): number {
  if (wave < 8) return 0;
  if (milestone) return 1 + (wave >= 40 && rng.bool(0.5) ? 1 : 0);
  if (size >= 10) return rng.bool(0.5) ? 1 : 0;
  if (size >= 4) return rng.bool(0.3) ? 1 : 0;
  if (wave >= 12) return rng.bool(0.12) ? 1 : 0;
  return 0;
}

function tierWithBias(band: [number, number], bias: TierBias | undefined, rng: PRNG): Tier {
  const [lo, hi] = band;
  let t: number;
  if (bias === "low") t = lo + Math.floor(Math.pow(rng.next(), 2.2) * (hi - lo + 1));
  else if (bias === "high") t = hi - Math.floor(Math.pow(rng.next(), 2.2) * (hi - lo + 1));
  else t = lo + Math.floor(rng.next() * (hi - lo + 1));
  return Math.max(1, Math.min(10, t)) as Tier;
}

function pickUniqueFor(arch: Archetype, rng: PRNG) {
  const pool = UNIQUES.filter((u) => CLASS_BY_ID[u.baseClassId]?.archetype === arch);
  return pool.length ? rng.pick(pool) : rng.pick(UNIQUES);
}

const MAX_WAVE_INVADERS = 80;

function makeInvader(wave: number, idx: number, classId: string, tier: Tier, isUnique: boolean, statMult: number, uniqueId?: string): WaveInvader {
  return { id: `inv_${wave}_${idx}`, classId, tier, isUnique, statMult, uniqueId };
}

export function generateWave(wave: number, seedRoot: number): WaveDef {
  const seed = hashSeed(seedRoot, wave, 0xABCDEF);
  const rng = makePRNG(seed);
  const band = tierBand(wave);
  const milestone = isMilestone(wave);

  let size = rollGroupSize(wave, rng);
  if (milestone) size = Math.round(maxGroupSize(wave) * 1.15) + 1;

  const invaders: WaveInvader[] = [];
  const addUnique = (arch: Archetype) => {
    if (invaders.length >= MAX_WAVE_INVADERS) return;
    const u = pickUniqueFor(arch, rng);
    const baseCls = CLASS_BY_ID[u.baseClassId];
    const tier = Math.max(band[0], Math.min(band[1], baseCls?.tier ?? band[1])) as Tier;
    const mult = rng.range(CONFIG.UNIQUE_STAT_MULT_RANGE[0], CONFIG.UNIQUE_STAT_MULT_RANGE[1]);
    invaders.push(makeInvader(wave, invaders.length, u.baseClassId, tier, true, Math.round(mult * 100) / 100, u.id));
  };
  const addUnit = (arch: Archetype, bias: TierBias | undefined) => {
    if (invaders.length >= MAX_WAVE_INVADERS) return;
    const tier = tierWithBias(band, bias, rng);
    const cls = classForTier(arch, tier);
    invaders.push(makeInvader(wave, invaders.length, cls.id, cls.tier, false, 1));
  };

  // Curated composition templates when available, else procedural fallback.
  const pool = eligibleComps(wave, milestone);
  if (pool.length > 0) {
    const comp = rng.weighted(pool, pool.map((c) => c.weight));
    const result = comp.build(size, rng);
    for (const u of result.uniques) for (let i = 0; i < u.count; i++) addUnique(u.archetype);
    for (const part of result.parts) for (let i = 0; i < part.count; i++) addUnit(part.archetype, part.tierBias);
    const group = groupTypeForSize(invaders.length);
    if (invaders.length === 0) addUnit("warrior", undefined);
    return { wave, seed, groupType: group, tierBand: band, invaders };
  }

  // Procedural fallback (early waves / solo).
  const group = groupTypeForSize(size);
  const ratios = ROLE_RATIOS[group];
  const nUniques = rollUniqueCount(wave, size, milestone, rng);
  for (let i = 0; i < nUniques && invaders.length < size; i++) addUnique(rng.pick(ARCHES));
  const recentRoles: Archetype[] = [];
  while (invaders.length < size) {
    let arch = rng.weighted(ARCHES, ARCHES.map((a) => ratios[a]));
    if (size <= 4 && recentRoles.includes(arch) && rng.bool(0.6)) {
      arch = rng.weighted(ARCHES, ARCHES.map((a) => (a === arch ? 0.05 : ratios[a])));
    }
    recentRoles.push(arch);
    addUnit(arch, group === "horde" || group === "crusade" ? "low" : "normal");
  }
  if (invaders.length === 0) addUnit("warrior", undefined);
  return { wave, seed, groupType: group, tierBand: band, invaders };
}

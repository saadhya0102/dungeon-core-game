// ============================================================================
// Wave composition templates (docs/09). Curated, flavorful party/army setups
// with distinct playstyles, scaled by a `scale` (group size). Picked by wavegen.
// ============================================================================
import type { Archetype } from "../types";
import type { PRNG } from "../rng";

export type TierBias = "low" | "high" | "normal";

export interface CompPart {
  archetype: Archetype;
  count: number;
  tierBias?: TierBias;
}

export interface CompResult {
  name: string;
  parts: CompPart[];
  uniques: { archetype: Archetype; count: number }[];
}

export interface CompSpec {
  id: string;
  name: string;
  minWave: number;
  maxWave: number;
  epic: boolean; // epic comps only appear on milestone waves
  weight: number;
  build: (scale: number, rng: PRNG) => CompResult;
}

const r = (n: number) => Math.max(1, Math.round(n));

// --- Normal comps (non-milestone) ---
const NORMAL: CompSpec[] = [
  {
    id: "duo_skirmish", name: "Skirmishers", minWave: 6, maxWave: 999, epic: false, weight: 3,
    build: (s) => { const m = r(s * 0.5); return { name: "Skirmishers", parts: [{ archetype: "warrior", count: m }, { archetype: "archer", count: Math.max(1, s - m) }], uniques: [] }; },
  },
  {
    id: "melee_mage", name: "Spellblades", minWave: 6, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const m = r(s * 0.6); return { name: "Spellblades", parts: [{ archetype: "warrior", count: m }, { archetype: "mage", count: Math.max(1, s - m) }], uniques: [] }; },
  },
  {
    id: "archer_band", name: "Archer Band", minWave: 7, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const front = s >= 3 ? 1 : 0; return { name: "Archer Band", parts: [...(front ? [{ archetype: "warrior" as Archetype, count: 1 }] : []), { archetype: "archer", count: Math.max(1, s - front) }], uniques: [] }; },
  },
  {
    id: "rogue_scouts", name: "Scouting Party", minWave: 8, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const ro = r(s * 0.5); return { name: "Scouting Party", parts: [{ archetype: "rogue", count: ro }, { archetype: "archer", count: Math.max(1, s - ro) }], uniques: [] }; },
  },
  {
    id: "adventuring_party", name: "Adventuring Party", minWave: 9, maxWave: 999, epic: false, weight: 3,
    build: (s) => {
      const melee = Math.max(1, s - 3);
      return {
        name: "Adventuring Party",
        parts: [
          { archetype: "warrior", count: melee },
          { archetype: "mage", count: 1 },
          { archetype: "archer", count: 1 },
          { archetype: "rogue", count: 1 },
        ],
        uniques: [],
      };
    },
  },
  {
    id: "shield_line", name: "Shield Line", minWave: 11, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const w = r(s * 0.7); return { name: "Shield Line", parts: [{ archetype: "warrior", count: w }, { archetype: "archer", count: Math.max(1, s - w) }], uniques: [] }; },
  },
  {
    id: "caster_coven", name: "Caster Coven", minWave: 12, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const mg = r(s * 0.6); return { name: "Caster Coven", parts: [{ archetype: "warrior", count: 1 }, { archetype: "mage", count: mg }, { archetype: "archer", count: Math.max(1, s - mg - 1) }], uniques: [] }; },
  },
  {
    id: "assassin_cell", name: "Assassin Cell", minWave: 12, maxWave: 999, epic: false, weight: 2,
    build: (s) => { const ro = r(s * 0.7); return { name: "Assassin Cell", parts: [{ archetype: "rogue", count: ro }, { archetype: "mage", count: Math.max(1, s - ro) }], uniques: [] }; },
  },
  {
    id: "warband", name: "Mixed Warband", minWave: 10, maxWave: 999, epic: false, weight: 2,
    build: (s) => {
      const w = r(s * 0.4), a = r(s * 0.25), m = r(s * 0.15);
      return { name: "Mixed Warband", parts: [{ archetype: "warrior", count: w }, { archetype: "archer", count: a }, { archetype: "mage", count: m }, { archetype: "rogue", count: Math.max(1, s - w - a - m) }], uniques: [] };
    },
  },
];

// --- Epic comps (milestone waves only) ---
const EPIC: CompSpec[] = [
  {
    id: "arrow_storm", name: "Arrow Storm", minWave: 20, maxWave: 999, epic: true, weight: 2,
    build: (s) => ({ name: "Arrow Storm", parts: [{ archetype: "warrior", count: r(s * 0.2) }, { archetype: "archer", count: r(s * 1.3), tierBias: "low" }], uniques: [{ archetype: "archer", count: 1 }] }),
  },
  {
    id: "the_legion", name: "The Legion", minWave: 20, maxWave: 999, epic: true, weight: 2,
    build: (s) => ({ name: "The Legion", parts: [{ archetype: "warrior", count: r(s * 1.6), tierBias: "low" }, { archetype: "archer", count: r(s * 0.15) }], uniques: [{ archetype: "warrior", count: 1 }] }),
  },
  {
    id: "doom_council", name: "Doom Council", minWave: 25, maxWave: 999, epic: true, weight: 2,
    build: (s) => ({ name: "Doom Council", parts: [{ archetype: "warrior", count: r(s * 0.4) }, { archetype: "mage", count: r(s * 0.9), tierBias: "high" }], uniques: [{ archetype: "mage", count: s >= 20 ? 2 : 1 }] }),
  },
  {
    id: "grand_crusade", name: "Grand Crusade", minWave: 20, maxWave: 999, epic: true, weight: 3,
    build: (s) => ({ name: "Grand Crusade", parts: [{ archetype: "warrior", count: r(s * 0.5) }, { archetype: "archer", count: r(s * 0.3) }, { archetype: "mage", count: r(s * 0.15) }, { archetype: "rogue", count: r(s * 0.1) }], uniques: [{ archetype: "warrior", count: 1 }, { archetype: "mage", count: 1 }] }),
  },
  {
    id: "shadow_swarm", name: "Shadow Swarm", minWave: 30, maxWave: 999, epic: true, weight: 1,
    build: (s) => ({ name: "Shadow Swarm", parts: [{ archetype: "rogue", count: r(s * 1.2), tierBias: "low" }, { archetype: "mage", count: r(s * 0.25) }], uniques: [{ archetype: "rogue", count: 1 }] }),
  },
];

export const COMPS: CompSpec[] = [...NORMAL, ...EPIC];

export function eligibleComps(wave: number, milestone: boolean): CompSpec[] {
  return COMPS.filter((c) => c.epic === milestone && wave >= c.minWave && wave <= c.maxWave);
}

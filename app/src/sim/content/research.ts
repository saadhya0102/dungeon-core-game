// ============================================================================
// Research tree (docs/06). Generated from the real unit roster + family
// upgrades + general branch. Cross-checked against units at module load.
// ============================================================================
import type { ResearchNode, Family, StatBlock } from "../types";
import { FAMILIES } from "../types";
import { UNITS } from "./units";
import { researchCost } from "../economy";

const nodes: ResearchNode[] = [];
const starterOwned: string[] = [];

function unitUnlockTier(unitTier: number): number {
  return Math.max(1, Math.min(10, unitTier - 1));
}

// --- Per-family unit unlock chains + family upgrades ---
for (const fam of FAMILIES) {
  const famUnits = UNITS.filter((u) => u.family === fam).sort((a, b) => a.tier - b.tier);
  let prevUnlock = "";
  famUnits.forEach((u, idx) => {
    const rTier = unitUnlockTier(u.tier);
    const isStarter = idx === 0;
    const id = `res_unlock_${u.id}`;
    nodes.push({
      id,
      name: `Unlock ${u.name}`,
      branch: fam,
      type: "unlockUnit",
      researchTier: isStarter ? 1 : rTier,
      cost: isStarter ? 0 : researchCost(rTier, 1.0),
      prereqs: prevUnlock ? [prevUnlock] : [],
      ranks: 1,
      effect: { unlockUnitId: u.id },
    });
    if (isStarter) starterOwned.push(id);
    prevUnlock = id;
  });

  // Family upgrades: offense / defense / signature
  const offStat: keyof StatBlock = "phys";
  nodes.push({
    id: `res_${fam}_offense`, name: `${cap(fam)} Ferocity`, branch: fam,
    type: "familyUpgrade", researchTier: 1, cost: researchCost(1, 0.8),
    prereqs: [], ranks: 5, effect: { family: fam, stat: offStat, addPct: 0.06 },
  });
  nodes.push({
    id: `res_${fam}_defense`, name: `${cap(fam)} Resilience`, branch: fam,
    type: "familyUpgrade", researchTier: 3, cost: researchCost(3, 0.8),
    prereqs: [`res_${fam}_offense`], ranks: 3, effect: { family: fam, stat: "hp", addPct: 0.1 },
  });
  nodes.push({
    id: `res_${fam}_signature`, name: `${cap(fam)} Mastery`, branch: fam,
    type: "familyUpgrade", researchTier: 5, cost: researchCost(5, 1.5),
    prereqs: [`res_${fam}_defense`], ranks: 3, effect: { family: fam, stat: "atkSpeed", addPct: 0.08 },
  });
}

// --- General branch ---
const general: ResearchNode[] = [
  { id: "res_basic_traps", name: "Basic Traps", branch: "general", type: "unlockContent", researchTier: 1, cost: 32, prereqs: [], ranks: 1, effect: { unlockContent: "traps_t1" } },
  { id: "res_turrets", name: "Turret Engineering", branch: "general", type: "unlockContent", researchTier: 1, cost: 40, prereqs: [], ranks: 1, effect: { unlockContent: "turrets" } },
  { id: "res_salvage", name: "Salvage Doctrine", branch: "general", type: "economy", researchTier: 2, cost: researchCost(2, 0.8), prereqs: [], ranks: 3, effect: { dpKillPct: 0.1 } },
  { id: "res_efficient_digging", name: "Efficient Digging", branch: "general", type: "economy", researchTier: 2, cost: researchCost(2, 0.8), prereqs: [], ranks: 1, effect: { digCostPct: -0.2 } },
  { id: "res_ranged_doctrine", name: "Ranged Doctrine", branch: "general", type: "crossUpgrade", researchTier: 3, cost: researchCost(3, 1.0), prereqs: [], ranks: 1, effect: { crossRole: "rangedAll", stat: "acc", addPct: 0.1 } },
  { id: "res_melee_doctrine", name: "Melee Doctrine", branch: "general", type: "crossUpgrade", researchTier: 3, cost: researchCost(3, 1.0), prereqs: [], ranks: 1, effect: { crossRole: "meleeAll", stat: "phys", addPct: 0.08 } },
  { id: "res_arcane_doctrine", name: "Arcane Doctrine", branch: "general", type: "crossUpgrade", researchTier: 3, cost: researchCost(3, 1.0), prereqs: [], ranks: 1, effect: { crossRole: "casterAll", stat: "mag", addPct: 0.1 } },
  { id: "res_adv_traps", name: "Advanced Traps", branch: "general", type: "unlockContent", researchTier: 4, cost: researchCost(4, 1.0), prereqs: ["res_basic_traps"], ranks: 1, effect: { unlockContent: "traps_t3" } },
  { id: "res_capacity_logistics", name: "Capacity Logistics", branch: "general", type: "economy", researchTier: 4, cost: researchCost(4, 1.0), prereqs: [], ranks: 2, effect: { capacityPct: 0.06 } },
  { id: "res_elite_traps", name: "Elite Traps", branch: "general", type: "unlockContent", researchTier: 6, cost: researchCost(6, 1.0), prereqs: ["res_adv_traps"], ranks: 1, effect: { unlockContent: "traps_t6" } },
  { id: "res_grand_doctrine", name: "Grand Doctrine", branch: "general", type: "crossUpgrade", researchTier: 8, cost: researchCost(8, 1.5), prereqs: ["res_ranged_doctrine", "res_melee_doctrine"], ranks: 1, effect: { crossRole: "meleeAll", stat: "hp", addPct: 0.12 } },
  { id: "res_apex_logistics", name: "Apex Logistics", branch: "general", type: "economy", researchTier: 9, cost: researchCost(9, 1.5), prereqs: ["res_capacity_logistics"], ranks: 1, effect: { capacityPct: 0.15, unitCostPct: -0.15 } },
];
nodes.push(...general);
starterOwned.push("res_basic_traps");

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export const RESEARCH: ResearchNode[] = nodes;
export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(
  nodes.map((n) => [n.id, n]),
);
export const STARTER_RESEARCH: string[] = starterOwned;

export function researchByBranch(branch: Family | "general"): ResearchNode[] {
  return nodes.filter((n) => n.branch === branch);
}

/** Which unit ids are unlocked given owned research. */
export function unlockedUnitIds(owned: string[]): Set<string> {
  const set = new Set<string>();
  for (const id of owned) {
    const node = RESEARCH_BY_ID[id];
    if (node?.effect.unlockUnitId) set.add(node.effect.unlockUnitId);
  }
  return set;
}

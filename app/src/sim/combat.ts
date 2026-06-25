// ============================================================================
// Entity construction + stat resolution for the sim (docs/10 §3, §4; 07; 06).
// ============================================================================
import type {
  RunState, WaveDef, SimEntity, ResolvedStats, StatBlock, GearItem,
  Affinities, AffinityType, Ability, Tier, Family, UnitRole,
} from "./types";
import { resolveStats } from "./power";
import { UNIT_BY_ID, UNIT_DMG } from "./content/units";
import { CLASS_BY_ID } from "./content/enemies";
import { RESEARCH_BY_ID } from "./content/research";
import { key } from "./maputil";

export interface ResearchMods {
  family: Record<string, Partial<Record<keyof StatBlock, number>>>; // multiplicative pct by family
  cross: { rangedAll?: Partial<Record<keyof StatBlock, number>>; meleeAll?: Partial<Record<keyof StatBlock, number>>; casterAll?: Partial<Record<keyof StatBlock, number>> };
  capacityPct: number;
  dpKillPct: number;
  unitCostPct: number;
  digCostPct: number;
}

export function computeResearchMods(run: RunState): ResearchMods {
  const mods: ResearchMods = { family: {}, cross: {}, capacityPct: 0, dpKillPct: 0, unitCostPct: 0, digCostPct: 0 };
  for (const id of run.research.owned) {
    const node = RESEARCH_BY_ID[id];
    if (!node) continue;
    const rank = run.research.ranks[id] ?? 1;
    const e = node.effect;
    if (node.type === "familyUpgrade" && e.family && e.stat && e.addPct) {
      const fam = (mods.family[e.family] ??= {});
      fam[e.stat] = (fam[e.stat] ?? 0) + e.addPct * rank;
    } else if (node.type === "crossUpgrade" && e.crossRole && e.stat && e.addPct) {
      const target = e.crossRole as "rangedAll" | "meleeAll" | "casterAll";
      const bucket = (mods.cross[target] ??= {});
      bucket[e.stat] = (bucket[e.stat] ?? 0) + e.addPct * rank;
    } else if (node.type === "economy") {
      if (e.capacityPct) mods.capacityPct += e.capacityPct * rank;
      if (e.dpKillPct) mods.dpKillPct += e.dpKillPct * rank;
      if (e.unitCostPct) mods.unitCostPct += e.unitCostPct * rank;
      if (e.digCostPct) mods.digCostPct += e.digCostPct * rank;
    }
  }
  return mods;
}

const ROLE_DMG_GROUP: Record<UnitRole, "meleeAll" | "rangedAll" | "casterAll"> = {
  swarm: "meleeAll", melee: "meleeAll", bruiser: "meleeAll", tank: "meleeAll",
  colossus: "meleeAll", capstone: "meleeAll", hybrid: "meleeAll",
  ranged: "rangedAll", caster: "casterAll", summoner: "casterAll",
  control: "casterAll", utility: "casterAll",
};

function applyResearchToStats(
  base: ResolvedStats, family: Family, role: UnitRole, mods: ResearchMods,
): ResolvedStats {
  const out = { ...base };
  const fam = mods.family[family];
  if (fam) for (const [k, pct] of Object.entries(fam)) {
    const key2 = k as keyof StatBlock;
    (out[key2] as number) = (out[key2] as number) * (1 + (pct as number));
  }
  const group = ROLE_DMG_GROUP[role];
  const cross = mods.cross[group];
  if (cross) for (const [k, pct] of Object.entries(cross)) {
    const key2 = k as keyof StatBlock;
    (out[key2] as number) = (out[key2] as number) * (1 + (pct as number));
  }
  return out;
}

function applyGear(stats: ResolvedStats, items: GearItem[], affinities: Affinities): ResolvedStats {
  const out = { ...stats };
  for (const item of items) {
    for (const [k, v] of Object.entries(item.mods)) {
      const key2 = k as keyof StatBlock;
      let val = v as number;
      // Weapon main attack bonus scales with wielder affinity (docs/07 §1)
      if (item.slot === "weapon" && item.affinityTypeForScaling && (k === "phys" || k === "mag" || k === "rng")) {
        const a = affinities[item.affinityTypeForScaling] ?? 1;
        val = val * a;
      }
      (out[key2] as number) = (out[key2] as number) + val;
    }
    for (const af of item.affixes) {
      (out[af.stat] as number) = (out[af.stat] as number) + af.value;
    }
  }
  return out;
}

function primaryDamageType(phys: number, mag: number, rng: number, fallback: AffinityType): AffinityType {
  const m = Math.max(phys, mag, rng);
  if (m === mag && mag > 0) return "arcane";
  if (m === rng && rng > 0) return "ranged";
  if (m === phys && phys > 0) return "melee";
  return fallback;
}

let entityCounter = 0;
function eid(prefix: string): string { return `${prefix}_${entityCounter++}`; }

export function gearItemsFor(run: RunState, instanceIds: (string | undefined)[]): GearItem[] {
  const out: GearItem[] = [];
  for (const id of instanceIds) {
    if (!id) continue;
    const item = run.inventory.find((g) => g.id === id);
    if (item) out.push(item);
  }
  return out;
}

/** Build dungeon-side entities from a run's placed units. */
export function buildDungeonEntities(run: RunState, mods: ResearchMods): SimEntity[] {
  const out: SimEntity[] = [];
  for (const pu of run.units) {
    const def = UNIT_BY_ID[pu.defId];
    if (!def) continue;
    let stats = resolveStats(def.stats);
    stats = applyResearchToStats(stats, def.family, def.role, mods);
    const gear = gearItemsFor(run, [pu.gear.weapon, pu.gear.armor, ...(pu.gear.accessory ?? [])]);
    stats = applyGear(stats, gear, def.affinities);
    const dmgKind = UNIT_DMG[pu.defId] ?? "melee";
    const pdt: AffinityType = dmgKind === "ranged" ? "ranged" : dmgKind === "arcane" ? "arcane" : "melee";
    out.push(makeEntity({
      id: pu.id, side: "dungeon", defId: pu.defId, name: def.name, family: def.family,
      tier: def.tier, stats, affinities: def.affinities, abilities: def.abilities ?? [],
      x: pu.x, y: pu.y, isTurret: pu.isTurret || def.role === "tank" && def.turretCapable && pu.isTurret,
      primaryDamageType: pdt,
    }));
  }
  return out;
}

/** Build invader entities from a wave def, spawning at the entrance. */
export function buildInvaderEntities(wave: WaveDef, entrance: { x: number; y: number }): SimEntity[] {
  const out: SimEntity[] = [];
  wave.invaders.forEach((inv, i) => {
    const cls = CLASS_BY_ID[inv.classId];
    if (!cls) return;
    const stats = resolveStats(cls.stats);
    if (inv.statMult !== 1) {
      stats.hp = Math.round(stats.hp * inv.statMult);
      stats.phys = Math.round(stats.phys * inv.statMult);
      stats.mag = Math.round(stats.mag * inv.statMult);
      stats.rng = Math.round(stats.rng * inv.statMult);
      stats.def = Math.round(stats.def * inv.statMult);
    }
    const pdt = primaryDamageType(stats.phys, stats.mag, stats.rng, cls.archetype === "mage" ? "arcane" : cls.archetype === "archer" ? "ranged" : "melee");
    // jitter spawn around entrance deterministically
    const angle = (i * 2.39996); // golden angle
    const r = 0.2 + (i % 5) * 0.12;
    out.push(makeEntity({
      id: inv.id, side: "invader", defId: inv.classId, name: cls.name, archetype: cls.archetype,
      tier: inv.tier, stats, affinities: cls.affinities, abilities: cls.abilities ?? [],
      x: entrance.x + Math.cos(angle) * r, y: entrance.y + Math.sin(angle) * r,
      isUnique: inv.isUnique, revealRadius: cls.revealRadius ?? 0, primaryDamageType: pdt,
    }));
  });
  return out;
}

function makeEntity(p: {
  id: string; side: "dungeon" | "invader"; defId: string; name: string;
  family?: Family; archetype?: SimEntity["archetype"]; tier: Tier;
  stats: ResolvedStats; affinities: Affinities; abilities: Ability[];
  x: number; y: number; isTurret?: boolean; isUnique?: boolean; revealRadius?: number;
  primaryDamageType: AffinityType;
}): SimEntity {
  return {
    id: p.id || eid(p.side), side: p.side, defId: p.defId, name: p.name,
    family: p.family, archetype: p.archetype, tier: p.tier, isUnique: p.isUnique,
    isTurret: p.isTurret, x: p.x, y: p.y, homeX: Math.round(p.x), homeY: Math.round(p.y),
    hp: Math.round(p.stats.hp), maxHp: Math.round(p.stats.hp), shield: 0,
    stats: p.stats, affinities: p.affinities, abilities: p.abilities,
    primaryDamageType: p.primaryDamageType, state: "idle", attackCdTicks: 0,
    statuses: [], revealRadius: p.revealRadius ?? 0, threatValue: p.stats.threat,
  };
}

export { key };

// ============================================================================
// Adventurer classes + uniques (docs/09). Mainline T1-T10 for each archetype
// (full coverage) + key branch classes. Stats generated -> tierOf()==tier.
// ============================================================================
import type { ClassDef, UniqueDef, Tier, Archetype, Ability } from "../types";
import { buildStats } from "./templates";
import type { GenRole, DmgKind } from "./templates";
import { ab, aff } from "./abilities";

const MAINLINE: Record<Archetype, string[]> = {
  warrior: ["Militia", "Soldier", "Knight", "Crusader", "Templar", "Myrmidon", "Warlord", "Champion", "Paladin-Lord", "Godsworn"],
  archer: ["Slinger", "Bowman", "Ranger", "Hunter", "Marksman", "Arbalest", "Sharpshooter", "Master Archer", "Storm Archer", "Windlord"],
  mage: ["Apprentice", "Adept", "Mage", "Conjurer", "Sorcerer", "Elementalist", "Archmage", "Magister", "Magus-Lord", "Worldcaster"],
  rogue: ["Cutpurse", "Thief", "Rogue", "Prowler", "Assassin", "Trickster", "Shadowblade", "Nightstalker", "Nightlord", "Voidblade"],
};

const ARCH_GEN: Record<Archetype, GenRole> = {
  warrior: "bruiser", archer: "ranged", mage: "caster", rogue: "rogue",
};
const ARCH_DMG: Record<Archetype, DmgKind> = {
  warrior: "melee", archer: "ranged", mage: "arcane", rogue: "melee",
};

function archAffinities(a: Archetype) {
  switch (a) {
    case "warrior": return aff("A", "C", "E");
    case "archer": return aff("D", "A");
    case "mage": return aff("F", "E", "A");
    case "rogue": return aff("B", "C", "E", { shadow: "B" });
  }
}

function classAbilities(a: Archetype, tier: Tier): Ability[] {
  const out: Ability[] = [];
  if (a === "warrior") {
    if (tier >= 5) out.push(ab("partyBuff", "passive", { phys: 0.08 }, 4));
    if (tier >= 6) out.push(ab("berserk", "passive"));
  }
  if (a === "archer") {
    if (tier >= 5) out.push(ab("firstStrike", "passive"));
    if (tier >= 6) out.push(ab("longRange", "passive", { range: 2 }));
  }
  if (a === "mage") {
    if (tier >= 3) out.push(ab("splash", "onHit"));
    if (tier >= 6) out.push(ab("bigAoe", "passive"));
  }
  if (a === "rogue") {
    if (tier >= 4) out.push(ab("firstStrike", "passive"));
    if (tier >= 7) out.push(ab("invis", "passive", { stealth: 0.4 }));
  }
  return out;
}

const list: ClassDef[] = [];

for (const a of Object.keys(MAINLINE) as Archetype[]) {
  MAINLINE[a].forEach((name, i) => {
    const tier = (i + 1) as Tier;
    list.push({
      id: `adv_${a}_t${tier}`,
      name,
      archetype: a,
      tier,
      branch: false,
      stats: buildStats(tier, ARCH_GEN[a], ARCH_DMG[a]),
      affinities: archAffinities(a),
      abilities: classAbilities(a, tier),
      revealRadius: a === "rogue" ? 2 + Math.floor(tier / 2) : undefined,
    });
  });
}

// --- Key branch classes (distinct gameplay roles) ---
const branches: ClassDef[] = [
  {
    id: "adv_w_berserker", name: "Berserker", archetype: "warrior", tier: 4, branch: true,
    stats: buildStats(4, "skirmisher", "melee"), affinities: aff("A"),
    abilities: [ab("executeLowHp", "onHit"), ab("berserk", "passive"), ab("dash")],
  },
  {
    id: "adv_w_guardian", name: "Guardian", archetype: "warrior", tier: 6, branch: true,
    stats: buildStats(6, "tank", "melee"), affinities: aff("B"),
    abilities: [ab("partyBuff", "passive", { def: 0.1 }, 4)],
  },
  {
    id: "adv_a_beastmaster", name: "Beastmaster", archetype: "archer", tier: 4, branch: true,
    stats: buildStats(4, "ranged", "ranged"), affinities: aff("C", "A", undefined, { nature: "B" }),
    abilities: [ab("petSummon", "onWaveStart", { count: 1 })],
  },
  {
    id: "adv_m_cleric", name: "Cleric", archetype: "mage", tier: 4, branch: true,
    stats: buildStats(4, "caster", "arcane"), affinities: aff("E", undefined, "B", { holy: "A" }),
    abilities: [ab("healAlly", "periodic", { amount: 0.12, intervalTicks: 12 }, 5)],
  },
  {
    id: "adv_m_elementalist", name: "Elementalist", archetype: "mage", tier: 6, branch: true,
    stats: buildStats(6, "caster", "arcane"), affinities: aff(undefined, undefined, "A", { fire: "A", frost: "A" }),
    abilities: [ab("splash", "onHit"), ab("bigAoe", "passive"), ab("burnOnHit", "onHit", { dps: 18, dur: 30 }), ab("freezeOnHit", "onHit", { dur: 10 })],
  },
  {
    id: "adv_r_scout", name: "Scout", archetype: "rogue", tier: 4, branch: true,
    stats: buildStats(4, "rogue", "melee"), affinities: aff("B"),
    abilities: [], revealRadius: 5,
  },
  {
    id: "adv_r_trickster", name: "Trickster", archetype: "rogue", tier: 6, branch: true,
    stats: buildStats(6, "rogue", "melee"), affinities: aff("B", undefined, undefined, { shadow: "A" }),
    abilities: [ab("confuse", "onHit")], revealRadius: 4,
  },
];

export const CLASSES: ClassDef[] = [...list, ...branches];
export const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c]),
);

/** Classes grouped by archetype, for wavegen. */
export const CLASSES_BY_ARCHETYPE: Record<Archetype, ClassDef[]> = {
  warrior: [], archer: [], mage: [], rogue: [],
};
for (const c of CLASSES) CLASSES_BY_ARCHETYPE[c.archetype].push(c);

/** Pick the class for an archetype closest to a desired tier (incl. branches). */
export function classForTier(arch: Archetype, tier: Tier): ClassDef {
  const pool = CLASSES_BY_ARCHETYPE[arch].filter((c) => !c.branch);
  let best = pool[0];
  let bestDiff = Infinity;
  for (const c of pool) {
    const d = Math.abs(c.tier - tier);
    if (d < bestDiff) { bestDiff = d; best = c; }
  }
  return best;
}

// --- Named uniques (docs/09 §4, 19 §5) ---
export const UNIQUES: UniqueDef[] = [
  { id: "uniq_aldric", name: "Sir Aldric the Bold", baseClassId: "adv_warrior_t3", flavor: "Lion’s Rally strengthens nearby adventurers’ melee attacks.",
    signature: [ab("auraBuff", "onWaveStart", { phys: 0.14 }, 5)] },
  { id: "uniq_iron_warden", name: "The Iron Warden", baseClassId: "adv_w_guardian", flavor: "Iron Bulwark grants a shield on arrival.",
    signature: [ab("shieldOnWaveStart", "onWaveStart", { pct: 0.28 })] },
  { id: "uniq_lyra", name: "Lyra Quickbow", baseClassId: "adv_archer_t5", flavor: "Split Volley catches defenders near the arrow’s target.",
    signature: [ab("splash", "onHit", { pct: 0.34 }, 1.6)] },
  { id: "uniq_veylin", name: "Magister Veylin", baseClassId: "adv_mage_t7", flavor: "Starfire leaves the target burning.",
    signature: [ab("burnOnHit", "onHit", { dps: 17, dur: 30 })] },
  { id: "uniq_cassian", name: "Brother Cassian", baseClassId: "adv_m_cleric", flavor: "Pilgrim’s Mercy heals the most wounded ally in range.",
    signature: [ab("healAlly", "periodic", { amount: 0.17, intervalTicks: 14 }, 5)] },
  { id: "uniq_vex", name: "Vex the Unseen", baseClassId: "adv_rogue_t7", flavor: "Shadow Sweep reveals traps from farther away.",
    signature: [ab("invis", "passive", { stealth: 0.48 })], revealRadius: 8 },
  { id: "uniq_grimjaw", name: "Grimjaw", baseClassId: "adv_w_berserker", flavor: "Headsman’s Chop deals extra damage to badly wounded targets.",
    signature: [ab("executeLowHp", "onHit", { mult: 1.8 })] },
  { id: "uniq_morwenna", name: "Sister Morwenna", baseClassId: "adv_mage_t5", flavor: "Moonbreak sweeps a wide area around its target.",
    signature: [ab("splash", "onHit", { pct: 0.55 }, 2.7)] },
  { id: "uniq_roderic", name: "Captain Roderic", baseClassId: "adv_warrior_t7", flavor: "Raise the Standard quickens nearby allies’ attacks.",
    signature: [ab("partyBuff", "onWaveStart", { atkSpeed: 0.14 }, 6)] },
  { id: "uniq_nightingale", name: "Nightingale", baseClassId: "adv_rogue_t5", flavor: "Silent Opening deals a heavy first strike.",
    signature: [ab("firstStrike", "passive", { mult: 2 })] },
];

export const UNIQUE_BY_ID = Object.fromEntries(UNIQUES.map((hero) => [hero.id, hero]));

export function championAbilities(hero: UniqueDef, base = CLASS_BY_ID[hero.baseClassId]?.abilities ?? []): Ability[] {
  return [...base.filter((ability) => !hero.signature.some((signature) => signature.effect === ability.effect)), ...hero.signature];
}

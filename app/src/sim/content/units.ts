// ============================================================================
// Unit roster (docs/05). Stats generated via buildStats so tierOf()==tier.
// ============================================================================
import type { UnitDef, Tier, Family, UnitRole, Affinities, Ability } from "../types";
import { buildStats } from "./templates";
import type { GenRole, DmgKind } from "./templates";
import { ab, aff } from "./abilities";

interface UEntry {
  id: string; name: string; family: Family; tier: Tier; role: UnitRole;
  gen: GenRole; dmg: DmgKind; affinities: Affinities; abilities?: Ability[];
  turret?: boolean; notes?: string;
}

const E: UEntry[] = [
  // --- Goblinoid ---
  { id: "gob_grunt", name: "Goblin Grunt", family: "goblinoid", tier: 1, role: "swarm", gen: "swarm", dmg: "melee", affinities: aff("B", "D", "F") },
  { id: "gob_archer", name: "Goblin Slinger", family: "goblinoid", tier: 1, role: "ranged", gen: "spammer", dmg: "ranged", affinities: aff("D", "B") },
  { id: "gob_cutter", name: "Goblin Cutthroat", family: "goblinoid", tier: 2, role: "melee", gen: "bruiser", dmg: "melee", affinities: aff("A", "D") },
  { id: "orc_warrior", name: "Orc Warrior", family: "goblinoid", tier: 3, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A"), abilities: [ab("berserk", "passive")] },
  { id: "orc_shaman", name: "Orc Shaman", family: "goblinoid", tier: 3, role: "caster", gen: "caster", dmg: "arcane", affinities: aff("D", undefined, "B", { nature: "B" }), abilities: [ab("auraBuff", "passive", { phys: 0.1 }, 3)] },
  { id: "gob_ogre", name: "Ogre", family: "goblinoid", tier: 4, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A"), abilities: [ab("cleave", "onHit")] },
  { id: "orc_warlord", name: "Orc Warlord", family: "goblinoid", tier: 5, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("S"), abilities: [ab("partyBuff", "passive", { atkSpeed: 0.1 }, 4)] },
  { id: "gob_troll", name: "War Troll", family: "goblinoid", tier: 6, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { nature: "B" }), abilities: [ab("executeLowHp", "onHit"), ab("healAtHalf", "passive", { pct: 0.35 })] },
  { id: "gob_battlemother", name: "Goblin Battle-Matron", family: "goblinoid", tier: 7, role: "summoner", gen: "summoner", dmg: "melee", affinities: aff("S"), abilities: [ab("summon", "onWaveStart", { count: 2 }), ab("partyBuff", "passive", { phys: 0.1 }, 4)] },
  { id: "gob_warbringer", name: "Ogre Warbringer", family: "goblinoid", tier: 8, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("S"), abilities: [ab("cleave", "onHit"), ab("splash", "onHit")] },
  { id: "gob_titan", name: "Mountain Troll-Titan", family: "goblinoid", tier: 9, role: "colossus", gen: "colossus", dmg: "melee", affinities: aff("S", undefined, undefined, { nature: "A" }), abilities: [ab("executeLowHp", "onHit")] },
  { id: "gob_godslayer", name: "Gruumsh's Chosen", family: "goblinoid", tier: 10, role: "capstone", gen: "colossus", dmg: "melee", affinities: aff("S"), abilities: [ab("firstStrike", "passive"), ab("cleave", "onHit"), ab("partyBuff", "passive", { phys: 0.15 }, 6)] },

  // --- Undead ---
  { id: "und_skeleton", name: "Skeleton", family: "undead", tier: 1, role: "swarm", gen: "swarm", dmg: "melee", affinities: aff("B", undefined, "E", { shadow: "C" }) },
  { id: "und_skel_archer", name: "Skeleton Archer", family: "undead", tier: 2, role: "ranged", gen: "ranged", dmg: "ranged", affinities: aff("E", "A") },
  { id: "und_ghoul", name: "Ghoul", family: "undead", tier: 3, role: "melee", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { shadow: "B" }), abilities: [ab("bleedOnHit", "onHit", { dps: 7 })] },
  { id: "und_necromancer", name: "Necromancer", family: "undead", tier: 4, role: "summoner", gen: "summoner", dmg: "arcane", affinities: aff("F", undefined, "A", { shadow: "A" }), abilities: [ab("summon", "onWaveStart", { count: 2 })] },
  { id: "und_wight", name: "Wight", family: "undead", tier: 5, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "A", { shadow: "A" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.3 })] },
  { id: "und_wraith", name: "Wraith", family: "undead", tier: 5, role: "caster", gen: "caster", dmg: "arcane", affinities: aff("F", undefined, "A", { shadow: "S" }), abilities: [ab("invis", "passive", { stealth: 0.4 })] },
  { id: "und_bonegolem", name: "Bone Colossus", family: "undead", tier: 6, role: "tank", gen: "tank", dmg: "melee", affinities: aff("B") },
  { id: "und_lich", name: "Lich", family: "undead", tier: 7, role: "caster", gen: "caster", dmg: "arcane", affinities: aff("F", "E", "S", { shadow: "A" }), abilities: [ab("splash", "onHit"), ab("reviveSelf", "onWaveStart")] },
  { id: "und_deathknight", name: "Death Knight", family: "undead", tier: 8, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("S", undefined, undefined, { shadow: "A" }), abilities: [ab("fear", "passive", {}, 3)] },
  { id: "und_archlich", name: "Archlich", family: "undead", tier: 9, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S", { shadow: "S" }), abilities: [ab("splash", "onHit"), ab("bigAoe", "passive")] },
  { id: "und_deathlord", name: "The Deathlord", family: "undead", tier: 10, role: "capstone", gen: "caster", dmg: "arcane", affinities: aff("D", undefined, "S", { shadow: "S" }), abilities: [ab("splash", "onHit"), ab("partyBuff", "passive", { mag: 0.15 }, 6)] },

  // --- Beast ---
  { id: "bst_direwolf", name: "Dire Wolf", family: "beast", tier: 1, role: "melee", gen: "skirmisher", dmg: "melee", affinities: aff("B", undefined, undefined, { nature: "B" }), abilities: [ab("dash"), ab("bleedOnHit", "onHit", { dps: 4 })] },
  { id: "bst_giantspider", name: "Giant Spider", family: "beast", tier: 2, role: "melee", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { nature: "B" }), abilities: [ab("poisonDot", "onHit", { dps: 5 }), ab("slowOnHit", "onHit", { pct: 0.2 })] },
  { id: "bst_harpy", name: "Harpy", family: "beast", tier: 3, role: "ranged", gen: "spammer", dmg: "ranged", affinities: aff(undefined, "A", undefined, { nature: "B" }), abilities: [ab("longRange", "passive", { range: 2 })] },
  { id: "bst_basilisk", name: "Basilisk", family: "beast", tier: 4, role: "melee", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { nature: "A" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.4 })] },
  { id: "bst_manticore", name: "Manticore", family: "beast", tier: 5, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A", "A", undefined, { nature: "A" }), abilities: [ab("berserk", "passive")] },
  { id: "bst_wyvern", name: "Wyvern", family: "beast", tier: 6, role: "melee", gen: "skirmisher", dmg: "melee", affinities: aff("A", undefined, undefined, { nature: "A", fire: "B" }), abilities: [ab("firstStrike", "passive"), ab("dash"), ab("burnOnHit", "onHit", { dps: 18, dur: 30 })] },
  { id: "bst_chimera", name: "Chimera", family: "beast", tier: 7, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("S", undefined, undefined, { fire: "A", nature: "A" }), abilities: [ab("cleave", "onHit"), ab("splash", "onHit")] },
  { id: "bst_behemoth", name: "Behemoth", family: "beast", tier: 8, role: "colossus", gen: "colossus", dmg: "melee", affinities: aff("S", undefined, undefined, { nature: "A" }), abilities: [ab("splash", "onHit"), ab("healAtHalf", "passive", { pct: 0.3 })] },
  { id: "bst_rocdragon", name: "Roc", family: "beast", tier: 9, role: "colossus", gen: "colossus", dmg: "melee", affinities: aff("S", "A", undefined, { nature: "A" }) },
  { id: "bst_worldserpent", name: "World Serpent", family: "beast", tier: 10, role: "capstone", gen: "colossus", dmg: "melee", affinities: aff("S", undefined, undefined, { nature: "S", frost: "A" }), abilities: [ab("executeLowHp", "onHit"), ab("splash", "onHit"), ab("freezeOnHit", "onHit", { dur: 12 })] },

  // --- Demon ---
  { id: "dem_imp", name: "Imp", family: "demon", tier: 1, role: "caster", gen: "caster", dmg: "arcane", affinities: aff("E", undefined, "B", { fire: "B" }), abilities: [ab("explodeOnDeath", "passive", { pct: 0.5 }, 2), ab("burnOnHit", "onHit", { dps: 4 })] },
  { id: "dem_hellhound", name: "Hellhound", family: "demon", tier: 2, role: "melee", gen: "skirmisher", dmg: "melee", affinities: aff("A", undefined, undefined, { fire: "B" }), abilities: [ab("dash"), ab("burnOnHit", "onHit", { dps: 6, dur: 30 })] },
  { id: "dem_cambion", name: "Cambion", family: "demon", tier: 3, role: "hybrid", gen: "caster", dmg: "arcane", affinities: aff("B", undefined, "A", { fire: "B" }) },
  { id: "dem_succubus", name: "Succubus", family: "demon", tier: 4, role: "control", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "A", { shadow: "A" }), abilities: [ab("fear", "passive", {}, 3), ab("healAlly", "onHit")] },
  { id: "dem_barbed", name: "Barbed Devil", family: "demon", tier: 5, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { fire: "A" }), abilities: [ab("thorns", "onTakeDamage", { pct: 0.25 })] },
  { id: "dem_infernal", name: "Infernal", family: "demon", tier: 6, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("A", undefined, undefined, { fire: "S" }), abilities: [ab("splash", "onHit"), ab("bigAoe", "passive"), ab("burnOnHit", "onHit", { dps: 20, dur: 30 })] },
  { id: "dem_pitfiend", name: "Pit Fiend", family: "demon", tier: 7, role: "hybrid", gen: "bruiser", dmg: "melee", affinities: aff("S", undefined, "A", { fire: "S" }), abilities: [ab("summon", "onWaveStart", { count: 2 }), ab("fear", "passive", {}, 3)] },
  { id: "dem_balor", name: "Balor", family: "demon", tier: 8, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("S", undefined, undefined, { fire: "S" }), abilities: [ab("splash", "onHit"), ab("firstStrike", "passive")] },
  { id: "dem_archdevil", name: "Arch-Devil", family: "demon", tier: 9, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S", { fire: "S", shadow: "A" }), abilities: [ab("splash", "onHit"), ab("bigAoe", "passive"), ab("burnOnHit", "onHit", { dps: 40, dur: 30 }), ab("partyBuff", "passive", { mag: 0.12 }, 5)] },
  { id: "dem_demonprince", name: "Demon Prince", family: "demon", tier: 10, role: "capstone", gen: "bruiser", dmg: "arcane", affinities: aff("S", undefined, "S", { fire: "S" }), abilities: [ab("splash", "onHit"), ab("summon", "onWaveStart", { count: 3 }), ab("fear", "passive", {}, 4)] },

  // --- Construct ---
  { id: "con_animarmor", name: "Animated Armor", family: "construct", tier: 1, role: "bruiser", gen: "bruiser", dmg: "melee", affinities: aff("B") },
  { id: "con_sentry", name: "Clockwork Sentry", family: "construct", tier: 2, role: "ranged", gen: "ranged", dmg: "ranged", affinities: aff(undefined, "B"), turret: true },
  { id: "con_ironguard", name: "Iron Guardian", family: "construct", tier: 3, role: "tank", gen: "tank", dmg: "melee", affinities: aff("C") },
  { id: "con_ballista", name: "Siege Ballista", family: "construct", tier: 4, role: "ranged", gen: "ranged", dmg: "ranged", affinities: aff(undefined, "A"), turret: true },
  { id: "con_stonegolem", name: "Stone Golem", family: "construct", tier: 5, role: "tank", gen: "tank", dmg: "melee", affinities: aff("C", undefined, undefined, { nature: "C" }) },
  { id: "con_arcaneturret", name: "Arcane Turret", family: "construct", tier: 6, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "A"), abilities: [ab("splash", "onHit")], turret: true },
  { id: "con_irongolem", name: "Iron Golem", family: "construct", tier: 6, role: "tank", gen: "tank", dmg: "melee", affinities: aff("B") },
  { id: "con_colossus", name: "War Colossus", family: "construct", tier: 7, role: "tank", gen: "colossus", dmg: "melee", affinities: aff("A"), abilities: [ab("cleave", "onHit")] },
  { id: "con_sentinel", name: "Adamant Sentinel", family: "construct", tier: 8, role: "tank", gen: "tank", dmg: "melee", affinities: aff("A", "B"), abilities: [ab("thorns", "onTakeDamage", { pct: 0.2 })], turret: true },
  { id: "con_titanforge", name: "Titanforge Golem", family: "construct", tier: 9, role: "colossus", gen: "colossus", dmg: "melee", affinities: aff("A"), abilities: [ab("splash", "onHit")] },
  { id: "con_worldengine", name: "World Engine", family: "construct", tier: 10, role: "capstone", gen: "colossus", dmg: "melee", affinities: aff("S", "A", "A"), abilities: [ab("partyBuff", "passive", { def: 0.15 }, 6), ab("splash", "onHit")], turret: true },

  // --- Aberration ---
  { id: "abr_ooze", name: "Gray Ooze", family: "aberration", tier: 1, role: "melee", gen: "bruiser", dmg: "melee", affinities: aff("B", undefined, undefined, { nature: "C" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.25 })] },
  { id: "abr_gazer", name: "Lesser Gazer", family: "aberration", tier: 2, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "B") },
  { id: "abr_mindling", name: "Mind-Eater Spawn", family: "aberration", tier: 3, role: "control", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "A", { shadow: "B" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.3 })] },
  { id: "abr_chokethorn", name: "Chokethorn", family: "aberration", tier: 4, role: "control", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "B", { nature: "A" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.4 }), ab("splash", "onHit")] },
  { id: "abr_beholder", name: "Beholder", family: "aberration", tier: 5, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S"), abilities: [ab("splash", "onHit"), ab("bigAoe", "passive")] },
  { id: "abr_hivemind", name: "Hive Mind", family: "aberration", tier: 6, role: "summoner", gen: "summoner", dmg: "arcane", affinities: aff(undefined, undefined, "A", { shadow: "A" }), abilities: [ab("summon", "onWaveStart", { count: 2 }), ab("confuse", "onHit")] },
  { id: "abr_mindflayer", name: "Mind Flayer", family: "aberration", tier: 7, role: "control", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S", { shadow: "A" }), abilities: [ab("slowOnHit", "onHit", { pct: 0.5 }), ab("fear", "passive", {}, 3)] },
  { id: "abr_nightgaunt", name: "Star-Spawn", family: "aberration", tier: 8, role: "caster", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S", { shadow: "S" }), abilities: [ab("splash", "onHit")] },
  { id: "abr_elderbrain", name: "Elder Brain", family: "aberration", tier: 9, role: "control", gen: "caster", dmg: "arcane", affinities: aff(undefined, undefined, "S", { shadow: "S" }), abilities: [ab("confuse", "onHit"), ab("slowOnHit", "onHit", { pct: 0.4 })] },
  { id: "abr_outergod", name: "Spawn of the Outer Dark", family: "aberration", tier: 10, role: "capstone", gen: "caster", dmg: "arcane", affinities: aff("D", undefined, "S", { shadow: "S", frost: "A" }), abilities: [ab("splash", "onHit"), ab("bigAoe", "passive"), ab("confuse", "onHit"), ab("freezeOnHit", "onHit", { dur: 14 }), ab("partyBuff", "passive", { mag: 0.12 }, 6)] },
];

export const UNITS: UnitDef[] = E.map((e) => ({
  id: e.id,
  name: e.name,
  family: e.family,
  tier: e.tier,
  role: e.role,
  stats: buildStats(e.tier, e.gen, e.dmg),
  affinities: e.affinities,
  abilities: e.abilities ?? [],
  turretCapable: e.turret,
  notes: e.notes,
}));

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(
  UNITS.map((u) => [u.id, u]),
);

// expose dmg kind for entity primary damage type resolution
export const UNIT_DMG: Record<string, DmgKind> = Object.fromEntries(
  E.map((e) => [e.id, e.dmg]),
);

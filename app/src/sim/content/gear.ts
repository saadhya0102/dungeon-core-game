// ============================================================================
// Gear catalog + procedural generator (docs/07, 19 §8).
// ============================================================================
import type {
  GearItem, GearSlot, WeaponType, ArmorType, AccessoryType, Quality, Tier,
  AffinityType, Affix, StatBlock,
} from "../types";
import { CONFIG, tierBudget } from "../config";
import type { PRNG } from "../rng";

interface WeaponInfo { type: WeaponType; stat: "phys" | "rng" | "mag"; affinity: AffinityType; }
export const WEAPONS: WeaponInfo[] = [
  { type: "sword", stat: "phys", affinity: "melee" },
  { type: "axe", stat: "phys", affinity: "melee" },
  { type: "mace", stat: "phys", affinity: "melee" },
  { type: "spear", stat: "phys", affinity: "melee" },
  { type: "dagger", stat: "phys", affinity: "melee" },
  { type: "bow", stat: "rng", affinity: "ranged" },
  { type: "crossbow", stat: "rng", affinity: "ranged" },
  { type: "staff", stat: "mag", affinity: "arcane" },
  { type: "wand", stat: "mag", affinity: "arcane" },
  { type: "orb", stat: "mag", affinity: "arcane" },
  { type: "tome", stat: "mag", affinity: "arcane" },
];

export const ARMORS: ArmorType[] = ["light", "medium", "heavy", "robe", "shield"];
export const ACCESSORIES: AccessoryType[] = ["ring", "amulet", "charm", "banner"];

const QUALITIES: Quality[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const QUALITY_WEIGHTS = [50, 28, 14, 6, 1.6, 0.4];
const QUALITY_WEIGHTS_UNIQUE = [10, 22, 30, 24, 10, 4];

interface AffixTemplate { id: string; stat: keyof StatBlock; perTier: number; pct?: boolean; }
const AFFIX_POOL: AffixTemplate[] = [
  { id: "af_crit", stat: "crit", perTier: 0.02, pct: true },
  { id: "af_atkspd", stat: "atkSpeed", perTier: 0.03, pct: true },
  { id: "af_acc", stat: "acc", perTier: 0.03, pct: true },
  { id: "af_detection", stat: "detection", perTier: 8 },
  { id: "af_dodge", stat: "dodge", perTier: 0.02, pct: true },
  { id: "af_block", stat: "block", perTier: 0.02, pct: true },
  { id: "af_lifesteal", stat: "lifesteal", perTier: 0.02, pct: true },
  { id: "af_armorpen", stat: "armorPen", perTier: 4 },
  { id: "af_magpen", stat: "magPen", perTier: 4 },
  { id: "af_hp", stat: "hp", perTier: 40 },
  { id: "af_def", stat: "def", perTier: 5 },
  { id: "af_mres", stat: "mres", perTier: 5 },
  { id: "af_range", stat: "range", perTier: 0.15 },
  { id: "af_movespeed", stat: "moveSpeed", perTier: 0.03, pct: true },
  { id: "af_threat", stat: "threat", perTier: 0.1 },
  { id: "af_regen", stat: "regen", perTier: 2 },
];

function qualityName(q: Quality): string {
  return q.charAt(0).toUpperCase() + q.slice(1);
}

let gearInstanceCounter = 0;
function newInstanceId(): string {
  return `gi_${Date.now().toString(36)}_${gearInstanceCounter++}`;
}

export function rollQuality(rng: PRNG, isUnique: boolean): Quality {
  return rng.weighted(QUALITIES, isUnique ? QUALITY_WEIGHTS_UNIQUE : QUALITY_WEIGHTS);
}

/** Generate a gear item. slotPref biases which slot; otherwise random. */
export function generateGear(
  rng: PRNG, tier: Tier, quality: Quality, slotPref?: GearSlot,
): GearItem {
  const slot: GearSlot = slotPref ?? rng.weighted<GearSlot>(
    ["weapon", "armor", "accessory"], [0.45, 0.35, 0.2],
  );
  const budget = tierBudget(tier);
  const mainMagnitude = Math.round((budget * 0.18) * (0.8 + rng.next() * 0.4));

  const mods: Partial<StatBlock> = {};
  let itemType: WeaponType | ArmorType | AccessoryType;
  let affinityTypeForScaling: AffinityType | undefined;
  let baseName = "";

  if (slot === "weapon") {
    const w = rng.pick(WEAPONS);
    itemType = w.type;
    affinityTypeForScaling = w.affinity;
    mods[w.stat] = mainMagnitude;
    baseName = w.type;
  } else if (slot === "armor") {
    const a = rng.pick(ARMORS);
    itemType = a;
    if (a === "robe") { mods.mres = Math.round(mainMagnitude * 0.4); mods.mag = Math.round(mainMagnitude * 0.3); }
    else if (a === "light") { mods.def = Math.round(mainMagnitude * 0.2); mods.dodge = 0.04 + tier * 0.005; mods.moveSpeed = 0.05; }
    else if (a === "heavy") { mods.def = Math.round(mainMagnitude * 0.5); mods.block = 0.06; }
    else if (a === "shield") { mods.block = 0.1; mods.def = Math.round(mainMagnitude * 0.3); mods.threat = 0.3; }
    else { mods.def = Math.round(mainMagnitude * 0.35); mods.mres = Math.round(mainMagnitude * 0.1); }
    baseName = a;
  } else {
    const ac = rng.pick(ACCESSORIES);
    itemType = ac;
    baseName = ac;
    // accessory base is light; affixes carry it
    mods.hp = Math.round(mainMagnitude * 0.3);
  }

  // Affixes
  const budgetCount = CONFIG.QUALITY_AFFIX_BUDGET[quality];
  const affixes: Affix[] = [];
  const used = new Set<string>();
  for (let i = 0; i < budgetCount; i++) {
    const tmpl = rng.pick(AFFIX_POOL);
    if (used.has(tmpl.id)) continue;
    used.add(tmpl.id);
    const raw = tmpl.perTier * tier * (0.8 + rng.next() * 0.5);
    const value = tmpl.pct ? Math.round(raw * 1000) / 1000 : Math.round(raw);
    affixes.push({ id: tmpl.id, stat: tmpl.stat, value });
  }

  const name = `${qualityName(quality)} ${capitalize(baseName)}`;
  return {
    id: newInstanceId(),
    defId: `gear_${slot}_${itemType}`,
    name,
    slot,
    itemType,
    tier,
    quality,
    mods,
    affinityTypeForScaling,
    affixes,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Roll whether a defeated adventurer drops, and what (docs/07 §3). */
export function rollDrop(rng: PRNG, advTier: Tier, isUnique: boolean): GearItem | null {
  const p = CONFIG.DROP_BASE + advTier * CONFIG.DROP_TIER_STEP + (isUnique ? CONFIG.DROP_UNIQUE_BONUS : 0);
  if (!rng.bool(Math.min(1, p))) return null;
  const tierDelta = rng.int(3) - 1; // -1..+1
  const dropTier = Math.max(1, Math.min(10, advTier + tierDelta)) as Tier;
  const quality = rollQuality(rng, isUnique);
  return generateGear(rng, dropTier, quality);
}

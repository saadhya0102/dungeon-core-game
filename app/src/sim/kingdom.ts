import { FAMILIES } from "./types";
import type { Family, RunState, UnitDef } from "./types";
import { coreLevelRow } from "./config";
import { createNewRun } from "./factory";
import { generateWave } from "./wavegen";

export const SWIFT_RULES = [
  ["standard", "Classic", "Build freely and survive as long as you can."],
  ["singleFaction", "Single faction", "Your first recruit sets your faction for the run."],
  ["oneRoom", "One room", "Start in a fixed 10 × 10 chamber."],
  ["weakened", "Weakened", "Defenders have 25% less health and attack."],
  ["noTanks", "No tanks", "Tank-class defenders are banned."],
  ["unitsOnly", "Units only", "Defend without traps or turrets."],
  ["noUnits", "Traps only", "Start with basic traps researched."],
] as const;
export type SwiftRule = typeof SWIFT_RULES[number][0] | `faction-${Family}`;
export const SWIFT_BOARDS: ReadonlyArray<readonly [SwiftRule, string, string]> = [
  ...SWIFT_RULES,
  ...FAMILIES.map((family) => [`faction-${family}`, family[0].toUpperCase() + family.slice(1), "Recruit exclusively from this faction."] as const),
];

export const CAMPAIGN = [
  { id: "mossgate", name: "Mossgate", waves: 2, offset: 0, core: 1, dp: 150, shards: 30, x: 13, y: 64 },
  { id: "pinewash", name: "Pinewash", waves: 2, offset: 2, core: 1, dp: 165, shards: 32, x: 25, y: 64 },
  { id: "drowned-arch", name: "Drowned Arch", waves: 3, offset: 4, core: 1, dp: 190, shards: 40, x: 36, y: 83 },
  { id: "fenwatch", name: "Fenwatch", waves: 3, offset: 5, core: 1, dp: 220, shards: 42, x: 43, y: 65 },
  { id: "cinder-crossing", name: "Cinder Crossing", waves: 4, offset: 6, core: 2, dp: 275, shards: 46, x: 27, y: 48 },
  { id: "ash-chapel", name: "Ash Chapel", waves: 4, offset: 7, core: 2, dp: 310, shards: 50, x: 23, y: 24 },
  { id: "watchers-rise", name: "Watcher’s Rise", waves: 5, offset: 9, core: 2, dp: 380, shards: 55, x: 42, y: 28 },
  { id: "stone-ford", name: "Stone Ford", waves: 5, offset: 10, core: 3, dp: 450, shards: 60, x: 53, y: 49 },
  { id: "highbridge", name: "Highbridge", waves: 5, offset: 11, core: 3, dp: 480, shards: 65, x: 65, y: 46 },
  { id: "east-span", name: "East Span", waves: 6, offset: 14, core: 3, dp: 585, shards: 72, x: 78, y: 42 },
  { id: "underkeep", name: "Underkeep", waves: 7, offset: 16, core: 4, dp: 720, shards: 85, x: 88, y: 63 },
  { id: "frost-citadel", name: "Frost Citadel", waves: 10, offset: 21, core: 5, dp: 1100, shards: 120, x: 89, y: 19 },
  { id: "slate-gate", name: "Slate Gate", waves: 7, offset: 24, core: 5, dp: 1450, shards: 105, x: 13, y: 79 },
  { id: "snowpine", name: "Snowpine", waves: 7, offset: 27, core: 6, dp: 1850, shards: 112, x: 33, y: 87 },
  { id: "blackglass", name: "Blackglass Quarry", waves: 8, offset: 30, core: 6, dp: 2200, shards: 120, x: 51, y: 77 },
  { id: "rimeharbor", name: "Rimeharbor", waves: 8, offset: 33, core: 7, dp: 2950, shards: 132, x: 84, y: 72 },
  { id: "hoarfrost-orchard", name: "Hoarfrost Orchard", waves: 9, offset: 36, core: 7, dp: 3650, shards: 144, x: 78, y: 54 },
  { id: "silent-belfry", name: "Silent Belfry", waves: 9, offset: 39, core: 8, dp: 4650, shards: 158, x: 64, y: 43 },
  { id: "stillwater-span", name: "Stillwater Span", waves: 10, offset: 42, core: 8, dp: 5800, shards: 172, x: 52, y: 53 },
  { id: "red-banner-keep", name: "Red Banner Keep", waves: 10, offset: 45, core: 9, dp: 7300, shards: 190, x: 23, y: 46 },
  { id: "lantern-peak", name: "Lantern Peak", waves: 11, offset: 48, core: 9, dp: 8900, shards: 215, x: 17, y: 21 },
  { id: "whiteway", name: "Whiteway", waves: 11, offset: 52, core: 10, dp: 11200, shards: 238, x: 49, y: 32 },
  { id: "shiver-spires", name: "Shiver Spires", waves: 12, offset: 56, core: 10, dp: 13900, shards: 260, x: 85, y: 23 },
  { id: "aurora-throne", name: "Aurora Throne", waves: 15, offset: 60, core: 11, dp: 17500, shards: 325, x: 60, y: 13 },
] as const;

export const CAMPAIGN_REGIONS = [
  { name: "The Borderlands", start: 0, end: 12 },
  { name: "The Frozen Frontier", start: 12, end: 24 },
] as const;
const ORIGINAL_CITY_IDS: readonly string[] = ["mossgate", "drowned-arch", "ash-chapel", "highbridge", "underkeep", "frost-citadel"];

export const BUILDINGS = [
  { id: "barracks", name: "Skullgate Barracks", effect: "+5% melee attack" },
  { id: "range", name: "Slinger Range", effect: "+5% ranged attack" },
  { id: "spire", name: "Hex Spire", effect: "+5% caster attack" },
  { id: "bastion", name: "Ironjaw Bastion", effect: "+5% tank health" },
  { id: "reliquary", name: "Core Reliquary", effect: "+2% health and attack for all monsters" },
  { id: "quarry", name: "Deepstone Quarry", effect: "−4% excavation and room cost" },
  ...FAMILIES.map((id) => ({
    id, name: { goblinoid: "Mushroom Warren", undead: "Ribcage Crypt", beast: "Fang Den", demon: "Ember Forge",
      construct: "Golem Workshop", aberration: "Shrine of the Eye" }[id], effect: "+4% faction health and attack",
  })),
] as const;

export type BuildingId = typeof BUILDINGS[number]["id"];
export type BuildingLevels = Partial<Record<BuildingId, number>>;
export const MAX_BUILDING_LEVEL = 5;
export const buildingCost = (level: number) => 20 + level * 15;

export interface Stronghold {
  shards: number;
  levels: BuildingLevels;
  cleared: string[];
}

export const emptyStronghold = (): Stronghold => ({ shards: 0, levels: {}, cleared: [] });

export function upgradeBuilding(base: Stronghold, id: BuildingId): Stronghold | null {
  const level = base.levels[id] ?? 0;
  const cost = buildingCost(level);
  if (!BUILDINGS.some((b) => b.id === id) || level >= MAX_BUILDING_LEVEL || base.shards < cost) return null;
  return { ...base, shards: base.shards - cost, levels: { ...base.levels, [id]: level + 1 } };
}

export function cityUnlocked(base: Stronghold, cityId: string): boolean {
  const index = CAMPAIGN.findIndex((city) => city.id === cityId);
  return index === 0 || (index > 0 && (base.cleared.includes(cityId) || base.cleared.includes(CAMPAIGN[index - 1].id)));
}

export function clearCity(base: Stronghold, cityId: string, continuedRun = false): Stronghold {
  const city = CAMPAIGN.find((entry) => entry.id === cityId);
  if (!city || (!continuedRun && !cityUnlocked(base, cityId)) || base.cleared.includes(cityId)) return base;
  return { ...base, cleared: [...base.cleared, cityId], shards: base.shards + city.shards };
}

export function createCampaignRun(uid: string, cityId: string, base: Stronghold): RunState | null {
  const city = CAMPAIGN.find((entry) => entry.id === cityId);
  if (!city || !cityUnlocked(base, cityId)) return null;
  const originalIndex = ORIGINAL_CITY_IDS.indexOf(city.id);
  const seed = originalIndex < 0 ? 7021 + CAMPAIGN.indexOf(city) * 171 : 3025 + originalIndex * 171;
  const run = createNewRun(uid, [], seed);
  const hp = coreLevelRow(city.core).coreHp;
  run.core = { level: city.core, hp, maxHp: hp, ward: 0, wardMax: 0 };
  run.dp = city.dp;
  run.cityId = cityId;
  run.buildings = { ...base.levels };
  return run;
}

export function waveForRun(run: RunState) {
  const city = CAMPAIGN.find((entry) => entry.id === run.cityId);
  return generateWave(run.wave + (city?.offset ?? 0), run.rngSeedRoot);
}

export function swiftFaction(run: RunState): Family | undefined {
  if (run.swiftRule === "singleFaction") return run.chosenFaction;
  return FAMILIES.find((family) => run.swiftRule === `faction-${family}`);
}

export function swiftAllowsUnit(run: RunState, def: UnitDef): boolean {
  const family = swiftFaction(run);
  return run.swiftRule !== "noUnits" && !(run.swiftRule === "noTanks" && def.role === "tank")
    && (!family || family === def.family);
}

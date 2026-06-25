// ============================================================================
// Achievement catalog (docs/13 §4.2). Each maps to a run/lifetime counter.
// ============================================================================
import type { AchievementDef } from "../types";

export const ACHIEVEMENTS: AchievementDef[] = [
  // Progression
  { id: "first_blood", name: "First Blood", desc: "Kill your first adventurer.", category: "progression", condition: { counter: "kills", gte: 1, scope: "lifetime" } },
  { id: "wave_10", name: "Getting Started", desc: "Reach wave 10.", category: "progression", condition: { counter: "bestWave", gte: 10, scope: "lifetime" } },
  { id: "wave_25", name: "Dungeon Master", desc: "Reach wave 25.", category: "progression", condition: { counter: "bestWave", gte: 25, scope: "lifetime" } },
  { id: "wave_50", name: "Unbreakable", desc: "Reach wave 50.", category: "progression", condition: { counter: "bestWave", gte: 50, scope: "lifetime" } },
  { id: "the_long_dark", name: "The Long Dark", desc: "Reach wave 75.", category: "progression", condition: { counter: "bestWave", gte: 75, scope: "lifetime" } },
  { id: "cl_5", name: "Growing Power", desc: "Reach Core Level 5.", category: "progression", condition: { counter: "coreLevel", gte: 5, scope: "run" } },
  { id: "cl_10", name: "Deep Core", desc: "Reach Core Level 10.", category: "progression", condition: { counter: "coreLevel", gte: 10, scope: "run" } },
  { id: "cl_20", name: "Apex Core", desc: "Reach Core Level 20.", category: "progression", condition: { counter: "coreLevel", gte: 20, scope: "run" } },

  // Combat
  { id: "trapmaster_b", name: "Trapmaster", desc: "Kill 50 adventurers with traps.", category: "combat", condition: { counter: "killsByTrap", gte: 50, scope: "lifetime" } },
  { id: "trapmaster_s", name: "Trap Engineer", desc: "Kill 250 adventurers with traps.", category: "combat", condition: { counter: "killsByTrap", gte: 250, scope: "lifetime" } },
  { id: "trapmaster_g", name: "Death by Design", desc: "Kill 1000 adventurers with traps.", category: "combat", condition: { counter: "killsByTrap", gte: 1000, scope: "lifetime" } },
  { id: "rogue_hunter", name: "Rogue Hunter", desc: "Kill 25 rogues.", category: "combat", condition: { counter: "roguesKilled", gte: 25, scope: "lifetime" } },
  { id: "horde_breaker", name: "Horde Breaker", desc: "Kill 20+ adventurers in a single wave.", category: "combat", condition: { counter: "biggestWaveKills", gte: 20, scope: "lifetime" } },
  { id: "flawless", name: "Flawless", desc: "Clear 10 waves without core damage.", category: "combat", condition: { counter: "flawlessWaves", gte: 10, scope: "lifetime" } },
  { id: "executioner", name: "Executioner", desc: "Kill 500 adventurers total.", category: "combat", condition: { counter: "kills", gte: 500, scope: "lifetime" } },
  { id: "slayer", name: "Slayer", desc: "Kill 2500 adventurers total.", category: "combat", condition: { counter: "kills", gte: 2500, scope: "lifetime" } },
  { id: "giant_slayer", name: "Giant Slayer", desc: "Kill 10 uniques.", category: "combat", condition: { counter: "uniquesKilled", gte: 10, scope: "lifetime" } },

  // Building
  { id: "architect", name: "Architect", desc: "Open 100 tiles in one run.", category: "building", condition: { counter: "tilesOpened", gte: 100, scope: "run" } },
  { id: "turret_command", name: "Turret Command", desc: "Field 5+ turrets at once.", category: "building", condition: { counter: "turretsActive", gte: 5, scope: "run" } },
  { id: "full_house", name: "Full House", desc: "Field a unit from all 6 families at once.", category: "building", condition: { counter: "familiesActive", gte: 6, scope: "run" } },

  // Economy
  { id: "nest_egg", name: "Nest Egg", desc: "Hold 5,000 DP at once.", category: "economy", condition: { counter: "maxDpHeld", gte: 5000, scope: "run" } },
  { id: "big_spender", name: "Big Spender", desc: "Spend 50,000 DP in a run.", category: "economy", condition: { counter: "dpSpent", gte: 50000, scope: "run" } },
  { id: "salvager", name: "Salvager", desc: "Salvage 25 items.", category: "economy", condition: { counter: "itemsSalvaged", gte: 25, scope: "lifetime" } },

  // Collection / research
  { id: "armory", name: "Armory", desc: "Have 25 items in inventory.", category: "collection", condition: { counter: "inventorySize", gte: 25, scope: "run" } },
  { id: "legendary_find", name: "Legendary Find", desc: "Loot a legendary item.", category: "collection", condition: { counter: "legendaryDrops", gte: 1, scope: "lifetime" } },
  { id: "mythic_find", name: "Mythic Find", desc: "Loot a mythic item.", hidden: true, category: "collection", condition: { counter: "mythicDrops", gte: 1, scope: "lifetime" } },
  { id: "polymath", name: "Polymath", desc: "Own 40 research nodes in one run.", category: "collection", condition: { counter: "researchOwned", gte: 40, scope: "run" } },

  // H2H
  { id: "first_duel", name: "First Duel", desc: "Complete an H2H match.", category: "h2h", condition: { counter: "h2hMatches", gte: 1, scope: "lifetime" } },
  { id: "duelist", name: "Duelist", desc: "Win 10 H2H matches.", category: "h2h", condition: { counter: "h2hWins", gte: 10, scope: "lifetime" } },

  // Challenge / meta
  { id: "hardcore_hero", name: "Hardcore Hero", desc: "Reach wave 25 in hardcore mode.", category: "challenge", condition: { counter: "hardcoreBestWave", gte: 25, scope: "lifetime" } },
  { id: "completionist", name: "Completionist", desc: "Unlock 75% of achievements.", hidden: true, category: "meta", condition: { counter: "achievementsPct", gte: 75, scope: "lifetime" } },
];

export const ACH_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

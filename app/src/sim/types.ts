// ============================================================================
// Dungeon Core - shared sim types (pure, no DOM/React/Firebase deps)
// See docs/04, 05, 09, 10, 13, 16. This is the single type contract.
// ============================================================================

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const TIER_NAMES: Record<Tier, string> = {
  1: "Bronze", 2: "Silver", 3: "Gold", 4: "Platinum", 5: "Mithril",
  6: "Adamant", 7: "Orichalcum", 8: "Dragon", 9: "Celestial", 10: "Mythic",
};

export const TIER_COLORS: Record<Tier, number> = {
  1: 0xb08d57, 2: 0xc0c0c8, 3: 0xe3c34e, 4: 0xd9e3ea, 5: 0x7fd6d1,
  6: 0x5fa8d3, 7: 0xb06fd6, 8: 0xe0533d, 9: 0xf2e9a0, 10: 0xff5db1,
};

export type Family =
  | "goblinoid" | "undead" | "beast" | "demon" | "construct" | "aberration";

export const FAMILIES: Family[] = [
  "goblinoid", "undead", "beast", "demon", "construct", "aberration",
];

export const FAMILY_COLORS: Record<Family, number> = {
  goblinoid: 0x6b8e23, undead: 0xd8d8e8, beast: 0xa0522d,
  demon: 0xc0392b, construct: 0x8895a0, aberration: 0x2aa198,
};

export type AffinityType =
  | "melee" | "ranged" | "arcane" | "holy" | "shadow" | "nature" | "fire" | "frost";

export type Affinities = Partial<Record<AffinityType, number>>;

// Affinity letter bands -> multiplier (docs/04 §3.2)
export const AFFINITY_BANDS: Record<string, number> = {
  S: 1.8, A: 1.5, B: 1.2, C: 1.0, D: 0.7, E: 0.4, F: 0.15,
};

// ----------------------------------------------------------------------------
// Stats (docs/04 §1)
// ----------------------------------------------------------------------------
export interface StatBlock {
  hp: number;
  def: number;
  phys: number;
  mag: number;
  rng: number;
  // secondary / affinity-specific (defaults applied via DEFAULT_SECONDARY)
  moveSpeed?: number;
  atkSpeed?: number;
  range?: number;
  acc?: number;
  dodge?: number;
  crit?: number;
  critMult?: number;
  mres?: number;
  armorPen?: number;
  magPen?: number;
  stealth?: number;
  detection?: number;
  block?: number;
  lifesteal?: number;
  regen?: number;
  aggroRadius?: number;
  threat?: number;
}

export const DEFAULT_SECONDARY = {
  moveSpeed: 1.0, atkSpeed: 1.0, range: 1, acc: 1.0, dodge: 0, crit: 0.05,
  critMult: 1.5, mres: 0, armorPen: 0, magPen: 0, stealth: 0, detection: 0,
  block: 0, lifesteal: 0, regen: 0, aggroRadius: 4, threat: 1.0,
};

/** A StatBlock with all secondary fields resolved to concrete numbers. */
export type ResolvedStats = Required<StatBlock>;

// ----------------------------------------------------------------------------
// Abilities (docs/04 §6)
// ----------------------------------------------------------------------------
export type AbilityTrigger =
  | "passive" | "onHit" | "onKill" | "onTakeDamage" | "onWaveStart" | "periodic";

export type AbilityEffectKind =
  | "cleave" | "splash" | "slowOnHit" | "poisonDot" | "auraBuff" | "fear"
  | "summon" | "shieldOnWaveStart" | "executeLowHp" | "firstStrike"
  | "healAlly" | "petSummon" | "blink" | "partyBuff" | "confuse" | "thorns"
  | "reviveSelf";

export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  effect: AbilityEffectKind;
  params?: Record<string, number>;
  radius?: number;
}

// ----------------------------------------------------------------------------
// Content definitions (catalog)  (docs/05, 09)
// ----------------------------------------------------------------------------
export type UnitRole =
  | "swarm" | "melee" | "ranged" | "caster" | "bruiser" | "tank"
  | "summoner" | "control" | "hybrid" | "colossus" | "capstone" | "utility";

export interface UnitDef {
  id: string;
  name: string;
  family: Family;
  tier: Tier;
  role: UnitRole;
  stats: StatBlock;
  affinities: Affinities;
  abilities?: Ability[];
  turretCapable?: boolean;
  notes?: string;
}

export type Archetype = "warrior" | "archer" | "mage" | "rogue";

export interface ClassDef {
  id: string;
  name: string;
  archetype: Archetype;
  tier: Tier;
  branch: boolean;
  stats: StatBlock;
  affinities: Affinities;
  abilities?: Ability[];
  revealRadius?: number; // rogues
}

export interface UniqueDef {
  id: string;
  name: string;
  baseClassId: string;
  flavor: string;
}

// ----------------------------------------------------------------------------
// Traps (docs/08)
// ----------------------------------------------------------------------------
export type TrapCategory = "damage" | "control" | "debuff" | "utility" | "special";
export type TrapTrigger = "step" | "proximity" | "tripwire";
export type DamageType = AffinityType | "true";

export interface TrapEffect {
  damage?: number;
  damageType?: DamageType;
  status?: StatusSpec;
  stripDodge?: boolean;   // anti-rogue (net / truesight)
  reveal?: boolean;       // truesight ward reveals stealth in radius
  silence?: boolean;      // anti-mage
  removeTarget?: boolean; // pitfall / banish-ish
  teleportToEntrance?: boolean;
  pull?: boolean;
}

export interface TrapDef {
  id: string;
  name: string;
  tier: Tier;
  category: TrapCategory;
  trigger: TrapTrigger;
  hiddenRating: number;
  radius?: number;
  charges: number | "infinite";
  cooldownTicks: number;
  consumable: boolean;
  effect: TrapEffect;
  cost: number;
}

// ----------------------------------------------------------------------------
// Status effects (docs/10 §4.3)
// ----------------------------------------------------------------------------
export type StatusKind =
  | "poison" | "burn" | "bleed" | "slow" | "root" | "stun"
  | "debuffStat" | "buffStat" | "shield" | "fear" | "silence" | "confuse";

export interface StatusSpec {
  kind: StatusKind;
  magnitude: number;       // dmg/sec, slow %, stat delta, shield amount...
  durationTicks: number;
  stat?: keyof StatBlock;  // for buff/debuff
}

export interface StatusEffect extends StatusSpec {
  remainingTicks: number;
  sourceId: string;
}

// ----------------------------------------------------------------------------
// Gear (docs/07)
// ----------------------------------------------------------------------------
export type GearSlot = "weapon" | "armor" | "accessory";
export type WeaponType =
  | "sword" | "axe" | "mace" | "spear" | "dagger"
  | "bow" | "crossbow" | "staff" | "wand" | "orb" | "tome";
export type ArmorType = "light" | "medium" | "heavy" | "robe" | "shield";
export type AccessoryType = "ring" | "amulet" | "charm" | "banner";
export type Quality =
  | "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface Affix {
  id: string;
  stat: keyof StatBlock;
  value: number;
}

export interface GearItem {
  id: string;          // instance id
  defId: string;       // catalog def
  name: string;
  slot: GearSlot;
  itemType: WeaponType | ArmorType | AccessoryType;
  tier: Tier;
  quality: Quality;
  mods: Partial<StatBlock>;
  affinityTypeForScaling?: AffinityType;
  affixes: Affix[];
}

// ----------------------------------------------------------------------------
// Research (docs/06)
// ----------------------------------------------------------------------------
export type ResearchBranch = Family | "general";
export type ResearchType =
  | "unlockUnit" | "familyUpgrade" | "crossUpgrade" | "unlockContent" | "economy";

export interface ResearchEffect {
  unlockUnitId?: string;
  unlockContent?: string;
  family?: Family;
  stat?: keyof StatBlock;
  addPct?: number;        // additive percent per rank (e.g., 0.06 = +6%)
  flat?: number;
  crossRole?: UnitRole | "rangedAll" | "meleeAll" | "casterAll";
  dpKillPct?: number;
  digCostPct?: number;
  capacityPct?: number;
  unitCostPct?: number;
}

export interface ResearchNode {
  id: string;
  name: string;
  branch: ResearchBranch;
  type: ResearchType;
  researchTier: number;   // R1..R10
  cost: number;
  prereqs: string[];
  ranks: number;
  effect: ResearchEffect;
}

// ----------------------------------------------------------------------------
// Achievements (docs/13)
// ----------------------------------------------------------------------------
export type AchCategory =
  | "progression" | "combat" | "building" | "economy"
  | "collection" | "h2h" | "challenge" | "meta";

export interface AchCondition {
  counter: string;        // key into run/profile counters
  gte: number;
  scope?: "run" | "lifetime";
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  hidden?: boolean;
  category: AchCategory;
  condition: AchCondition;
  reward?: { dpThisRun?: number; cosmetic?: string; ngModifier?: string };
}

// ----------------------------------------------------------------------------
// Map (docs/03)
// ----------------------------------------------------------------------------
export type TileState = "stone" | "floor" | "core" | "entrance" | "wall";

export interface MapTile {
  state: Exclude<TileState, "stone">;
  unitId?: string;
  trapId?: string;
}

export interface DungeonMap {
  width: number;
  height: number;
  core: { x: number; y: number };
  entrance: { x: number; y: number };
  tiles: Record<string, MapTile>; // key "x,y"
  openedCount: number;
}

// ----------------------------------------------------------------------------
// Placed instances + run state (docs/13)
// ----------------------------------------------------------------------------
export interface PlacedUnit {
  id: string;            // instance id
  defId: string;
  x: number;
  y: number;
  isTurret?: boolean;
  gear: { weapon?: string; armor?: string; accessory?: string[] };
}

export interface PlacedTrap {
  id: string;
  defId: string;
  x: number;
  y: number;
}

export type NGModifier =
  | "hardcore" | "fastStart" | "eliteWaves" | "ironCore" | "lootPlus" | "tutorial";

export interface RunStats {
  kills: number;
  killsByTrap: number;
  uniquesKilled: number;
  roguesKilled: number;
  dpEarned: number;
  dpSpent: number;
  wavesCleared: number;
  bestWave: number;
  drops: number;
  flawlessWaves: number;
  [k: string]: number;
}

export interface RunState {
  id: string;
  uid: string;
  status: "active" | "ended";
  createdAt: number;
  updatedAt: number;
  wave: number;
  dp: number;
  core: { level: number; hp: number; maxHp: number; ward: number; wardMax: number };
  map: DungeonMap;
  units: PlacedUnit[];
  traps: PlacedTrap[];
  inventory: GearItem[];
  research: { owned: string[]; ranks: Record<string, number> };
  gearShop: GearItem[];
  rngSeedRoot: number;
  modifiers: NGModifier[];
  simVersion: string;
  stats: RunStats;
}

// Frozen dungeon for snapshots / H2H (docs/12, 13)
export interface FrozenDungeon {
  map: DungeonMap;
  units: PlacedUnit[];
  traps: PlacedTrap[];
  inventory: GearItem[];
  research: { owned: string[]; ranks: Record<string, number> };
  core: { level: number; hp: number; maxHp: number; ward: number; wardMax: number };
}

export interface Snapshot {
  id: string;
  uid: string;
  name: string;
  createdAt: number;
  source: "death" | "retire";
  endedAtWave: number;
  rating: number;
  shareable: boolean;
  dungeon: FrozenDungeon;
  simVersion: string;
}

// ----------------------------------------------------------------------------
// Simulation runtime (docs/10)
// ----------------------------------------------------------------------------
export type Side = "dungeon" | "invader";

export interface SimEntity {
  id: string;
  side: Side;
  defId: string;
  name: string;
  family?: Family;
  archetype?: Archetype;
  tier: Tier;
  isUnique?: boolean;
  isTurret?: boolean;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  shield: number;
  stats: ResolvedStats;
  affinities: Affinities;
  abilities: Ability[];
  primaryDamageType: AffinityType;
  state: "idle" | "moving" | "attacking" | "fleeing" | "dead";
  targetId?: string;
  attackCdTicks: number;
  statuses: StatusEffect[];
  revealRadius: number;
  threatValue: number;
}

export type SimEventType =
  | "spawn" | "move" | "attack" | "hit" | "miss" | "crit" | "status"
  | "trapTrigger" | "death" | "drop" | "coreHit" | "heal" | "summon"
  | "reveal" | "waveStart" | "waveEnd";

export interface SimEvent {
  tick: number;
  type: SimEventType;
  sourceId?: string;
  targetId?: string;
  x?: number;
  y?: number;
  amount?: number;
  data?: Record<string, unknown>;
}

export interface WaveReward {
  dp: number;
  drops: GearItem[];
  killCount: number;
}

export interface FrameEnt {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface Frame {
  tick: number;
  ents: FrameEnt[];
}

export interface EntityMeta {
  id: string;
  side: Side;
  defId: string;
  name: string;
  tier: Tier;
  isUnique: boolean;
  family?: Family;
  archetype?: Archetype;
}

export interface Timeline {
  seed: number;
  wave: number;
  durationTicks: number;
  outcome: {
    coreSurvived: boolean;
    coreHpRemaining: number;
    waveCleared: boolean;
  };
  events: SimEvent[];
  frames: Frame[];
  meta: EntityMeta[];
  coreHpStart: number;
  reward: WaveReward;
  casualties: string[]; // dungeon unit instance ids that died
}

// Wave definition produced by wavegen (docs/09)
export type GroupType = "solo" | "party" | "horde" | "crusade";

export interface WaveInvader {
  id: string;
  classId: string;
  tier: Tier;
  isUnique: boolean;
  uniqueId?: string;
  statMult: number;
}

export interface WaveDef {
  wave: number;
  seed: number;
  groupType: GroupType;
  tierBand: [number, number];
  invaders: WaveInvader[];
}

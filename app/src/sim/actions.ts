// ============================================================================
// Game action helpers (docs/02,03,06,07,16). Pure-ish: mutate the given run
// and return an error string (or null on success). Shared client + server.
// ============================================================================
import type { RunState, PlacedUnit, GearSlot, Tier } from "./types";
import { CONFIG, coreLevelRow, spaceCost, wardForCl, roomRadius } from "./config";
import { UNIT_BY_ID } from "./content/units";
import { TRAP_BY_ID } from "./content/traps";
import { RESEARCH_BY_ID, unlockedUnitIds } from "./content/research";
import { computeResearchMods } from "./combat";
import { unitCost, turretCost, digCost, gearPrice, salvageValue, clUpgradeCost } from "./economy";
import { key, isPassable, pathExists, neighbors, validatePaths, manhattan, roomOpen } from "./maputil";
import { generateGear, rollQuality } from "./content/gear";
import { makePRNG } from "./rng";

export type ActionResult = string | null; // error message or null on success

let idc = 0;
function newId(p: string): string { return `${p}_${Date.now().toString(36)}_${idc++}`; }

export function capacityMax(run: RunState): number {
  const mods = computeResearchMods(run);
  return Math.floor(coreLevelRow(run.core.level).capacity * (1 + mods.capacityPct));
}

export function capacityUsed(run: RunState): number {
  let used = 0;
  for (const u of run.units) {
    const def = UNIT_BY_ID[u.defId];
    if (def) used += spaceCost(def.tier);
  }
  return used;
}

/** Count placed units within NEARBY_RADIUS (Chebyshev) of a tile. */
function nearbyUnitCount(run: RunState, x: number, y: number, excludeId?: string): number {
  const r = CONFIG.NEARBY_RADIUS;
  let count = 0;
  for (const u of run.units) {
    if (u.id === excludeId) continue;
    if (Math.max(Math.abs(u.x - x), Math.abs(u.y - y)) <= r) count++;
  }
  return count;
}

export function unlockedUnits(run: RunState): Set<string> {
  return unlockedUnitIds(run.research.owned);
}

function trapUnlocked(run: RunState, tier: number): boolean {
  if (tier <= 2) return run.research.owned.includes("res_basic_traps");
  if (tier <= 5) return run.research.owned.includes("res_adv_traps");
  return run.research.owned.includes("res_elite_traps");
}

function spend(run: RunState, amount: number): boolean {
  if (run.dp < amount) return false;
  run.dp -= amount;
  run.stats.dpSpent += amount;
  return true;
}

function refund(run: RunState, amount: number) {
  run.dp += amount;
}

// --- Digging ---
export function digTile(run: RunState, x: number, y: number): ActionResult {
  if (isPassable(run.map, x, y)) return "Already open";
  // adjacency
  const adj = neighbors(x, y).some(([nx, ny]) => isPassable(run.map, nx, ny));
  if (!adj) return "Must be adjacent to open floor";
  if (run.map.openedCount >= coreLevelRow(run.core.level).sizeCap) return "Size cap reached (upgrade Core Level)";
  const mods = computeResearchMods(run);
  const cost = Math.max(1, Math.round(digCost(run.map.openedCount) * (1 + mods.digCostPct)));
  if (!spend(run, cost)) return "Not enough DP";
  run.map.tiles[key(x, y)] = { state: "floor" };
  run.map.openedCount++;
  return null;
}

export function collapseTile(run: RunState, x: number, y: number): ActionResult {
  const t = run.map.tiles[key(x, y)];
  if (!t || t.state !== "floor") return "Can only collapse open floor";
  if (t.unitId || t.trapId) return "Tile is occupied";
  delete run.map.tiles[key(x, y)];
  run.map.openedCount--;
  const paths = validatePaths(run.map);
  if (!paths.connected || !paths.fairLane) {
    run.map.tiles[key(x, y)] = t;
    run.map.openedCount++;
    return "Would block the path to the core";
  }
  refund(run, Math.round(digCost(run.map.openedCount) * CONFIG.DIG_REFUND));
  return null;
}

// --- Units ---
export function placeUnit(run: RunState, defId: string, x: number, y: number, turretMode = false): ActionResult {
  const def = UNIT_BY_ID[defId];
  if (!def) return "Unknown unit";
  if (!unlockedUnits(run).has(defId)) return "Not researched yet";
  if (def.tier > coreLevelRow(run.core.level).maxUnitTier) return `Requires higher Core Level (T${def.tier})`;
  const t = run.map.tiles[key(x, y)];
  if (!t || t.state !== "floor") return "Must place on open floor";
  if (t.unitId || t.trapId) return "Tile is occupied";
  if (manhattan(x, y, run.map.entrance.x, run.map.entrance.y) <= CONFIG.ENTRANCE_SAFE_RADIUS) return "Too close to the entrance";
  const r = roomRadius(def.tier);
  if (r > 0 && !roomOpen(run.map, x, y, r)) {
    const size = r * 2 + 1;
    return `Tier ${def.tier} units need a ${size}x${size} open room (dig it out)`;
  }
  if (nearbyUnitCount(run, x, y) > CONFIG.MAX_NEARBY_UNITS) {
    return `Too crowded \u2014 a unit can be near at most ${CONFIG.MAX_NEARBY_UNITS} others. Spread out into more rooms.`;
  }
  const space = spaceCost(def.tier);
  if (capacityUsed(run) + space > capacityMax(run)) return "Not enough capacity";
  const isTurret = turretMode && !!def.turretCapable;
  if (turretMode && !def.turretCapable) return "This unit can't be a turret";
  if (isTurret && run.core.level < 2) return "Turrets unlock at Core Level 2";
  const mods = computeResearchMods(run);
  const baseCost = isTurret ? turretCost(def) : unitCost(def);
  const cost = Math.max(1, Math.round(baseCost * (1 + mods.unitCostPct)));
  if (!spend(run, cost)) return "Not enough DP";
  const unit: PlacedUnit = { id: newId("u"), defId, x, y, isTurret, gear: { accessory: [] } };
  run.units.push(unit);
  t.unitId = unit.id;
  return null;
}

export function moveUnit(run: RunState, unitId: string, x: number, y: number): ActionResult {
  const unit = run.units.find((u) => u.id === unitId);
  if (!unit) return "No such unit";
  const dest = run.map.tiles[key(x, y)];
  if (!dest || dest.state !== "floor") return "Must move to open floor";
  if (dest.unitId || dest.trapId) return "Tile is occupied";
  if (manhattan(x, y, run.map.entrance.x, run.map.entrance.y) <= CONFIG.ENTRANCE_SAFE_RADIUS) return "Too close to the entrance";
  const def = UNIT_BY_ID[unit.defId];
  if (def) {
    const r = roomRadius(def.tier);
    if (r > 0 && !roomOpen(run.map, x, y, r)) {
      const size = r * 2 + 1;
      return `Tier ${def.tier} units need a ${size}x${size} open room`;
    }
  }
  if (nearbyUnitCount(run, x, y, unit.id) > CONFIG.MAX_NEARBY_UNITS) {
    return `Too crowded \u2014 a unit can be near at most ${CONFIG.MAX_NEARBY_UNITS} others.`;
  }
  const from = run.map.tiles[key(unit.x, unit.y)];
  if (from) delete from.unitId;
  unit.x = x; unit.y = y;
  dest.unitId = unit.id;
  return null;
}

export function sellUnit(run: RunState, unitId: string): ActionResult {
  const idx = run.units.findIndex((u) => u.id === unitId);
  if (idx < 0) return "No such unit";
  const unit = run.units[idx];
  const def = UNIT_BY_ID[unit.defId];
  if (def) {
    const base = unit.isTurret ? turretCost(def) : unitCost(def);
    refund(run, Math.round(base * CONFIG.SELL_REFUND));
  }
  // unequip gear back to inventory (already in inventory; just clear refs)
  const tile = run.map.tiles[key(unit.x, unit.y)];
  if (tile) delete tile.unitId;
  run.units.splice(idx, 1);
  return null;
}

// --- Traps ---
export function placeTrap(run: RunState, defId: string, x: number, y: number): ActionResult {
  const def = TRAP_BY_ID[defId];
  if (!def) return "Unknown trap";
  if (!trapUnlocked(run, def.tier)) return "Trap type not researched";
  if (def.tier > coreLevelRow(run.core.level).maxUnitTier) return "Requires higher Core Level";
  const t = run.map.tiles[key(x, y)];
  if (!t || t.state !== "floor") return "Must place on open floor";
  if (t.unitId || t.trapId) return "Tile is occupied";
  // entrance safe radius
  if (manhattan(x, y, run.map.entrance.x, run.map.entrance.y) <= CONFIG.ENTRANCE_SAFE_RADIUS) return "Too close to the entrance";
  // core halo
  if (Math.max(Math.abs(x - run.map.core.x), Math.abs(y - run.map.core.y)) <= CONFIG.CORE_NOBUILD_HALO) return "Too close to the core";
  if (!spend(run, def.cost)) return "Not enough DP";
  const id = newId("t");
  run.traps.push({ id, defId, x, y });
  t.trapId = id;
  // fair-lane must still exist
  if (!pathExists(run.map, run.map.entrance, run.map.core, true)) {
    run.traps.pop();
    delete t.trapId;
    refund(run, def.cost);
    return "This would block the only safe path to the core";
  }
  return null;
}

export function moveTrap(run: RunState, trapId: string, x: number, y: number): ActionResult {
  const trap = run.traps.find((t) => t.id === trapId);
  if (!trap) return "No such trap";
  const dest = run.map.tiles[key(x, y)];
  if (!dest || dest.state !== "floor") return "Must move to open floor";
  if (dest.unitId || dest.trapId) return "Tile is occupied";
  if (manhattan(x, y, run.map.entrance.x, run.map.entrance.y) <= CONFIG.ENTRANCE_SAFE_RADIUS) return "Too close to the entrance";
  if (Math.max(Math.abs(x - run.map.core.x), Math.abs(y - run.map.core.y)) <= CONFIG.CORE_NOBUILD_HALO) return "Too close to the core";
  const oldX = trap.x, oldY = trap.y;
  const from = run.map.tiles[key(oldX, oldY)];
  if (from) delete from.trapId;
  trap.x = x; trap.y = y; dest.trapId = trap.id;
  if (!pathExists(run.map, run.map.entrance, run.map.core, true)) {
    delete dest.trapId;
    trap.x = oldX; trap.y = oldY;
    if (from) from.trapId = trap.id;
    return "This would block the only safe path to the core";
  }
  return null;
}

export function moveCore(run: RunState, x: number, y: number): ActionResult {
  const t = run.map.tiles[key(x, y)];
  if (!t || t.state !== "floor") return "Must move the core to open floor";
  if (t.unitId || t.trapId) return "Tile is occupied (clear it first)";
  const old = run.map.core;
  const oldTile = run.map.tiles[key(old.x, old.y)];
  if (oldTile) oldTile.state = "floor";
  t.state = "core";
  run.map.core = { x, y };
  const paths = validatePaths(run.map);
  if (!paths.connected || !paths.fairLane) {
    t.state = "floor";
    if (oldTile) oldTile.state = "core";
    run.map.core = old;
    return "The core must keep a safe path from the entrance";
  }
  return null;
}

export function sellTrap(run: RunState, trapId: string): ActionResult {
  const idx = run.traps.findIndex((t) => t.id === trapId);
  if (idx < 0) return "No such trap";
  const trap = run.traps[idx];
  const def = TRAP_BY_ID[trap.defId];
  if (def) refund(run, Math.round(def.cost * CONFIG.SELL_REFUND_TRAP));
  const tile = run.map.tiles[key(trap.x, trap.y)];
  if (tile) delete tile.trapId;
  run.traps.splice(idx, 1);
  return null;
}

// --- Gear ---
export function equipGear(run: RunState, unitId: string, itemId: string, slot: GearSlot): ActionResult {
  const unit = run.units.find((u) => u.id === unitId);
  if (!unit) return "No such unit";
  const item = run.inventory.find((g) => g.id === itemId);
  if (!item) return "No such item";
  if (item.slot !== slot) return "Wrong slot";
  const def = UNIT_BY_ID[unit.defId];
  if (def && item.tier > def.tier + 1) return "Item tier too high for this unit";
  if (slot === "accessory") {
    unit.gear.accessory ??= [];
    const maxAcc = run.core.level >= 7 ? 3 : run.core.level >= 3 ? 2 : 1;
    if (unit.gear.accessory.length >= maxAcc) return "No free accessory slots";
    unit.gear.accessory.push(itemId);
  } else {
    unit.gear[slot] = itemId;
  }
  return null;
}

export function unequipGear(run: RunState, unitId: string, slot: GearSlot, itemId?: string): ActionResult {
  const unit = run.units.find((u) => u.id === unitId);
  if (!unit) return "No such unit";
  if (slot === "accessory") {
    unit.gear.accessory = (unit.gear.accessory ?? []).filter((i) => i !== itemId);
  } else {
    unit.gear[slot] = undefined;
  }
  return null;
}

export function salvageGear(run: RunState, itemId: string): ActionResult {
  const idx = run.inventory.findIndex((g) => g.id === itemId);
  if (idx < 0) return "No such item";
  const item = run.inventory[idx];
  // unequip from any unit
  for (const u of run.units) {
    if (u.gear.weapon === itemId) u.gear.weapon = undefined;
    if (u.gear.armor === itemId) u.gear.armor = undefined;
    u.gear.accessory = (u.gear.accessory ?? []).filter((i) => i !== itemId);
  }
  refund(run, salvageValue(item.tier, item.quality));
  run.inventory.splice(idx, 1);
  return null;
}

export function buyGear(run: RunState, itemId: string): ActionResult {
  if (run.core.level < 3) return "Gear Shop unlocks at Core Level 3";
  const idx = run.gearShop.findIndex((g) => g.id === itemId);
  if (idx < 0) return "Item no longer available";
  const item = run.gearShop[idx];
  if (!spend(run, gearPrice(item.tier, item.quality))) return "Not enough DP";
  run.gearShop.splice(idx, 1);
  run.inventory.push(item);
  return null;
}

export function rerollGearShop(run: RunState, free = false): ActionResult {
  if (run.core.level < 3) return "Gear Shop unlocks at Core Level 3";
  const cost = 15;
  if (!free && !spend(run, cost)) return "Not enough DP";
  run.gearShop = generateShopStock(run);
  return null;
}

export function generateShopStock(run: RunState): RunState["gearShop"] {
  const rng = makePRNG((Math.random() * 0x7fffffff) | 0);
  const maxTier = coreLevelRow(run.core.level).maxUnitTier;
  const stock: RunState["gearShop"] = [];
  for (let i = 0; i < 6; i++) {
    const tier = Math.max(1, Math.min(maxTier, maxTier - rng.int(2))) as Tier;
    stock.push(generateGear(rng, tier, rollQuality(rng, false)));
  }
  return stock;
}

// --- Research ---
export function buyResearch(run: RunState, nodeId: string): ActionResult {
  const node = RESEARCH_BY_ID[nodeId];
  if (!node) return "Unknown research";
  const currentRank = run.research.ranks[nodeId] ?? (run.research.owned.includes(nodeId) ? 1 : 0);
  if (currentRank >= node.ranks) return "Already maxed";
  if (coreLevelRow(run.core.level).researchTier < node.researchTier) return `Unlocks at research tier R${node.researchTier}`;
  for (const p of node.prereqs) {
    if (!run.research.owned.includes(p)) return "Requires prerequisite research";
  }
  if (!spend(run, node.cost)) return "Not enough DP";
  if (!run.research.owned.includes(nodeId)) run.research.owned.push(nodeId);
  run.research.ranks[nodeId] = currentRank + 1;
  return null;
}

// --- Core ---
export function upgradeCore(run: RunState): ActionResult {
  if (run.core.level >= 20) return "Core is at maximum level";
  const next = coreLevelRow(run.core.level + 1);
  if (!spend(run, clUpgradeCost(run.core.level))) return "Not enough DP";
  const hpDelta = next.coreHp - run.core.maxHp;
  run.core.level += 1;
  run.core.maxHp = next.coreHp;
  run.core.hp = Math.min(next.coreHp, run.core.hp + hpDelta);
  run.core.wardMax = wardForCl(run.core.level, run.core.maxHp);
  run.core.ward = run.core.wardMax;
  if (run.core.level === 3) run.gearShop = generateShopStock(run);
  return null;
}

// --- Entrance ---
export function moveEntrance(run: RunState, x: number, y: number): ActionResult {
  const t = run.map.tiles[key(x, y)];
  if (!t || t.state !== "floor") return "Must move entrance to open floor";
  if (t.unitId || t.trapId) return "Tile is occupied";
  const old = run.map.entrance;
  const oldTile = run.map.tiles[key(old.x, old.y)];
  if (oldTile) oldTile.state = "floor";
  t.state = "entrance";
  run.map.entrance = { x, y };
  const paths = validatePaths(run.map);
  if (!paths.connected || !paths.fairLane) {
    // revert
    t.state = "floor";
    if (oldTile) oldTile.state = "entrance";
    run.map.entrance = old;
    return "Entrance must keep a safe path to the core";
  }
  return null;
}

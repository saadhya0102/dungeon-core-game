// ============================================================================
// Run creation + starting dungeon (docs/02, 03, 13).
// ============================================================================
import type { RunState, DungeonMap, NGModifier, RunStats } from "./types";
import { CONFIG, coreLevelRow, SIM_VERSION } from "./config";
import { STARTER_RESEARCH } from "./content/research";
import type { SwiftRule } from "./kingdom";

export const ORIGIN = 30; // place starting dungeon around (30,30) to keep coords positive

export function emptyRunStats(): RunStats {
  return {
    kills: 0, killsByTrap: 0, uniquesKilled: 0, roguesKilled: 0,
    dpEarned: 0, dpSpent: 0, wavesCleared: 0, bestWave: 0, drops: 0, flawlessWaves: 0,
  };
}

export function createStartingMap(size = 5): DungeonMap {
  const tiles: DungeonMap["tiles"] = {};
  const cx = ORIGIN, cy = ORIGIN;
  const start = -Math.floor(size / 2);
  const last = start + size - 1;
  for (let x = cx + start; x <= cx + last; x++) {
    for (let y = cy + start; y <= cy + last; y++) {
      tiles[`${x},${y}`] = { state: "floor" };
    }
  }
  tiles[`${cx},${cy}`] = { state: "core" };
  const ex = cx + last, ey = cy + last;
  tiles[`${ex},${ey}`] = { state: "entrance" };
  return {
    width: 64, height: 64,
    core: { x: cx, y: cy },
    entrance: { x: ex, y: ey },
    tiles,
    openedCount: size * size,
  };
}

export function createNewRun(uid: string, modifiers: NGModifier[] = [], seed?: number, swiftRule?: SwiftRule): RunState {
  const cl0 = coreLevelRow(1);
  const startDp = CONFIG.STARTING_DP + (modifiers.includes("fastStart") ? 200 : 0);
  const now = Date.now();
  return {
    id: `run_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    uid,
    status: "active",
    createdAt: now,
    updatedAt: now,
    wave: 1,
    dp: startDp,
    core: { level: 1, hp: cl0.coreHp, maxHp: cl0.coreHp, ward: 0, wardMax: 0 },
    map: createStartingMap(swiftRule === "oneRoom" ? 10 : 5),
    units: [],
    traps: [],
    inventory: [],
    research: { owned: swiftRule === "noUnits" ? [...STARTER_RESEARCH, "res_basic_traps"] : [...STARTER_RESEARCH], ranks: {} },
    gearShop: [],
    rngSeedRoot: seed ?? Math.floor(Math.random() * 0x7fffffff),
    modifiers,
    simVersion: SIM_VERSION,
    stats: emptyRunStats(),
    ...(swiftRule ? { swiftRule } : {}),
  };
}

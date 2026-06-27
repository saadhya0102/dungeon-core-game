// ============================================================================
// Balance harness: an automated "reasonable player" that builds a dungeon and
// runs waves, used to sanity-check scaling (how deep can a decent run get?).
// Not shipped to players; used by balance.test.ts and tuning.
// ============================================================================
import type { RunState, Family } from "./types";
import { FAMILIES } from "./types";
import { createNewRun } from "./factory";
import { resolveWave } from "./resolve";
import { applyWaveResult } from "./progress";
import { coreLevelRow, spaceCost } from "./config";
import { clUpgradeCost } from "./economy";
import { UNITS, UNIT_BY_ID } from "./content/units";
import { RESEARCH } from "./content/research";
import {
  digTile, placeUnit, buyResearch, upgradeCore,
  capacityMax, capacityUsed, unlockedUnits,
} from "./actions";
import { isPassable } from "./maputil";
import { makePRNG } from "./rng";

export interface AutoResult {
  wave: number;
  cl: number;
  units: number;
  dpEarned: number;
  died: boolean;
  faction: Family | "mixed";
}

/** Dig outward from the core, spending at most dpBudget DP. */
function digSome(run: RunState, dpBudget: number) {
  const cap = coreLevelRow(run.core.level).sizeCap;
  const cx = run.map.core.x, cy = run.map.core.y;
  let spent = 0;
  for (let r = 3; r < 40 && spent < dpBudget && run.map.openedCount < cap; r++) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (spent >= dpBudget || run.map.openedCount >= cap) break;
        if (isPassable(run.map, x, y)) continue;
        const before = run.dp;
        const err = digTile(run, x, y);
        if (err) { if (err.includes("DP")) return; continue; }
        spent += before - run.dp;
      }
    }
  }
}

/** Buy purchasable research, spending up to a fraction of current DP. */
function buyResearchBudget(run: RunState, faction: Family | null, frac: number) {
  let budget = Math.floor(run.dp * frac);
  // prefer this faction's nodes + key general nodes, cheapest first (or all if mixed)
  const nodes = RESEARCH
    .filter((n) => faction === null || n.branch === faction || n.branch === "general")
    .slice()
    .sort((a, b) => a.cost - b.cost);
  let guard = 0;
  let progress = true;
  while (progress && guard++ < 200) {
    progress = false;
    for (const n of nodes) {
      if (n.cost > budget) continue;
      const before = run.dp;
      const err = buyResearch(run, n.id);
      if (!err) { budget -= before - run.dp; progress = true; }
    }
  }
}

/** Find a valid tile for a unit of the given def and place it. Returns true on success. */
function placeBest(run: RunState, defId: string): boolean {
  const def = UNIT_BY_ID[defId];
  if (!def) return false;
  const r = run.map; const cx = r.core.x, cy = r.core.y;
  // scan tiles spiraling out from core
  const tiles = Object.keys(r.tiles);
  for (const k of tiles) {
    const [x, y] = k.split(",").map(Number);
    const t = r.tiles[k];
    if (t.state !== "floor" || t.unitId || t.trapId) continue;
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 1) continue; // skip core halo
    const err = placeUnit(run, defId, x, y);
    if (!err) return true;
  }
  return false;
}

/** Fill remaining capacity with the highest-tier unlocked unit that fits. */
function fillUnits(run: RunState, faction: Family | null) {
  const maxTier = coreLevelRow(run.core.level).maxUnitTier;
  const unlocked = unlockedUnits(run);
  const roster = UNITS
    .filter((u) => (faction === null || u.family === faction) && unlocked.has(u.id) && u.tier <= maxTier)
    .sort((a, b) => b.tier - a.tier);
  if (roster.length === 0) return;
  let stuck = 0;
  while (stuck < roster.length + 1) {
    const cap = capacityMax(run), used = capacityUsed(run);
    if (used >= cap) break;
    let placed = false;
    for (const u of roster) {
      if (used + spaceCost(u.tier) > cap) continue;
      if (placeBest(run, u.id)) { placed = true; break; }
    }
    if (!placed) stuck++; else stuck = 0;
  }
}

function manageBuild(run: RunState, faction: Family | null) {
  buyResearchBudget(run, faction, 0.2);
  // The core gates capacity AND unit tier, so upgrade aggressively while keeping
  // ~25% of DP for units.
  let g = 0;
  while (run.core.level < 20 && clUpgradeCost(run.core.level) <= run.dp * 0.75 && g++ < 3) {
    if (upgradeCore(run)) break;
  }
  digSome(run, Math.floor(run.dp * 0.15));
  fillUnits(run, faction);
}

export function autoRun(seed: number, maxWave = 60, forceFaction?: Family | "mixed"): AutoResult {
  const run = createNewRun("bal", [], seed);
  const faction: Family | null = forceFaction === "mixed" ? null
    : forceFaction ?? FAMILIES[makePRNG(seed).int(FAMILIES.length)];
  const reported: Family | "mixed" = faction ?? "mixed";
  for (let w = 1; w <= maxWave; w++) {
    manageBuild(run, faction);
    const tl = resolveWave(run);
    const res = applyWaveResult(run, tl);
    if (res.died) {
      return { wave: w, cl: run.core.level, units: run.units.length, dpEarned: run.stats.dpEarned, died: true, faction: reported };
    }
  }
  return { wave: maxWave, cl: run.core.level, units: run.units.length, dpEarned: run.stats.dpEarned, died: false, faction: reported };
}

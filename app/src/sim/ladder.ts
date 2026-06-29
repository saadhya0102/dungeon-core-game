// ============================================================================
// Ladder bots: a roster of pre-built opponent dungeons (the "subagent-run
// accounts") so Head-to-Head always has varied opponents, plus a simple Elo
// rating helper. Dungeons are built deterministically from the shared sim so
// they behave exactly like a real saved dungeon.
// ============================================================================
import type { Snapshot, Family, RunState } from "./types";
import { createNewRun } from "./factory";
import { coreLevelRow, spaceCost, SIM_VERSION } from "./config";
import { UNITS } from "./content/units";
import { RESEARCH } from "./content/research";
import {
  digTile, placeUnit, buyResearch, upgradeCore,
  capacityMax, capacityUsed, unlockedUnits,
} from "./actions";
import { isPassable } from "./maputil";
import { resolveWave } from "./resolve";
import { generateWave } from "./wavegen";

/**
 * Estimate the highest normal wave this (static) dungeon can survive, by
 * simulating it against escalating waves until its core falls. This makes the
 * displayed "wave reached" reflect the dungeon's REAL strength instead of a
 * made-up number. resolveWave does not mutate the dungeon, so probing is safe.
 */
function estimateWaveReached(run: RunState): number {
  let reached = 0;
  for (let w = 3; w <= 70; w += 4) {
    run.wave = w;
    const tl = resolveWave(run, generateWave(w, run.rngSeedRoot));
    if (tl.outcome.coreSurvived) reached = w; else break;
  }
  return Math.max(1, reached);
}

function digArena(run: RunState) {
  // Keep bot dungeons fairly CONTAINED (not a giant open field) so the core
  // isn't exposed to long-range line of sight; cap the radius.
  const cap = coreLevelRow(run.core.level).sizeCap;
  const cx = run.map.core.x, cy = run.map.core.y;
  const maxR = 7;
  for (let r = 3; r <= maxR && run.map.openedCount < cap; r++) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (run.map.openedCount >= cap) break;
        if (isPassable(run.map, x, y)) continue;
        digTile(run, x, y);
      }
    }
  }
}

function buyFactionResearch(run: RunState, faction: Family) {
  const nodes = RESEARCH
    .filter((n) => n.branch === faction || n.branch === "general")
    .sort((a, b) => a.cost - b.cost);
  let progress = true;
  let guard = 0;
  while (progress && guard++ < 200) {
    progress = false;
    for (const n of nodes) if (!buyResearch(run, n.id)) progress = true;
  }
}

function fillUnits(run: RunState, faction: Family) {
  const maxTier = coreLevelRow(run.core.level).maxUnitTier;
  const unlocked = unlockedUnits(run);
  const roster = UNITS
    .filter((u) => u.family === faction && unlocked.has(u.id) && u.tier <= maxTier)
    .sort((a, b) => b.tier - a.tier);
  if (roster.length === 0) return;
  const cx = run.map.core.x, cy = run.map.core.y;
  // Place units closest-to-core first so the core is screened by defenders.
  const tiles = Object.keys(run.map.tiles).sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return (Math.abs(ax - cx) + Math.abs(ay - cy)) - (Math.abs(bx - cx) + Math.abs(by - cy));
  });
  let stuck = 0;
  while (stuck < roster.length + 1) {
    const cap = capacityMax(run), used = capacityUsed(run);
    if (used >= cap) break;
    let placed = false;
    for (const u of roster) {
      if (used + spaceCost(u.tier) > cap) continue;
      for (const k of tiles) {
        const [x, y] = k.split(",").map(Number);
        const t = run.map.tiles[k];
        if (t.state !== "floor" || t.unitId || t.trapId) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 1) continue;
        if (!placeUnit(run, u.id, x, y)) { placed = true; break; }
      }
      if (placed) break;
    }
    if (!placed) stuck++; else stuck = 0;
  }
}

function ratingOf(run: RunState): number {
  let r = 600 + run.core.level * 140 + run.units.length * 10;
  for (const u of run.units) {
    const def = UNITS.find((d) => d.id === u.defId);
    if (def) r += def.tier * 24;
  }
  return Math.round(r);
}

export function buildLadderBot(name: string, seed: number, targetCl: number, faction: Family): Snapshot {
  const run = createNewRun(`bot_${seed}`, [], seed);
  run.dp = 1e9;
  for (let i = 0; i < targetCl; i++) upgradeCore(run);
  buyFactionResearch(run, faction);
  digArena(run);
  fillUnits(run, faction);
  run.dp = 0;
  const rating = ratingOf(run);
  const endedAtWave = estimateWaveReached(run);
  return {
    id: `bot_${seed}`,
    uid: `bot_${seed}`,
    name,
    createdAt: 0,
    source: "retire",
    endedAtWave,
    rating,
    shareable: false,
    dungeon: { map: run.map, units: run.units, traps: run.traps, inventory: run.inventory, research: run.research, core: run.core },
    simVersion: SIM_VERSION,
  };
}

interface BotCfg { name: string; cl: number; faction: Family; }
const BOT_CONFIGS: BotCfg[] = [
  { name: "Recruit Volk", cl: 1, faction: "goblinoid" },
  { name: "Bonepicker Sram", cl: 2, faction: "undead" },
  { name: "Houndmaster Kel", cl: 3, faction: "beast" },
  { name: "Impwright Zoss", cl: 4, faction: "demon" },
  { name: "Gearwarden Tibb", cl: 5, faction: "construct" },
  { name: "Eye of Nurl", cl: 6, faction: "aberration" },
  { name: "Warband Gax", cl: 7, faction: "goblinoid" },
  { name: "Crypt Lord Mor", cl: 8, faction: "undead" },
  { name: "Beastlord Ru", cl: 9, faction: "beast" },
  { name: "Hellgate Vane", cl: 10, faction: "demon" },
  { name: "Forgeheart Dux", cl: 12, faction: "construct" },
  { name: "Voidcaller Xen", cl: 14, faction: "aberration" },
];

let cached: Snapshot[] | null = null;
/** The full ladder roster (memoized). Stable across the session. */
export function getLadderBots(): Snapshot[] {
  if (cached) return cached;
  cached = BOT_CONFIGS.map((c, i) => buildLadderBot(c.name, 7000 + i, c.cl, c.faction));
  cached.sort((a, b) => a.rating - b.rating);
  return cached;
}

// --- Rating (Elo-lite) -------------------------------------------------------
const K = 32;
export function expectedScore(myRating: number, oppRating: number): number {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}
/** Returns the rating delta for a result (score: win=1, draw=0.5, loss=0). */
export function ratingDelta(myRating: number, oppRating: number, score: number): number {
  return Math.round(K * (score - expectedScore(myRating, oppRating)));
}

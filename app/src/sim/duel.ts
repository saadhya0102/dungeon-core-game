import type { ResolvedStats, RunState, UnitDef, WaveDef, WaveInvader } from "./types";
import { createNewRun } from "./factory";
import { CONFIG, coreLevelRow } from "./config";
import { UNIT_BY_ID, UNITS } from "./content/units";
import { unitCost } from "./economy";
import { monsterStats } from "./combat";
import { groupTypeForSize, lateWaveScale } from "./wavegen";
import { makePRNG, hashSeed } from "./rng";
import { resolveStats } from "./power";
import { applyWaveResult } from "./progress";
import { resolveWave } from "./resolve";
import { BUILDINGS, MAX_BUILDING_LEVEL } from "./kingdom";
import type { BuildingLevels } from "./kingdom";
import { buyResearch, buyRoom, digTile, moveUnit, placeTrap, placeUnit, sellUnit, unlockedUnits, upgradeCore } from "./actions";

export const DUEL_WIN_SHARDS = 25;
export const DUEL_BUILD_MS = 55_000;
export const DUEL_FIRST_BUILD_MS = 75_000;
export const DUEL_REPLAY_MS = 11_000;
export const DUEL_SEND_LIMIT = 8;
export const DUEL_COMMAND_LIMIT = 80;

export interface DuelPlayer {
  run: RunState;
  sends: string[];
  ready: boolean;
  commands: number;
}

export interface DuelRoom {
  id: string;
  uids: string[];
  players: Record<string, DuelPlayer>;
  seed: number;
  wave: number;
  status: "waiting" | "playing" | "finished";
  buildAt: number;
  deadline: number;
  winner: string | null;
  lastRound: number;
}

export interface DuelRound {
  wave: number;
  boards: Record<string, RunState>;
  waves: Record<string, WaveDef>;
  hp: Record<string, number>;
  winner: string | null;
}

export type DuelAction =
  | { type: "dig" | "room"; x: number; y: number }
  | { type: "place" | "trap" | "move"; id: string; x: number; y: number }
  | { type: "research" | "rank" | "send" | "sell"; id: string }
  | { type: "core" | "ready" | "advance" | "surrender" };

export function newDuelPlayer(uid: string, seed: number, levels?: BuildingLevels): DuelPlayer {
  const run = createNewRun(uid, [], seed);
  run.dp = 210;
  run.buildings = {};
  for (const { id } of BUILDINGS) {
    const level = levels?.[id];
    if (Number.isInteger(level) && level! > 0) run.buildings[id] = Math.min(level!, MAX_BUILDING_LEVEL);
  }
  return { run, sends: [], ready: false, commands: 0 };
}

export const sendCost = (unit: UnitDef) => Math.max(8, Math.ceil(unitCost(unit) * 0.45));
export const rankCost = (unit: UnitDef, rank: number) => Math.ceil(unitCost(unit) * (0.45 + rank * 0.35));
export const sendUnlockWave = (unit: UnitDef) => 1 + (unit.tier - 1) * 3;
export const sendDelayMs = (unit: UnitDef) => 5_000 + ((unit.tier - 1) % 3) * 5_000;

export function sendAvailable(run: RunState, def: UnitDef, elapsed: number): boolean {
  return run.wave >= sendUnlockWave(def) && elapsed >= sendDelayMs(def)
    && def.tier <= coreLevelRow(run.core.level).maxUnitTier && unlockedUnits(run).has(def.id);
}

export function applyDuelAction(player: DuelPlayer, action: DuelAction, elapsed: number): string | null {
  if (player.ready) return "Your dungeon is locked for this round.";
  if (action.type === "ready") { player.ready = true; return null; }
  if (player.commands >= DUEL_COMMAND_LIMIT) return "Build action limit reached for this round.";
  const { run } = player;
  switch (action.type) {
    case "dig": return digTile(run, action.x, action.y);
    case "room": return buyRoom(run, action.x, action.y);
    case "place": return placeUnit(run, action.id, action.x, action.y);
    case "trap": return placeTrap(run, action.id, action.x, action.y);
    case "move": return moveUnit(run, action.id, action.x, action.y);
    case "sell": return sellUnit(run, action.id);
    case "research": return buyResearch(run, action.id);
    case "core": return upgradeCore(run);
    case "send":
    case "rank": {
      const def = Object.hasOwn(UNIT_BY_ID, action.id) ? UNIT_BY_ID[action.id] : undefined;
      if (!def || !unlockedUnits(run).has(def.id) || def.tier > coreLevelRow(run.core.level).maxUnitTier) {
        return "Research this monster and meet its core level requirement.";
      }
      const rank = run.monsterRanks?.[def.id] ?? 0;
      if (action.type === "rank") {
        if (rank >= 3) return "Monster rank is maxed.";
        const cost = rankCost(def, rank);
        if (run.dp < cost) return "Not enough DP.";
        run.dp -= cost;
        (run.monsterRanks ??= {})[def.id] = rank + 1;
      } else {
        if (!sendAvailable(run, def, elapsed)) return "Sending this monster has not unlocked yet.";
        if (player.sends.length >= DUEL_SEND_LIMIT) return "Send queue is full.";
        const cost = sendCost(def);
        if (run.dp < cost) return "Not enough DP.";
        run.dp -= cost;
        player.sends.push(def.id);
      }
      return null;
    }
    default: return "Unknown build action.";
  }
}

function scaleMonster(stats: ResolvedStats, multiplier: number) {
  return { ...stats, hp: stats.hp * multiplier, phys: stats.phys * multiplier, mag: stats.mag * multiplier, rng: stats.rng * multiplier };
}

function duelWave(seed: number, wave: number, attacker: DuelPlayer): WaveDef {
  const rng = makePRNG(hashSeed(seed, wave, 0xD0E1));
  const tier = Math.min(10, 1 + Math.floor((wave - 1) / 4));
  const pool = UNITS.filter((unit) => unit.tier === tier);
  const count = Math.min(32, 1 + Math.floor((wave - 1) / 3));
  const interval = CONFIG.TICKS_PER_SEC * 2;
  const invaders: WaveInvader[] = [];
  function add(def: UnitDef, stats: ResolvedStats, spawnTick: number) {
    invaders.push({ id: `duel_${wave}_${invaders.length}`, classId: def.id, tier: def.tier, isUnique: false, statMult: 1,
      monster: { stats, spawnTick } });
  }
  for (let i = 0; i < count; i++) {
    const def = rng.pick(pool);
    add(def, scaleMonster(resolveStats(def.stats), lateWaveScale(wave)), Math.floor(i / 3) * interval);
  }
  attacker.sends.forEach((id, i) => {
    const def = UNIT_BY_ID[id];
    if (def) add(def, monsterStats(attacker.run, def), (i + 1) * interval);
  });
  return { wave, seed, tierBand: [tier, tier], groupType: groupTypeForSize(invaders.length), invaders };
}

export function settleDuelRound(room: DuelRoom): DuelRound {
  const [a, b] = room.uids;
  const boards = { [a]: structuredClone(room.players[a].run), [b]: structuredClone(room.players[b].run) };
  const waves = { [a]: duelWave(room.seed, room.wave, room.players[b]), [b]: duelWave(room.seed, room.wave, room.players[a]) };
  const left = resolveWave(boards[a], waves[a]);
  const right = resolveWave(boards[b], waves[b]);
  const hp = { [a]: left.outcome.coreHpRemaining, [b]: right.outcome.coreHpRemaining };
  let winner: string | null = null;
  if (!left.outcome.coreSurvived || !right.outcome.coreSurvived) {
    if (left.outcome.coreSurvived !== right.outcome.coreSurvived) winner = left.outcome.coreSurvived ? a : b;
    else if (left.durationTicks !== right.durationTicks) winner = left.durationTicks > right.durationTicks ? a : b;
    room.status = "finished";
  }
  for (const [uid, timeline] of [[a, left], [b, right]] as const) {
    const player = room.players[uid];
    applyWaveResult(player.run, timeline);
    player.run.inventory = [];
    player.run.gearShop = [];
    player.sends = [];
    player.ready = false;
    player.commands = 0;
  }
  room.winner = winner;
  room.lastRound = room.wave;
  if (room.status === "playing") room.wave++;
  return { wave: room.lastRound, boards, waves, hp, winner };
}

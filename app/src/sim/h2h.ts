// ============================================================================
// Head-to-Head (asynchronous PvP) match resolution (docs/12). Pure &
// deterministic: built on top of the shared wave sim (resolveWave). No
// Date.now / Math.random in outcome-affecting paths.
// ============================================================================
import type {
  RunState, Snapshot, FrozenDungeon, WaveDef, WaveInvader, Timeline,
  Tier, Archetype, RunStats,
} from "./types";
import { CONFIG, SIM_VERSION } from "./config";
import { makePRNG, hashSeed } from "./rng";
import { resolveWave } from "./resolve";
import { generateWave, tierBand } from "./wavegen";
import { classForTier } from "./content/enemies";
import { powerScore } from "./power";

const ARCHES: Archetype[] = ["warrior", "archer", "mage", "rogue"];

function zeroStats(): RunStats {
  return {
    kills: 0, killsByTrap: 0, uniquesKilled: 0, roguesKilled: 0,
    dpEarned: 0, dpSpent: 0, wavesCleared: 0, bestWave: 0, drops: 0, flawlessWaves: 0,
  };
}

/** Power-score based threat cost of a single (statMult=1) adventurer. Mirrors wavegen. */
function classCost(cls: ReturnType<typeof classForTier>): number {
  return Math.max(4, Math.round((powerScore(cls.stats) / 100) * 4));
}

/**
 * Wrap a frozen dungeon snapshot into a minimal RunState suitable for
 * resolveWave. Deterministic placeholders for ids/timestamps.
 */
export function frozenToRun(dungeon: FrozenDungeon, seedRoot: number): RunState {
  return {
    id: `h2h_run_${seedRoot >>> 0}`,
    uid: "h2h",
    status: "active",
    createdAt: 0,
    updatedAt: 0,
    wave: 1,
    dp: 0,
    core: { ...dungeon.core },
    map: dungeon.map,
    units: dungeon.units,
    traps: dungeon.traps,
    inventory: dungeon.inventory,
    research: dungeon.research,
    gearShop: [],
    rngSeedRoot: seedRoot,
    modifiers: [],
    simVersion: SIM_VERSION,
    stats: zeroStats(),
  };
}

export interface H2HExtraBuy {
  archetype: Archetype;
  tier: Tier;
  count: number;
}

export interface H2HRoundResult {
  round: number;
  challengerSurvived: boolean;
  opponentSurvived: boolean;
  challengerCoreHp: number;
  opponentCoreHp: number;
  challengerTimeline: Timeline;
  opponentTimeline: Timeline;
}

export interface H2HMatchResult {
  winner: "challenger" | "opponent" | "draw";
  rounds: H2HRoundResult[];
  roundsSurvivedChallenger: number;
  roundsSurvivedOpponent: number;
}

/**
 * Build the single shared wave that both dungeons face in a round: the normal
 * generated wave, plus an escalating baseline of extra adventurers, plus any
 * extra adventurers bought via the interactive lever.
 */
export function buildSharedWave(
  round: number,
  matchSeed: number,
  maxCl: number,
  extraBuys: H2HExtraBuy[],
): WaveDef {
  const base = generateWave(round, matchSeed);
  const rng = makePRNG(hashSeed(matchSeed, round, 0xb45e));

  const band = tierBand(round + maxCl);
  const lo = Math.max(1, Math.min(10, band[0]));
  const hi = Math.max(lo, Math.min(10, band[1]));

  const invaders: WaveInvader[] = [...base.invaders];
  let counter = 0;
  const addInvader = (cls: ReturnType<typeof classForTier>): void => {
    invaders.push({
      id: `h2h_${round}_${counter++}`,
      classId: cls.id,
      tier: cls.tier,
      isUnique: false,
      statMult: 1,
    });
  };

  // Escalating baseline, spent on adventurers within the scaled tier band.
  let budget = Math.round(CONFIG.H2H_BASELINE_BASE * Math.pow(CONFIG.H2H_BASELINE_GROWTH, round - 1));
  let guard = 0;
  while (budget > 4 && guard < 1000) {
    guard++;
    const arch = rng.pick(ARCHES);
    const tier = (lo + rng.int(hi - lo + 1)) as Tier;
    let cls = classForTier(arch, tier);
    let cost = classCost(cls);
    if (cost > budget) {
      cls = classForTier(arch, lo as Tier);
      cost = classCost(cls);
      if (cost > budget) break;
    }
    addInvader(cls);
    budget -= cost;
  }

  // Extra adventurers bought for this round (attack both dungeons).
  for (const buy of extraBuys) {
    const cls = classForTier(buy.archetype, buy.tier);
    for (let k = 0; k < buy.count; k++) addInvader(cls);
  }

  return { ...base, invaders };
}

/**
 * Resolve one H2H round: build the shared wave once, then run it against each
 * dungeon with an independent per-side sub-seed (deterministic).
 */
export function resolveH2HRound(
  challenger: FrozenDungeon,
  opponent: FrozenDungeon,
  round: number,
  matchSeed: number,
  extraBuys: H2HExtraBuy[],
): H2HRoundResult {
  const maxCl = Math.max(challenger.core.level, opponent.core.level);
  const wave = buildSharedWave(round, matchSeed, maxCl, extraBuys);

  const challengerRun = frozenToRun(challenger, hashSeed(matchSeed, round, 1));
  const opponentRun = frozenToRun(opponent, hashSeed(matchSeed, round, 2));

  const challengerTimeline = resolveWave(challengerRun, wave);
  const opponentTimeline = resolveWave(opponentRun, wave);

  return {
    round,
    challengerSurvived: challengerTimeline.outcome.coreSurvived,
    opponentSurvived: opponentTimeline.outcome.coreSurvived,
    challengerCoreHp: challengerTimeline.outcome.coreHpRemaining,
    opponentCoreHp: opponentTimeline.outcome.coreHpRemaining,
    challengerTimeline,
    opponentTimeline,
  };
}

function tiebreak(challengerHp: number, opponentHp: number): "challenger" | "opponent" | "draw" {
  if (challengerHp > opponentHp) return "challenger";
  if (opponentHp > challengerHp) return "opponent";
  return "draw";
}

function defaultMatchSeed(a: string, b: string): number {
  const codes: number[] = [];
  for (const ch of a) codes.push(ch.charCodeAt(0));
  for (const ch of b) codes.push(ch.charCodeAt(0));
  return hashSeed(...codes);
}

/**
 * Resolve a full H2H match between two snapshots. Loops rounds until one core
 * dies (other wins), both die (tiebreak by core HP), or H2H_MAX_ROUNDS is
 * reached (tiebreak by core HP). Fully deterministic for given inputs.
 */
export function resolveH2HMatch(
  challenger: Snapshot,
  opponent: Snapshot,
  matchSeed?: number,
  getExtraBuys?: (round: number) => H2HExtraBuy[],
): H2HMatchResult {
  const seed = matchSeed ?? defaultMatchSeed(challenger.id, opponent.id);
  const buysFor = getExtraBuys ?? (() => [] as H2HExtraBuy[]);

  const rounds: H2HRoundResult[] = [];
  let roundsSurvivedChallenger = 0;
  let roundsSurvivedOpponent = 0;
  let winner: "challenger" | "opponent" | "draw" = "draw";

  for (let r = 1; r <= CONFIG.H2H_MAX_ROUNDS; r++) {
    const res = resolveH2HRound(challenger.dungeon, opponent.dungeon, r, seed, buysFor(r));
    rounds.push(res);
    if (res.challengerSurvived) roundsSurvivedChallenger++;
    if (res.opponentSurvived) roundsSurvivedOpponent++;

    const ch = res.challengerSurvived;
    const op = res.opponentSurvived;
    if (ch && op) continue; // both alive -> escalate next round
    if (ch && !op) { winner = "challenger"; break; }
    if (!ch && op) { winner = "opponent"; break; }
    // both cores died this round -> tiebreak by remaining core HP
    winner = tiebreak(res.challengerCoreHp, res.opponentCoreHp);
    break;
  }

  // Reached the round cap with both alive every round -> tiebreak by core HP.
  if (winner === "draw" && rounds.length > 0) {
    const last = rounds[rounds.length - 1];
    if (last.challengerSurvived && last.opponentSurvived) {
      winner = tiebreak(last.challengerCoreHp, last.opponentCoreHp);
    }
  }

  return { winner, rounds, roundsSurvivedChallenger, roundsSurvivedOpponent };
}

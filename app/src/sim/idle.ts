import type { RunState, Tier, Timeline, WaveDef } from "./types";
import { CONFIG, wardForCl } from "./config";
import { createNewRun } from "./factory";
import { classForTier } from "./content/enemies";
import { hashSeed, makePRNG } from "./rng";
import { resolveWave } from "./resolve";
import { groupTypeForSize } from "./wavegen";

export const IDLE_INTERVAL_MS = 30_000;
export const IDLE_PROMOTION_WINS = 3;
const PATTERNS = 3;
const ARCHETYPES = ["warrior", "archer", "mage", "rogue"] as const;

export interface IdleProgress {
  nextAt: number | null;
  attempts: number;
  wins: number;
  kills: number;
  earned: number;
  streak: number;
  bestDifficulty: number;
  lastWave: { difficulty: number; win: boolean; embers: number } | null;
}

export interface IdleReport {
  waves: number;
  wins: number;
  kills: number;
  embers: number;
}

export function createIdleRun(uid: string, seed?: number): RunState {
  const run = createNewRun(uid, [], seed);
  run.dp = 105;
  run.research.owned.push("res_basic_traps");
  run.idle = { nextAt: null, attempts: 0, wins: 0, kills: 0, earned: 0, streak: 0, bestDifficulty: 1, lastWave: null };
  return run;
}

function milestoneBonus(difficulty: number) {
  if (difficulty % 50 === 0) return 5;
  if (difficulty % 25 === 0) return 4;
  if (difficulty % 10 === 0) return 3;
  if (difficulty % 5 === 0) return 1;
  return 0;
}

export function idleWave(run: RunState, pattern = (run.idle?.attempts ?? 0) % PATTERNS): WaveDef {
  const difficulty = run.wave;
  const seed = hashSeed(run.rngSeedRoot, difficulty, pattern);
  const rng = makePRNG(seed);
  const bonus = milestoneBonus(difficulty);
  const tier = Math.min(10, 1 + Math.floor((difficulty - 1) / 9)) as Tier;
  const count = Math.min(36, 1 + Math.floor((difficulty - 1) / 4) + bonus);
  const strength = 1 + Math.max(0, difficulty - 35) * 0.009 + bonus * 0.035;
  const invaders = Array.from({ length: count }, (_, index) => {
    const leader = bonus >= 3 && index === 0;
    const cls = classForTier(rng.pick(ARCHETYPES), tier);
    return { id: `idle_${difficulty}_${index}`, classId: cls.id, tier, isUnique: leader, statMult: strength * (leader ? 1.35 : 1) };
  });
  return { wave: difficulty, seed, tierBand: [tier, tier], groupType: groupTypeForSize(count), invaders };
}

interface Encounter {
  win: boolean;
  kills: number;
  embers: number;
}

function fight(run: RunState, pattern: number, replay: boolean) {
  const wave = idleWave(run, pattern);
  const ward = wardForCl(run.core.level, run.core.maxHp);
  const refreshed = { ...run, rngSeedRoot: wave.seed, core: { ...run.core, hp: run.core.maxHp, wardMax: ward, ward } };
  const timeline = resolveWave(refreshed, wave, { captureFrames: replay, tickLimit: CONFIG.TICKS_PER_SEC * IDLE_INTERVAL_MS / 1000 });
  const win = timeline.outcome.coreSurvived && timeline.reward.killCount === wave.invaders.length;
  const kills = timeline.reward.killCount;
  const result = { win, kills, embers: 2 + kills + (win ? 3 + Math.floor(Math.sqrt(run.wave)) : 0) };
  return { result, timeline };
}

function credit(run: RunState, outcomes: Encounter[], cycles: number, report: IdleReport) {
  const state = run.idle!;
  const victories = outcomes.filter((result) => result.win).length * cycles;
  const waves = outcomes.length * cycles;
  const embers = outcomes.reduce((total, result) => total + result.embers, 0) * cycles;
  const kills = outcomes.reduce((total, result) => total + result.kills, 0) * cycles;
  state.attempts += waves;
  state.wins += victories;
  state.earned += embers;
  state.kills += kills;
  if (victories === waves) {
    state.streak = Math.min(IDLE_PROMOTION_WINS, state.streak + waves);
  } else {
    state.streak = 0;
    for (let i = outcomes.length - 1; i >= 0 && outcomes[i].win; i--) state.streak++;
  }
  const last = outcomes[outcomes.length - 1];
  state.lastWave = { difficulty: run.wave, win: last.win, embers: last.embers };
  state.nextAt! += waves * IDLE_INTERVAL_MS;
  run.dp += embers;
  if (!last.win) run.wave = Math.max(1, run.wave - 1);
  report.waves += waves;
  report.wins += victories;
  report.kills += kills;
  report.embers += embers;
}

/** Each layout faces three repeating patterns per difficulty while unattended. */
export function advanceIdle(run: RunState, now: number, showReplay = false): { report: IdleReport; timeline?: Timeline } {
  const state = run.idle;
  const report = { waves: 0, wins: 0, kills: 0, embers: 0 };
  if (state?.nextAt == null || now < state.nextAt) return { report };
  let remaining = 1 + Math.floor((now - state.nextAt) / IDLE_INTERVAL_MS);
  if (remaining === 1 && showReplay) {
    const { result, timeline } = fight(run, state.attempts % PATTERNS, true);
    credit(run, [result], 1, report);
    return { report, timeline };
  }

  let difficulty = run.wave;
  const patterns = new Map<number, Encounter>();
  while (remaining > 0) {
    if (run.wave !== difficulty) {
      difficulty = run.wave;
      patterns.clear();
    }
    const pattern = state.attempts % PATTERNS;
    if (remaining >= PATTERNS && patterns.size === PATTERNS) {
      const cycle = Array.from({ length: PATTERNS }, (_, index) => patterns.get((pattern + index) % PATTERNS)!);
      if (run.wave === 1 || cycle.every((result) => result.win)) {
        const cycles = Math.floor(remaining / PATTERNS);
        credit(run, cycle, cycles, report);
        remaining -= cycles * PATTERNS;
        continue;
      }
    }
    const result = patterns.get(pattern) ?? fight(run, pattern, false).result;
    patterns.set(pattern, result);
    credit(run, [result], 1, report);
    remaining--;
  }
  return { report };
}

export function promoteIdle(run: RunState): boolean {
  const state = run.idle;
  if (!state || state.streak < IDLE_PROMOTION_WINS) return false;
  run.wave++;
  state.streak = 0;
  state.bestDifficulty = Math.max(state.bestDifficulty, run.wave);
  return true;
}

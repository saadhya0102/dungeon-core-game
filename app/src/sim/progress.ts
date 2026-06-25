// ============================================================================
// Apply a resolved wave to the run state (docs/01 §2.3, 13). Shared logic.
// ============================================================================
import type { RunState, Timeline } from "./types";
import { coreLevelRow, wardForCl } from "./config";
import { CLASS_BY_ID } from "./content/enemies";

export interface WaveApplyResult {
  died: boolean;
  dpGained: number;
  killCount: number;
  flawless: boolean;
}

export function applyWaveResult(run: RunState, tl: Timeline): WaveApplyResult {
  // Core damage: sim started with hp+ward; coreHpRemaining is the remainder.
  const startTotal = run.core.hp + run.core.ward;
  const remaining = tl.outcome.coreHpRemaining;
  const damage = Math.max(0, startTotal - remaining);
  let ward = run.core.ward;
  let hp = run.core.hp;
  const wardHit = Math.min(ward, damage);
  ward -= wardHit;
  hp -= Math.max(0, damage - wardHit);
  run.core.ward = ward;
  run.core.hp = Math.max(0, hp);

  const died = run.core.hp <= 0;

  // Rewards
  run.dp += tl.reward.dp;
  run.stats.dpEarned += tl.reward.dp;
  for (const item of tl.reward.drops) run.inventory.push(item);
  run.stats.drops += tl.reward.drops.length;

  // Counters from events (for achievements)
  let trapKills = 0;
  let rogueKills = 0;
  let uniqueKills = 0;
  let waveKills = 0;
  // map invader id -> {trapHit, isRogue, isUnique}
  const lastHitByTrap = new Set<string>();
  for (const ev of tl.events) {
    if (ev.type === "hit" && ev.data?.trap && ev.targetId) lastHitByTrap.add(ev.targetId);
    if (ev.type === "death" && ev.data?.side === "invader" && ev.targetId && !ev.targetId.includes("_add_")) {
      waveKills++;
      if (lastHitByTrap.has(ev.targetId)) trapKills++;
    }
  }
  // rogue/unique from spawn events
  const spawnInfo = new Map<string, { arch?: string; unique?: boolean }>();
  for (const ev of tl.events) {
    if (ev.type === "spawn" && ev.sourceId) {
      const defId = ev.data?.defId as string | undefined;
      const cls = defId ? CLASS_BY_ID[defId] : undefined;
      spawnInfo.set(ev.sourceId, { arch: cls?.archetype, unique: ev.data?.isUnique as boolean });
    }
  }
  for (const ev of tl.events) {
    if (ev.type === "death" && ev.data?.side === "invader" && ev.targetId) {
      const info = spawnInfo.get(ev.targetId);
      if (info?.arch === "rogue") rogueKills++;
      if (info?.unique) uniqueKills++;
    }
  }

  run.stats.kills += waveKills;
  run.stats.killsByTrap += trapKills;
  run.stats.roguesKilled += rogueKills;
  run.stats.uniquesKilled += uniqueKills;
  if ((run.stats.biggestWaveKills ?? 0) < waveKills) run.stats.biggestWaveKills = waveKills;
  if ((run.stats.maxDpHeld ?? 0) < run.dp) run.stats.maxDpHeld = run.dp;

  const flawless = !tl.events.some((e) => e.type === "coreHit");
  if (tl.outcome.coreSurvived) {
    run.stats.wavesCleared += 1;
    if (flawless) run.stats.flawlessWaves += 1;
  }

  if (!died && tl.outcome.coreSurvived) {
    run.wave += 1;
    if (run.wave - 1 > run.stats.bestWave) run.stats.bestWave = run.wave - 1;
    // regen ward between waves
    run.core.wardMax = wardForCl(run.core.level, run.core.maxHp);
    run.core.ward = run.core.wardMax;
  } else if (died) {
    run.status = "ended";
  }

  // misc run counters for achievements
  run.stats.coreLevel = run.core.level;
  run.stats.tilesOpened = run.map.openedCount;
  run.stats.researchOwned = run.research.owned.length;
  run.stats.inventorySize = run.inventory.length;
  run.updatedAt = Date.now();

  return { died, dpGained: tl.reward.dp, killCount: tl.reward.killCount, flawless };
}

export function capForRun(run: RunState): { sizeCap: number; maxUnitTier: number } {
  const row = coreLevelRow(run.core.level);
  return { sizeCap: row.sizeCap, maxUnitTier: row.maxUnitTier };
}

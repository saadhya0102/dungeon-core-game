// ============================================================================
// Pure achievement evaluation engine (docs/13). No DOM/React/storage deps.
// Maps run/lifetime counters against the ACHIEVEMENTS catalog.
// ============================================================================
import { ACHIEVEMENTS } from "../sim/content/achievements";

export interface AchProgress {
  id: string;
  unlocked: boolean;
  current: number;
  target: number;
}

/**
 * Evaluate every achievement against a flat counter map.
 *
 * @param counters         combined counter map (see mergeCounters)
 * @param alreadyUnlocked  map of previously-unlocked achievement ids
 * @returns newlyUnlocked ids (met gte this evaluation, not previously unlocked)
 *          and progress for all achievements in catalog order.
 */
export function evaluateAchievements(
  counters: Record<string, number>,
  alreadyUnlocked: Record<string, number>,
): { newlyUnlocked: string[]; progress: AchProgress[] } {
  const newlyUnlocked: string[] = [];
  const progress: AchProgress[] = [];

  for (const def of ACHIEVEMENTS) {
    const current = counters[def.condition.counter] ?? 0;
    const target = def.condition.gte;
    const meets = current >= target;
    const wasUnlocked = Object.prototype.hasOwnProperty.call(alreadyUnlocked, def.id);

    if (meets && !wasUnlocked) newlyUnlocked.push(def.id);

    progress.push({ id: def.id, unlocked: meets || wasUnlocked, current, target });
  }

  return { newlyUnlocked, progress };
}

/**
 * Build a single counter map from run + lifetime sources, picking the source
 * appropriate to each achievement's scope. When two achievements reference the
 * same counter under different scopes, keep the larger value (deterministic).
 */
export function mergeCounters(
  runStats: Record<string, number>,
  lifetime: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const def of ACHIEVEMENTS) {
    const counter = def.condition.counter;
    const value = def.condition.scope === "lifetime"
      ? (lifetime[counter] ?? 0)
      : (runStats[counter] ?? 0);
    const existing = result[counter];
    result[counter] = existing === undefined ? value : Math.max(existing, value);
  }

  return result;
}

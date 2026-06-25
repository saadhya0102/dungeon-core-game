// Ability shorthand helpers (docs/04 §6, 19 §9)
import type { Ability, AbilityEffectKind, AbilityTrigger, AffinityType, Affinities } from "../types";
import { AFFINITY_BANDS } from "../types";

let abCounter = 0;
export function ab(
  effect: AbilityEffectKind,
  trigger: AbilityTrigger = "passive",
  params?: Record<string, number>,
  radius?: number,
): Ability {
  return { id: `ab_${effect}_${abCounter++}`, effect, trigger, params, radius };
}

/** Build affinities from band letters. Unspecified -> neutral (1.0 implied). */
export function aff(
  melee?: string, ranged?: string, arcane?: string,
  extra?: Partial<Record<AffinityType, string>>,
): Affinities {
  const out: Affinities = {};
  if (melee) out.melee = AFFINITY_BANDS[melee];
  if (ranged) out.ranged = AFFINITY_BANDS[ranged];
  if (arcane) out.arcane = AFFINITY_BANDS[arcane];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      out[k as AffinityType] = AFFINITY_BANDS[v as string];
    }
  }
  return out;
}

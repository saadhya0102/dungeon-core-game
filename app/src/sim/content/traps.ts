// ============================================================================
// Trap catalog (docs/08, 19 §6). Damage anchored to tier power budget.
// ============================================================================
import type { TrapDef, Tier, TrapEffect, TrapCategory, TrapTrigger } from "../types";
import { tierBudget } from "../config";
import { gearPrice } from "../economy";

interface TEntry {
  id: string; name: string; tier: Tier; category: TrapCategory; trigger: TrapTrigger;
  hidden: number; radius?: number; charges: number | "infinite"; cooldown: number;
  consumable: boolean; dmgFactor?: number; effect: Omit<TrapEffect, "damage">;
}

const T: TEntry[] = [
  { id: "trap_spike_pit", name: "Spike Pit", tier: 1, category: "damage", trigger: "step", hidden: 35, charges: 3, cooldown: 20, consumable: false, dmgFactor: 0.55, effect: { damageType: "melee" } },
  { id: "trap_dart", name: "Dart Trap", tier: 1, category: "damage", trigger: "proximity", hidden: 45, radius: 1, charges: 4, cooldown: 15, consumable: false, dmgFactor: 0.3, effect: { damageType: "ranged" } },
  { id: "trap_snare", name: "Snare", tier: 1, category: "control", trigger: "step", hidden: 40, charges: 3, cooldown: 25, consumable: false, effect: { status: { kind: "root", magnitude: 1, durationTicks: 20 } } },
  { id: "trap_caltrops", name: "Caltrops", tier: 2, category: "debuff", trigger: "step", hidden: 50, charges: "infinite", cooldown: 5, consumable: false, dmgFactor: 0.1, effect: { damageType: "true", status: { kind: "slow", magnitude: 0.4, durationTicks: 20 } } },
  { id: "trap_firejet", name: "Flame Jet", tier: 2, category: "damage", trigger: "proximity", hidden: 48, radius: 1, charges: 3, cooldown: 20, consumable: false, dmgFactor: 0.5, effect: { damageType: "fire", status: { kind: "burn", magnitude: 4, durationTicks: 30 } } },
  { id: "trap_net", name: "Net Trap", tier: 2, category: "control", trigger: "step", hidden: 55, charges: 2, cooldown: 30, consumable: false, effect: { stripDodge: true, status: { kind: "root", magnitude: 1, durationTicks: 25 } } },
  { id: "trap_poisongas", name: "Poison Cloud", tier: 3, category: "debuff", trigger: "proximity", hidden: 55, radius: 2, charges: 2, cooldown: 30, consumable: false, effect: { status: { kind: "poison", magnitude: 8, durationTicks: 40 } } },
  { id: "trap_boulder", name: "Rolling Boulder", tier: 3, category: "damage", trigger: "tripwire", hidden: 50, charges: 1, cooldown: 999, consumable: true, dmgFactor: 1.4, effect: { damageType: "melee" } },
  { id: "trap_glyph_silence", name: "Silencing Glyph", tier: 3, category: "special", trigger: "proximity", hidden: 65, radius: 1, charges: 3, cooldown: 30, consumable: false, effect: { silence: true, status: { kind: "silence", magnitude: 1, durationTicks: 30 } } },
  { id: "trap_revealward", name: "Truesight Ward", tier: 3, category: "special", trigger: "proximity", hidden: 70, radius: 2, charges: "infinite", cooldown: 5, consumable: false, effect: { reveal: true, stripDodge: true } },
  { id: "trap_frost", name: "Frost Trap", tier: 4, category: "control", trigger: "proximity", hidden: 58, radius: 2, charges: 3, cooldown: 25, consumable: false, dmgFactor: 0.25, effect: { damageType: "frost", status: { kind: "slow", magnitude: 0.5, durationTicks: 30 } } },
  { id: "trap_arcane_mine", name: "Arcane Mine", tier: 4, category: "damage", trigger: "step", hidden: 62, charges: 3, cooldown: 20, consumable: false, dmgFactor: 0.7, effect: { damageType: "arcane" } },
  { id: "trap_pitfall", name: "Collapsing Floor", tier: 5, category: "special", trigger: "step", hidden: 68, charges: 1, cooldown: 999, consumable: true, dmgFactor: 1.6, effect: { damageType: "true", removeTarget: true } },
  { id: "trap_lightning", name: "Chain Lightning Rune", tier: 5, category: "damage", trigger: "proximity", hidden: 66, radius: 2, charges: 2, cooldown: 25, consumable: false, dmgFactor: 0.6, effect: { damageType: "arcane" } },
  { id: "trap_curse", name: "Curse Sigil", tier: 6, category: "debuff", trigger: "proximity", hidden: 72, radius: 2, charges: "infinite", cooldown: 8, consumable: false, effect: { status: { kind: "debuffStat", magnitude: -0.2, durationTicks: 40, stat: "phys" } } },
  { id: "trap_banish", name: "Banishment Circle", tier: 7, category: "special", trigger: "step", hidden: 78, charges: 2, cooldown: 40, consumable: false, effect: { teleportToEntrance: true } },
  { id: "trap_hellfire", name: "Hellfire Array", tier: 8, category: "damage", trigger: "proximity", hidden: 80, radius: 3, charges: 2, cooldown: 30, consumable: false, dmgFactor: 0.9, effect: { damageType: "fire", status: { kind: "burn", magnitude: 30, durationTicks: 40 } } },
  { id: "trap_voidrift", name: "Void Rift", tier: 9, category: "special", trigger: "proximity", hidden: 85, radius: 2, charges: 1, cooldown: 999, consumable: true, dmgFactor: 1.2, effect: { damageType: "arcane", pull: true, status: { kind: "debuffStat", magnitude: -0.3, durationTicks: 40, stat: "mres" } } },
  { id: "trap_annihilation", name: "Annihilation Glyph", tier: 10, category: "damage", trigger: "proximity", hidden: 92, radius: 3, charges: 1, cooldown: 999, consumable: true, dmgFactor: 1.8, effect: { damageType: "true" } },
];

export const TRAPS: TrapDef[] = T.map((t) => ({
  id: t.id,
  name: t.name,
  tier: t.tier,
  category: t.category,
  trigger: t.trigger,
  hiddenRating: t.hidden,
  radius: t.radius,
  charges: t.charges,
  cooldownTicks: t.cooldown,
  consumable: t.consumable,
  effect: {
    ...t.effect,
    damage: t.dmgFactor ? Math.round(tierBudget(t.tier) * t.dmgFactor) : undefined,
  },
  cost: Math.max(8, Math.round(gearPrice(t.tier, "common") * 0.8)),
}));

export const TRAP_BY_ID: Record<string, TrapDef> = Object.fromEntries(
  TRAPS.map((t) => [t.id, t]),
);

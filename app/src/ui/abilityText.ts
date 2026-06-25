// Human-friendly names + short descriptions for unit abilities (UI only).
import type { Ability, AbilityEffectKind } from "../sim/types";

const INFO: Record<AbilityEffectKind, { name: string; desc: string }> = {
  cleave: { name: "Cleave", desc: "Hits enemies right beside the target." },
  splash: { name: "Splash", desc: "Damages enemies around the target." },
  bigAoe: { name: "Big AoE", desc: "Its splash hits a much larger area." },
  slowOnHit: { name: "Slow", desc: "Attacks slow the enemy down." },
  poisonDot: { name: "Poison", desc: "Attacks poison: damage over time." },
  burnOnHit: { name: "Burn", desc: "Attacks set foes on fire: damage over time." },
  bleedOnHit: { name: "Bleed", desc: "Attacks cause bleeding: damage over time." },
  freezeOnHit: { name: "Freeze", desc: "Attacks briefly freeze foes solid (can't act)." },
  auraBuff: { name: "Aura", desc: "Buffs nearby allied units." },
  partyBuff: { name: "Warcry", desc: "Buffs nearby allies' stats." },
  fear: { name: "Fear", desc: "Unsettles nearby enemies." },
  summon: { name: "Summon", desc: "Calls extra minions at wave start." },
  petSummon: { name: "Companion", desc: "Brings a pet into the fight." },
  shieldOnWaveStart: { name: "Shielded", desc: "Starts each wave with a shield." },
  executeLowHp: { name: "Execute", desc: "Bonus damage to low-health foes." },
  firstStrike: { name: "First Strike", desc: "Huge bonus damage on its first hit." },
  healAlly: { name: "Healer", desc: "Heals wounded allies over time." },
  healAtHalf: { name: "Second Wind", desc: "Heals itself once when it drops below half HP." },
  explodeOnDeath: { name: "Volatile", desc: "Explodes for AoE damage when it dies." },
  berserk: { name: "Berserk", desc: "Attacks faster & harder below half HP (red aura)." },
  dash: { name: "Dash", desc: "Moves fast to close on the enemy." },
  invis: { name: "Stealth", desc: "Turns near-invisible \u2014 very hard to hit." },
  thorns: { name: "Thorns", desc: "Reflects damage back to attackers." },
  longRange: { name: "Long Range", desc: "Attacks from extra distance." },
  blink: { name: "Blink", desc: "Teleports around the battlefield." },
  confuse: { name: "Confuse", desc: "Scrambles enemy targeting." },
  reviveSelf: { name: "Undying", desc: "Revives once per wave." },
};

export function abilityInfo(effect: AbilityEffectKind): { name: string; desc: string } {
  return INFO[effect] ?? { name: effect, desc: "" };
}

/** Deduped list of ability infos for a unit's ability array. */
export function abilityList(abilities: Ability[] | undefined): { name: string; desc: string }[] {
  if (!abilities || abilities.length === 0) return [];
  const seen = new Set<string>();
  const out: { name: string; desc: string }[] = [];
  for (const a of abilities) {
    if (seen.has(a.effect)) continue;
    seen.add(a.effect);
    out.push(abilityInfo(a.effect));
  }
  return out;
}

/** Combined "Name: desc" lines for a tooltip title attribute. */
export function abilityTooltip(abilities: Ability[] | undefined): string {
  return abilityList(abilities).map((a) => `${a.name}: ${a.desc}`).join("\n");
}

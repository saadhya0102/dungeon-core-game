import type { AbilityEffectKind } from "../../sim/types";

type Pattern = "ring" | "slash" | "cross" | "shards" | "embers" | "spiral";
interface Visual { color: number; pattern: Pattern }

const VISUALS: Record<AbilityEffectKind, Visual> = {
  cleave: { color: 0xffd7a4, pattern: "slash" },
  splash: { color: 0xb99afa, pattern: "ring" },
  bigAoe: { color: 0xb99afa, pattern: "ring" },
  slowOnHit: { color: 0x85c5e9, pattern: "ring" },
  poisonDot: { color: 0xa7df58, pattern: "embers" },
  burnOnHit: { color: 0xff9b4a, pattern: "embers" },
  bleedOnHit: { color: 0xff737b, pattern: "slash" },
  freezeOnHit: { color: 0xa8edff, pattern: "shards" },
  auraBuff: { color: 0xf5d17e, pattern: "ring" },
  partyBuff: { color: 0xf5b974, pattern: "ring" },
  fear: { color: 0xc29beb, pattern: "spiral" },
  summon: { color: 0xba92ff, pattern: "spiral" },
  petSummon: { color: 0xa8e29b, pattern: "spiral" },
  shieldOnWaveStart: { color: 0x8fdbef, pattern: "shards" },
  executeLowHp: { color: 0xff765f, pattern: "slash" },
  firstStrike: { color: 0xffe39a, pattern: "slash" },
  healAlly: { color: 0xabed8e, pattern: "cross" },
  healAtHalf: { color: 0xc9ed8e, pattern: "cross" },
  explodeOnDeath: { color: 0xff984e, pattern: "embers" },
  berserk: { color: 0xff8064, pattern: "ring" },
  dash: { color: 0xf5dcb1, pattern: "slash" },
  invis: { color: 0xaa9ce4, pattern: "spiral" },
  thorns: { color: 0xc3db8d, pattern: "shards" },
  longRange: { color: 0xd6ecc1, pattern: "ring" },
  blink: { color: 0xa8c6ff, pattern: "spiral" },
  confuse: { color: 0xfb91db, pattern: "spiral" },
  reviveSelf: { color: 0x9eebd4, pattern: "cross" },
};

export function abilityVisual(effect: unknown): Visual | undefined {
  return typeof effect === "string" && Object.hasOwn(VISUALS, effect) ? VISUALS[effect as AbilityEffectKind] : undefined;
}

const CASTS = new Set<unknown>(["auraBuff", "partyBuff", "summon", "petSummon", "healAlly", "healAtHalf", "shieldOnWaveStart", "berserk"]);
export const playsCastPose = (effect: unknown) => CASTS.has(effect);

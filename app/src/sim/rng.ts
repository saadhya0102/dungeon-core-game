// ============================================================================
// Seeded deterministic PRNG (docs/10 §1). mulberry32 - fast, deterministic.
// ============================================================================

export interface PRNG {
  next(): number;            // [0,1)
  int(maxExclusive: number): number;
  range(min: number, max: number): number; // [min,max) float
  pick<T>(arr: T[]): T;
  weighted<T>(items: T[], weights: number[]): T;
  bool(p: number): boolean;
  fork(salt: number): PRNG;
}

export function hashSeed(...nums: number[]): number {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    h ^= n >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makePRNG(seed: number): PRNG {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const prng: PRNG = {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    range: (min: number, max: number) => min + next() * (max - min),
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T>(items: T[], weights: number[]): T => {
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    bool: (p: number) => next() < p,
    fork: (salt: number) => makePRNG(hashSeed(seed, salt)),
  };
  return prng;
}

import { describe, it, expect } from "vitest";
import { autoRun } from "./balance";
import { FAMILIES } from "./types";

// A naive single-faction auto-player should still survive a reasonable number
// of waves with every faction (no faction is a dead end), and skilled/mixed
// play (gear, traps, better placement) goes considerably further.
describe("balance: per-faction auto-run depth", () => {
  it("every faction reaches a reasonable depth", () => {
    const seeds = [1, 7, 13, 42, 99, 123];
    for (const f of FAMILIES) {
      const waves = seeds.map((s) => autoRun(s, 60, f).wave);
      const avg = waves.reduce((a, b) => a + b, 0) / waves.length;
      // each faction's naive auto-run should clear at least ~wave 10 on average
      expect(avg, `faction ${f} avg wave`).toBeGreaterThan(9);
    }
  });
});

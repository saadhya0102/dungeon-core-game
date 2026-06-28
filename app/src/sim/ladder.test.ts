import { describe, it, expect } from "vitest";
import { getLadderBots, buildLadderBot } from "./ladder";
import { resolveH2HMatch } from "./h2h";

describe("ladder bots", () => {
  it("builds a roster of dungeons that actually have units", () => {
    const bots = getLadderBots();
    expect(bots.length).toBeGreaterThan(6);
    for (const b of bots) {
      expect(b.dungeon.units.length).toBeGreaterThan(0);
      expect(b.rating).toBeGreaterThan(0);
    }
    // ratings should be monotonic-ish (sorted ascending)
    for (let i = 1; i < bots.length; i++) expect(bots[i].rating).toBeGreaterThanOrEqual(bots[0].rating);
  });

  it("H2H produces non-empty timelines for BOTH sides every round", () => {
    const a = buildLadderBot("A", 11, 6, "goblinoid");
    const b = buildLadderBot("B", 22, 6, "undead");
    const result = resolveH2HMatch(a, b);
    expect(result.rounds.length).toBeGreaterThan(0);
    for (const r of result.rounds) {
      expect(r.challengerTimeline.frames.length).toBeGreaterThan(0);
      expect(r.challengerTimeline.durationTicks).toBeGreaterThan(0);
      expect(r.opponentTimeline.frames.length).toBeGreaterThan(0);
      expect(r.opponentTimeline.durationTicks).toBeGreaterThan(0);
    }
  });

  it("is deterministic (same inputs -> same winner)", () => {
    const a = buildLadderBot("A", 5, 5, "beast");
    const b = buildLadderBot("B", 6, 5, "demon");
    const r1 = resolveH2HMatch(a, b, 12345);
    const r2 = resolveH2HMatch(a, b, 12345);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.rounds.length).toBe(r2.rounds.length);
  });
});

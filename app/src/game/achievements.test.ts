import { describe, it, expect } from "vitest";
import { evaluateAchievements, mergeCounters } from "./achievements";
import { ACHIEVEMENTS } from "../sim/content/achievements";

describe("evaluateAchievements", () => {
  it("flags achievements whose counters meet the threshold", () => {
    const counters = { kills: 1, bestWave: 10 };
    const { newlyUnlocked } = evaluateAchievements(counters, {});
    expect(newlyUnlocked).toContain("first_blood");
    expect(newlyUnlocked).toContain("wave_10");
    expect(newlyUnlocked).not.toContain("wave_25");
  });

  it("does not exceed catalog ids and excludes already-unlocked ones", () => {
    const counters = { kills: 1, bestWave: 10 };
    const { newlyUnlocked } = evaluateAchievements(counters, { first_blood: Date.now() });
    expect(newlyUnlocked).not.toContain("first_blood");
    expect(newlyUnlocked).toContain("wave_10");
  });

  it("marks already-unlocked achievements as unlocked even below threshold", () => {
    const { progress } = evaluateAchievements({}, { first_blood: 123 });
    const fb = progress.find((p) => p.id === "first_blood");
    expect(fb).toBeDefined();
    expect(fb!.unlocked).toBe(true);
    expect(fb!.current).toBe(0);
  });

  it("returns progress for every achievement in the catalog", () => {
    const { progress } = evaluateAchievements({ kills: 5 }, {});
    expect(progress.length).toBe(ACHIEVEMENTS.length);
    const ids = new Set(progress.map((p) => p.id));
    for (const def of ACHIEVEMENTS) expect(ids.has(def.id)).toBe(true);
  });

  it("reports current/target from the counter map", () => {
    const { progress } = evaluateAchievements({ bestWave: 30 }, {});
    const w25 = progress.find((p) => p.id === "wave_25")!;
    expect(w25.current).toBe(30);
    expect(w25.target).toBe(25);
    expect(w25.unlocked).toBe(true);
  });
});

describe("mergeCounters", () => {
  it("picks run source for run-scoped counters and lifetime for lifetime-scoped", () => {
    const runStats = { coreLevel: 5, kills: 3 };
    const lifetime = { coreLevel: 99, kills: 700 };
    const merged = mergeCounters(runStats, lifetime);
    // coreLevel achievements are run-scoped -> use runStats value
    expect(merged.coreLevel).toBe(5);
    // kills achievements are lifetime-scoped -> use lifetime value
    expect(merged.kills).toBe(700);
  });

  it("defaults missing counters to zero", () => {
    const merged = mergeCounters({}, {});
    expect(merged.kills).toBe(0);
    expect(merged.coreLevel).toBe(0);
  });

  it("feeds cleanly into evaluateAchievements", () => {
    const merged = mergeCounters({ coreLevel: 10 }, { kills: 1 });
    const { newlyUnlocked } = evaluateAchievements(merged, {});
    expect(newlyUnlocked).toContain("first_blood"); // kills >= 1 (lifetime)
    expect(newlyUnlocked).toContain("cl_5");         // coreLevel >= 5 (run)
    expect(newlyUnlocked).toContain("cl_10");        // coreLevel >= 10 (run)
  });
});

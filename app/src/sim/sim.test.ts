import { describe, it, expect } from "vitest";
import { validateContent } from "./content";
import { UNITS } from "./content/units";
import { CLASSES } from "./content/enemies";
import { tierOf } from "./power";
import { generateWave } from "./wavegen";
import { resolveWave } from "./resolve";
import { createNewRun, placeUnit } from "./index";

describe("content validity", () => {
  it("has no content issues", () => {
    const issues = validateContent();
    if (issues.length) console.error(issues);
    expect(issues).toEqual([]);
  });
  it("every unit computes to its declared tier", () => {
    for (const u of UNITS) expect(tierOf(u.stats)).toBe(u.tier);
  });
  it("every class computes to its declared tier", () => {
    for (const c of CLASSES) expect(tierOf(c.stats)).toBe(c.tier);
  });
});

describe("wavegen determinism", () => {
  it("same (wave,seed) -> identical wave", () => {
    const a = generateWave(7, 12345);
    const b = generateWave(7, 12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("produces non-empty waves and respects tier band", () => {
    for (let w = 1; w <= 50; w++) {
      const wd = generateWave(w, 999);
      expect(wd.invaders.length).toBeGreaterThan(0);
      for (const inv of wd.invaders) {
        expect(inv.tier).toBeGreaterThanOrEqual(1);
        expect(inv.tier).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("resolve determinism", () => {
  it("same run -> identical timeline", () => {
    const run = createNewRun("test", [], 42);
    placeUnit(run, "gob_grunt", 30, 31);
    placeUnit(run, "gob_archer", 30, 29);
    const t1 = resolveWave(run);
    const t2 = resolveWave(run);
    expect(t1.outcome).toEqual(t2.outcome);
    expect(t1.events.length).toBe(t2.events.length);
    expect(t1.reward.dp).toBe(t2.reward.dp);
  });
  it("a basic dungeon clears wave 1", () => {
    const run = createNewRun("test", [], 7);
    placeUnit(run, "gob_grunt", 31, 31);
    placeUnit(run, "gob_grunt", 30, 31);
    placeUnit(run, "gob_archer", 31, 30);
    const tl = resolveWave(run);
    expect(tl.outcome.coreSurvived).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { CLASSES, CLASS_BY_ID, UNIQUES } from "../../sim/content/enemies";
import { UNITS } from "../../sim/content/units";
import { createNewRun } from "../../sim/factory";
import { resolveWave } from "../../sim/resolve";
import { characterDesign } from "./characters";
import { FRAMES, renderCharacterFrame } from "./pixels";
import type { CharacterClip } from "./pixels";

function frameKey(data: Uint8ClampedArray): number {
  return data.reduce((hash, byte) => Math.imul(hash ^ byte, 16777619) >>> 0, 2166136261);
}

describe("pixel character sheets", () => {
  it("gives every recruit, adventurer, and named champion a distinct idle frame", () => {
    const entries = [...UNITS, ...CLASSES, ...UNIQUES];
    const images = entries.map(({ id }) => {
      const design = characterDesign(id);
      expect(design, id).toBeDefined();
      return frameKey(renderCharacterFrame(design!, "idle", 0));
    });
    expect(new Set(images).size).toBe(entries.length);
  });

  it("draws different silhouettes for consecutive frames in each action and form", () => {
    for (const id of ["gob_grunt", "und_skeleton", "bst_direwolf", "bst_giantspider", "bst_wyvern",
      "bst_worldserpent", "abr_ooze", "abr_beholder", "con_ballista", "uniq_lyra", "uniq_cassian"]) {
      const design = characterDesign(id)!;
      for (const clip of ["walk", "attack", "ability", "defeat"] as CharacterClip[]) {
        const frames = Array.from({ length: FRAMES[clip].count }, (_, index) => frameKey(renderCharacterFrame(design, clip, index)));
        expect(new Set(frames).size, `${id} ${clip}`).toBeGreaterThan(2);
      }
    }
  });
});

describe("named champions", () => {
  it("keeps the champion's name and sprite identity in the replay and emits its signature cue", () => {
    const hero = UNIQUES.find(({ id }) => id === "uniq_iron_warden")!;
    const tier = CLASS_BY_ID[hero.baseClassId].tier;
    const run = createNewRun("keeper", [], 19);
    const timeline = resolveWave(run, { wave: 1, seed: 19, groupType: "solo", tierBand: [tier, tier],
      invaders: [{ id: "champion", classId: hero.baseClassId, uniqueId: hero.id, isUnique: true, tier, statMult: 1 }] });
    expect(timeline.meta.find(({ id }) => id === "champion")).toMatchObject({ uniqueId: hero.id, name: hero.name });
    expect(timeline.events).toContainEqual(expect.objectContaining({ type: "ability", sourceId: "champion",
      data: expect.objectContaining({ effect: "shieldOnWaveStart" }) }));
  });
});

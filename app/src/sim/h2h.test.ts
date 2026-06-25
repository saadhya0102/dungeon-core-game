import { describe, it, expect } from "vitest";
import type { Snapshot, RunState } from "./types";
import { SIM_VERSION } from "./config";
import { createNewRun } from "./factory";
import { placeUnit } from "./actions";
import { buildSharedWave, resolveH2HMatch } from "./h2h";

function snapshotFromRun(run: RunState, id: string): Snapshot {
  return {
    id,
    uid: run.uid,
    name: id,
    createdAt: 0,
    source: "retire",
    endedAtWave: 1,
    rating: 0,
    shareable: true,
    dungeon: {
      map: run.map,
      units: run.units,
      traps: run.traps,
      inventory: run.inventory,
      research: run.research,
      core: run.core,
    },
    simVersion: SIM_VERSION,
  };
}

function buildChallenger(): Snapshot {
  const run = createNewRun("alice", [], 12345);
  placeUnit(run, "gob_grunt", 30, 31);
  placeUnit(run, "gob_grunt", 31, 31);
  placeUnit(run, "gob_grunt", 29, 31);
  return snapshotFromRun(run, "snap_challenger");
}

function buildOpponent(): Snapshot {
  const run = createNewRun("bob", [], 67890);
  placeUnit(run, "gob_grunt", 30, 29);
  placeUnit(run, "gob_grunt", 31, 29);
  return snapshotFromRun(run, "snap_opponent");
}

describe("h2h", () => {
  it("resolveH2HMatch is deterministic for identical inputs", () => {
    const a = resolveH2HMatch(buildChallenger(), buildOpponent(), 99);
    const b = resolveH2HMatch(buildChallenger(), buildOpponent(), 99);
    expect(a.winner).toBe(b.winner);
    expect(a.rounds.length).toBe(b.rounds.length);
    expect(a.roundsSurvivedChallenger).toBe(b.roundsSurvivedChallenger);
    expect(a.roundsSurvivedOpponent).toBe(b.roundsSurvivedOpponent);
  });

  it("a match terminates within H2H_MAX_ROUNDS", () => {
    const result = resolveH2HMatch(buildChallenger(), buildOpponent());
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.rounds.length).toBeLessThanOrEqual(12);
    expect(["challenger", "opponent", "draw"]).toContain(result.winner);
  });

  it("buildSharedWave returns non-empty invaders and is deterministic", () => {
    const w1 = buildSharedWave(3, 4242, 2, []);
    const w2 = buildSharedWave(3, 4242, 2, []);
    expect(w1.invaders.length).toBeGreaterThan(0);
    expect(w1.invaders.length).toBe(w2.invaders.length);
    expect(w1.invaders.map((i) => i.classId)).toEqual(w2.invaders.map((i) => i.classId));
  });

  it("extra buys add invaders to the shared wave", () => {
    const base = buildSharedWave(2, 7, 1, []);
    const withBuys = buildSharedWave(2, 7, 1, [{ archetype: "rogue", tier: 1, count: 3 }]);
    expect(withBuys.invaders.length).toBe(base.invaders.length + 3);
  });
});

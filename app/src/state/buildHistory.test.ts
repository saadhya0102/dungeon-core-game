import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewRun, placeUnit } from "../sim";
import { buildOrder } from "../ui/buildFeedback";
import { useStore } from "./store";

vi.mock("../firebase", () => ({ db: undefined, requireCloud: () => { throw new Error("Local test"); } }));

beforeEach(() => useStore.getState().loadRun(createNewRun("local", [], 23)));

describe("planning previews and build history", () => {
  it("leaves the dungeon untouched while previewing placement and excavation", () => {
    const run = useStore.getState().run!;
    const before = structuredClone(run);
    const recruit = buildOrder(run, "placeUnit", "gob_grunt", false)!;
    expect(recruit.price).toBeGreaterThan(0);
    expect(recruit.check(29, 30)).toBeNull();
    expect(recruit.check(35, 30)).toBe("Must place on open floor");
    expect(buildOrder(run, "dig", null, false)?.check(33, 30)).toBeNull();
    expect(buildOrder(run, "room", null, false)?.check(30, 30)).toMatch(/solid stone/);
    expect(run).toEqual(before);
  });

  it("undoes a paid recruit and redoes the same layout and price", () => {
    const start = useStore.getState().run!.dp;
    useStore.getState().setTool("placeUnit", "gob_grunt");
    useStore.getState().onTileClick(29, 30);
    const after = useStore.getState().run!;
    expect(after.units).toHaveLength(1);
    expect(after.dp).toBeLessThan(start);
    useStore.getState().undoBuild();
    expect(useStore.getState().run!.units).toHaveLength(0);
    expect(useStore.getState().run!.dp).toBe(start);
    useStore.getState().redoBuild();
    expect(useStore.getState().run!.units).toEqual(after.units);
    expect(useStore.getState().run!.dp).toBe(after.dp);
  });

  it("leaves redo intact after a rejected edit and clears it after a new one", () => {
    useStore.getState().act((run) => placeUnit(run, "gob_grunt", 29, 30));
    useStore.getState().undoBuild();
    expect(useStore.getState().act((run) => placeUnit(run, "gob_grunt", 42, 42))).toBe(false);
    expect(useStore.getState().redoStack).toHaveLength(1);
    expect(useStore.getState().act((run) => placeUnit(run, "gob_grunt", 28, 30))).toBe(true);
    expect(useStore.getState().redoStack).toHaveLength(0);
  });
});

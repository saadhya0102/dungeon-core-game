import { describe, it, expect } from "vitest";
import { hasLineOfSight } from "./maputil";
import type { DungeonMap } from "./types";

/** Build a map from an ASCII grid: '#' = stone (no tile), anything else = floor. */
function mapFromGrid(rows: string[]): DungeonMap {
  const tiles: DungeonMap["tiles"] = {};
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== "#") tiles[`${x},${y}`] = { state: "floor" };
    });
  });
  return {
    width: rows[0].length,
    height: rows.length,
    core: { x: 0, y: 0 },
    entrance: { x: 0, y: 0 },
    tiles,
    openedCount: Object.keys(tiles).length,
  };
}

describe("line of sight", () => {
  it("sees straight across open floor", () => {
    const m = mapFromGrid([
      ".....",
      ".....",
      ".....",
    ]);
    expect(hasLineOfSight(m, 0, 1, 4, 1)).toBe(true);
    expect(hasLineOfSight(m, 0, 0, 4, 2)).toBe(true);
  });

  it("is blocked by a wall directly on the line", () => {
    const m = mapFromGrid([
      ".....",
      "..#..",
      ".....",
    ]);
    expect(hasLineOfSight(m, 0, 1, 4, 1)).toBe(false);
  });

  it("cannot squeeze through a diagonal gap between two walls", () => {
    // walls at (1,0) and (0,1) form a corner; (1,1) is floor
    const m = mapFromGrid([
      ".#.",
      "#..",
      "...",
    ]);
    expect(hasLineOfSight(m, 0, 0, 2, 2)).toBe(false);
  });

  it("still sees along a corridor when the ray grazes a single wall corner", () => {
    // floor path along the bottom; a wall pokes in at (2,0) but (2,1) path is open
    const m = mapFromGrid([
      "..#..",
      ".....",
      ".....",
    ]);
    // archer at (0,1) to target (4,0): one flank open the whole way
    expect(hasLineOfSight(m, 0, 1, 4, 1)).toBe(true);
  });

  it("strictly blocks a diagonal when a flanking corner tile is stone", () => {
    // wall at (0,1) flanks the (0,0)->(2,2) diagonal corner -> no shooting past it
    const m = mapFromGrid([
      "...",
      "#..",
      "...",
    ]);
    expect(hasLineOfSight(m, 0, 0, 2, 2)).toBe(false);
  });

  it("does not check endpoints (target tile may be a unit/occupied floor)", () => {
    const m = mapFromGrid([
      "...",
      "...",
    ]);
    expect(hasLineOfSight(m, 0, 0, 2, 0)).toBe(true);
  });
});

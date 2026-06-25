// ============================================================================
// Map utilities: keys, neighbors, passability, BFS path checks, A* pathfinding
// (docs/03 §5, docs/10 §6). Used by both client validation and the sim.
// ============================================================================
import type { DungeonMap } from "./types";

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function tileAt(map: DungeonMap, x: number, y: number) {
  return map.tiles[key(x, y)];
}

export function isPassable(map: DungeonMap, x: number, y: number): boolean {
  const t = map.tiles[key(x, y)];
  if (!t) return false; // stone
  return t.state === "floor" || t.state === "core" || t.state === "entrance";
}

export function hasTrap(map: DungeonMap, x: number, y: number): boolean {
  const t = map.tiles[key(x, y)];
  return !!t?.trapId;
}

/** True if every tile in the centered (2r+1)x(2r+1) square is opened/passable. */
export function roomOpen(map: DungeonMap, cx: number, cy: number, r: number): boolean {
  for (let x = cx - r; x <= cx + r; x++) {
    for (let y = cy - r; y <= cy + r; y++) {
      if (!isPassable(map, x, y)) return false;
    }
  }
  return true;
}

/**
 * Line of sight between two tiles, blocked by unexplored/wall terrain
 * (docs/10 §6). Uses a tile supercover walk; endpoints are not checked.
 */
export function hasLineOfSight(map: DungeonMap, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  // walk from start to end; check intermediate tiles only
  // guard against infinite loops
  let guard = dx + dy + 2;
  while (guard-- > 0) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (!isPassable(map, x, y)) return false; // stone/wall blocks sight
  }
  return true;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function neighbors(x: number, y: number): [number, number][] {
  return DIRS.map(([dx, dy]) => [x + dx, y + dy]);
}

export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** BFS reachability, optionally requiring trap-free tiles (docs/03 §5.1). */
export function pathExists(
  map: DungeonMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  trapFree: boolean,
): boolean {
  const start = key(from.x, from.y);
  const goal = key(to.x, to.y);
  if (start === goal) return true;
  const visited = new Set<string>([start]);
  const queue: [number, number][] = [[from.x, from.y]];
  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    for (const [nx, ny] of neighbors(cx, cy)) {
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (!isPassable(map, nx, ny)) continue;
      if (trapFree && hasTrap(map, nx, ny)) continue;
      if (k === goal) return true;
      visited.add(k);
      queue.push([nx, ny]);
    }
  }
  return false;
}

/** Validate both connectivity and trap-free fair lane (docs/03 §5). */
export function validatePaths(map: DungeonMap): { connected: boolean; fairLane: boolean } {
  return {
    connected: pathExists(map, map.entrance, map.core, false),
    fairLane: pathExists(map, map.entrance, map.core, true),
  };
}

/**
 * A* on known-walkable tiles. Revealed traps add cost (avoided if possible).
 * Deterministic tie-breaking by tile key. Returns path (excluding start) or null.
 */
export function aStar(
  map: DungeonMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  trapCost: (x: number, y: number) => number,
): { x: number; y: number }[] | null {
  const startK = key(from.x, from.y);
  const goalK = key(to.x, to.y);
  const open = new Map<string, { x: number; y: number; g: number; f: number }>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  open.set(startK, { x: from.x, y: from.y, g: 0, f: manhattan(from.x, from.y, to.x, to.y) });
  gScore.set(startK, 0);

  while (open.size > 0) {
    // pick lowest f, tie-break by key for determinism
    let bestK = "";
    let best: { x: number; y: number; g: number; f: number } | null = null;
    for (const [k, v] of open) {
      if (!best || v.f < best.f || (v.f === best.f && k < bestK)) { best = v; bestK = k; }
    }
    if (!best) break;
    if (bestK === goalK) {
      const path: { x: number; y: number }[] = [];
      let cur = goalK;
      while (cur !== startK) {
        const [px, py] = cur.split(",").map(Number);
        path.push({ x: px, y: py });
        const prev = cameFrom.get(cur);
        if (!prev) break;
        cur = prev;
      }
      path.reverse();
      return path;
    }
    open.delete(bestK);
    for (const [nx, ny] of neighbors(best.x, best.y)) {
      if (!isPassable(map, nx, ny)) continue;
      const nk = key(nx, ny);
      const stepCost = 1 + trapCost(nx, ny);
      const tentative = best.g + stepCost;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, bestK);
        gScore.set(nk, tentative);
        const f = tentative + manhattan(nx, ny, to.x, to.y);
        open.set(nk, { x: nx, y: ny, g: tentative, f });
      }
    }
  }
  return null;
}

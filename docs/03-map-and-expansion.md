# 03 — Map, Grid & Expansion

Defines the dungeon's spatial model: the tile grid, digging/expansion, the entrance gate, the core, placement rules, and the **critical path constraint** that ties it all together.

---

## 1. The grid

- The dungeon is a **2D square-tile grid**, top-down. Tile coordinates are integer `(x, y)`.
- Each tile is one of these **tile states**:

| State | Passable | Buildable | Render | Notes |
|-------|----------|-----------|--------|-------|
| `stone` (unexplored) | No | No | Rock/dark | Default state of all tiles. Must be **dug** to open. |
| `floor` (open) | Yes | Yes | Dungeon floor | Units/traps placeable; adventurers walk here. |
| `core` | Yes (target) | No | Core crystal | Exactly one. The objective. Occupies its tile (and a small no-build halo). |
| `entrance` | Yes (spawn) | No (trap-restricted) | Portal/gate | Exactly one. Adventurers spawn here. Movable (see §4). |
| `wall` (structural) | No | No | Carved wall | Optional decorative/blocking carved edges; v1 can treat dungeon boundary as implicit stone. |

`[R-MAP-001]` Coordinates are stored sparsely: only non-`stone` tiles are persisted (a dict keyed by `"x,y"`); everything else is implicitly `stone`. This keeps saves small even on a large canvas.

### 1.1 Starting layout (CL1)
- A **5×5 block of `floor`** with the **`core` in the center** tile.
- One **`entrance`** tile placed at a default offset (e.g., on the edge of the starting block or a short pre-dug stub leading to it), with a clear path to the core.
- Everything else is `stone`.

```
S S S S S S S
S . . . . . S
S . . . . . S
S . . C . . S     C = core, . = floor, E = entrance, S = stone
S . . . . . S
S . . . . E S
S S S S S S S
```

---

## 2. Digging & expansion (the pickaxe)

The player expands the dungeon by **digging** `stone` tiles into `floor`.

### 2.1 Mechanics
- The **pickaxe tool** is selected from the build bar. While active, hovering shows dig cost and validity; clicking a `stone` tile (adjacent to existing `floor`) digs it.
- `[R-MAP-010]` A tile may only be dug if it is **orthogonally adjacent** to an existing `floor`/`core`/`entrance` tile (no digging disconnected pockets). This makes the dungeon a single connected region.
- `[R-MAP-011]` Digging costs DP per tile: `digCost(n) = DIG_BASE + DIG_GROWTH * openedTiles`, i.e. each additional tile costs slightly more (default `DIG_BASE = 8`, `DIG_GROWTH = 0.5`, rounded). This gently discourages sprawl and ties into the Size Cap.
- `[R-MAP-012]` Total opened tiles may not exceed the **Size Cap** for the current CL (see `02` §2.1).
- Spec note: "You can access them regardless of distance" — the player can dig anywhere that is adjacent to the open region; there's no "miner must travel" constraint. Digging is instant during BUILD.

### 2.2 Multi-tile dig (quality of life)
- `[R-MAP-013]` Click-drag with the pickaxe to dig a **rectangle**; cost = sum of per-tile costs for the `stone` tiles in it that are (or become, in scan order) adjacency-valid. Invalid tiles in the drag are skipped.
- From CL6, **"field" tools** allow placing certain multi-tile traps (see `08`).

### 2.3 Collapsing (un-digging)
- `[R-MAP-014]` A `floor` tile with **nothing built on it** can be collapsed back to `stone` for a partial refund (`DIG_REFUND`, see `02`), **only if** doing so does not violate the path constraint (§5) and does not disconnect any built tiles.

---

## 3. The core

- Exactly one `core` tile; it is the run's life total (Core HP from CL table).
- `[R-MAP-020]` A **no-build halo** of radius 1 around the core (the 8 neighbors) cannot hold traps (so the player can't trivially wall the core in traps), but **can** hold units (last line of defense). This is a tunable rule.
- The core does not move (the dungeon is built around it). Expansions grow outward in any dug direction.

---

## 4. The entrance gate

- Exactly one `entrance` tile; adventurers **spawn here** each wave and begin exploring.
- `[R-MAP-030]` **No traps** may be placed within `ENTRANCE_SAFE_RADIUS` tiles of the entrance (default radius 2). Units **may** be placed there (but see "they share info / aggro" — putting units at the door changes pacing).
- `[R-MAP-031]` The entrance is **movable** during BUILD: the player can relocate it to any `floor` tile, subject to the path constraint (§5) and the safe-radius re-validation. Early CLs may restrict moves to edge tiles; CL8 unlocks free repositioning (see `02`).
- Design intent: moving the entrance lets players design the *route* adventurers must take — the heart of dungeon design (long winding kill-corridors vs. compact bunkers).

---

## 5. The path constraint (critical rule)

This is the rule that makes the whole game a spatial puzzle.

`[R-MAP-040]` **There MUST always exist at least one walkable path from the `entrance` to the `core`.** A "walkable path" is a sequence of orthogonally-adjacent passable tiles (`floor`/`core`/`entrance`).

`[R-MAP-041]` **That path may not be fully blocked by traps**: there must exist a walkable entrance→core path that is also **trap-free** (the spec: "there has to be a path to the dungeon core, with no traps on it"). Traps do not block *movement* (adventurers can walk over them, triggering them), so this rule specifically guarantees the player cannot create a situation that's unwinnable/unfair for pathing logic and prevents "trap-walling." Interpretation for v1:
   - Traps are **walkable** (adventurers step on them; that's how they trigger).
   - The constraint is enforced as: *a trap-free entrance→core route exists.* This keeps a "fair lane" and is what the validator checks.
   - Rationale: prevents degenerate layouts and matches the spec; the strategic game is making the *non-fair* routes attractive/forced via map shape, not literally walling with traps.

`[R-MAP-042]` Any edit that would violate §5 (digging-collapse, moving the entrance/core, placing a trap that eliminates the last trap-free route) is **rejected** in BUILD with a clear UI reason ("This would block the only safe path to the core").

### 5.1 Validation algorithm
On every relevant edit, run a BFS:

```
function pathExists(grid, from, to, {trapFree}):
  visited = set()
  queue = [from]
  while queue not empty:
    t = queue.pop()
    if t == to: return true
    for n in orthogonalNeighbors(t):
      if n in visited: continue
      if not passable(n): continue            // stone/wall block
      if trapFree and hasTrap(n): continue     // skip trapped tiles
      visited.add(n); queue.push(n)
  return false
```

- Connectivity check: `pathExists(grid, entrance, core, {trapFree:false})` must be true.
- Fair-lane check: `pathExists(grid, entrance, core, {trapFree:true})` must be true.
- `[R-MAP-043]` Both checks run client-side for instant feedback **and** server-side on save/commit (authoritative).

---

## 6. Placement rules (units, turrets, traps)

| Placeable | Allowed tiles | Constraints |
|-----------|---------------|-------------|
| **Unit** | `floor` (incl. core halo) | 1 unit per tile; not on `entrance`/`core`; respects Capacity (`02`); not within entrance safe radius? — **allowed** (units may guard the door). |
| **Turret** | `floor` | 1 per tile; counts against Capacity; cannot occupy entrance/core tile. |
| **Trap** | `floor` | 1 trap per tile (some "field" traps span tiles, CL6+); NOT within entrance safe radius; NOT in core halo; must not violate fair-lane rule. |

`[R-MAP-050]` A tile may hold **either** a unit/turret **or** a trap, not both (v1 simplification; keeps combat/trigger logic clean and the board readable). This is a tunable rule — a later "camouflage" research could allow a unit to sit on a trap.
`[R-MAP-051]` Click-and-drag moves a placed unit/turret to another valid tile during BUILD (see `14`).

---

## 7. Adventurer movement & the map

(Full AI in `10`.) Relevant map facts:
- Adventurers spawn at `entrance`, treat `floor`/`core`/`entrance` as walkable, `stone`/`wall` as blocking.
- They **explore** (don't magically know the layout) using shared frontier exploration; once any adventurer "sees" the core, the group routes toward it (see `10` §Pathfinding).
- Traps are revealed/triggered by movement and by rogue detection (see `08`,`09`).

---

## 8. Map data model (see `16` for full schema)

```ts
type TileState = 'stone' | 'floor' | 'core' | 'entrance' | 'wall';

interface DungeonMap {
  width: number;            // logical canvas bounds (for camera), grid is sparse
  height: number;
  core: { x: number; y: number };
  entrance: { x: number; y: number };
  // Sparse: only non-stone tiles stored. Key "x,y".
  tiles: Record<string, {
    state: Exclude<TileState, 'stone'>;
    unitId?: string;        // placed unit/turret instance id
    trapId?: string;        // placed trap instance id
  }>;
  openedCount: number;      // enforced against Size Cap
}
```

`[R-MAP-060]` `openedCount` is derived/validated from `tiles`; persisted for quick cap checks but recomputed authoritatively on the server.

---

## 9. Edge cases & rules summary

- Cannot dig beyond Size Cap → action blocked with reason.
- Cannot dig non-adjacent stone → blocked.
- Cannot place 2 things on one tile → blocked.
- Cannot place trap in safe radius / core halo → blocked.
- Cannot make any edit that breaks connectivity or the fair lane → blocked.
- Moving entrance/core re-validates everything.
- All blocks produce a **specific, human-readable reason** in the UI (pillar P1).

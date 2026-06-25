# 16 — Data Model & API (Firestore + Cloud Functions)

The persistence schema, security model, and the server API. Aligns with the existing Firebase scaffold (`.firebaserc` → `dungeon-core`, `firestore.rules`, `functions/`). The authoritative simulation lives in Cloud Functions (`10`,`12`); the client persists **intent**, the server persists **truth**.

---

## 1. Firestore collections

```
/players/{uid}                         (Profile, private to owner)
  /run/active                          (RunState - single active run)   [subdoc/fixed id]
  /snapshots/{snapshotId}              (Snapshot - immutable saved dungeons)
  /private/economyLog/{entryId}        (audit of server-applied DP changes; optional)
/public/
  /catalog/{version}                   (read-only game content: units, classes, gear defs, traps,
                                        research, achievements, CONFIG)  -- or shipped in client bundle
  /h2hPool/{snapshotRef}               (opt-in shareable snapshots, denormalized for matchmaking)
  /leaderboards/{boardId}              (reserved: best waves, h2h MMR)
/matches/{matchId}                     (H2H match records)
```

Notes:
- **Game content/catalog** (`05`–`11`, `13` achievement defs) is **static data**. v1 ships it **in the client bundle** AND mirrors a copy server-side (imported by Functions) so both use the same definitions; `/public/catalog` is optional for hot-updates without a redeploy. Pick one source of truth per version (`11` §7).
- The **active run** is one document at a known path (`players/{uid}/run/active`) for easy resume.

---

## 2. Security rules (maps to `firestore.rules`)

Current scaffold already enforces: owner-only `players/{uid}/**`, public read-only `public/**`, deny by default. Extend to:

`[R-API-001]` `players/{uid}` and all subcollections: read/write only if `request.auth.uid == uid`. **However**, DP/wave/achievement/snapshot-creation fields are written **only by Functions** (Admin SDK bypasses rules). Client may write **placement/edit intent** to `run/active` for things that are *not* economy-authoritative (e.g., camera, cosmetic), but all economy-affecting mutations go through callable Functions. Simplest safe model: **client cannot directly write `dp`, `research`, `units` count-affecting fields**; rules reject client writes that change protected fields (use a validation rule or route everything through Functions).
`[R-API-002]` `public/**`: read for any signed-in user; write only Functions.
`[R-API-003]` `matches/{matchId}`: read by participants; write only Functions.
`[R-API-004]` `h2hPool`: read by Functions for matchmaking; a player can write only the share-toggle on **their own** snapshot reference (or Functions manage it on snapshot save).

> Recommended v1: **all mutating game actions are callable Functions**; Firestore client writes are limited to non-authoritative profile/settings fields. This is the cleanest cheat-resistant model (pillar P6) and keeps rules simple.

---

## 3. Cloud Functions API (callable)

All callable (`onCall`), require auth, validate inputs, are deterministic where they touch the sim, and return typed results. Region `us-central1` (`functions/src/index.ts` already set up `ping`/`submitAction` as placeholders).

### 3.1 Run lifecycle
| Function | Input | Effect / Output |
|----------|-------|-----------------|
| `startRun` | `{ modifiers?: NGModifier[] }` | Creates `run/active` (fails if one exists unless `force`). Seeds `rngSeedRoot`. Returns RunState. |
| `getActiveRun` | `{}` | Returns RunState (or null). |
| `abandonRun` | `{}` | Marks active run ended without snapshot (or with, per choice). |
| `retireRun` | `{ name?, shareable? }` | Freezes active run → Snapshot; ends run. Returns snapshotId. |

### 3.2 Build-phase mutations (validated, economy-authoritative)
| Function | Input | Validates | Output |
|----------|-------|-----------|--------|
| `digTiles` | `{ tiles:[{x,y}] }` | adjacency, size cap, DP for dig cost, path constraint | new map + DP |
| `collapseTile` | `{ x,y }` | nothing built, path intact, refund | map + DP |
| `placeUnit` | `{ defId, x, y, turretMode? }` | unlocked (research/CL), tier≤maxTier, capacity, tile valid, DP cost | unit + DP + capacity |
| `moveUnit` | `{ unitId, x, y }` | tile valid, path intact | map |
| `sellUnit` | `{ unitId }` | exists; refund | DP + capacity |
| `placeTrap` | `{ defId, x, y }` | unlocked, tile valid, safe-radius, halo, fair-lane, DP | trap + DP |
| `sellTrap` | `{ trapId }` | exists; refund | DP |
| `equipGear` | `{ unitId, itemId, slot }` | tier cap, slot, ownership | unit stats |
| `unequipGear` | `{ unitId, slot }` | — | inventory + unit |
| `buyResearch` | `{ nodeId }` | tier (CL), prereqs, DP, rank | research + DP |
| `upgradeCore` | `{}` | DP for next CL | core + caps |
| `buyGear` | `{ stockId }` | CL≥3, DP, stock valid | item + DP |
| `rerollGearShop` | `{}` | DP | new stock |
| `salvageGear` | `{ itemId }` | exists; refund | DP |
| `moveEntrance` | `{ x,y }` | floor, safe-radius, path | map |

`[R-API-010]` Each mutation: load `run/active`, validate against `CONFIG`, apply, write atomically (transaction), return the changed slice. Reject with typed error codes (`INSUFFICIENT_DP`, `CL_LOCKED`, `CAPACITY_FULL`, `PATH_BLOCKED`, `TILE_OCCUPIED`, `NOT_UNLOCKED`, `TIER_TOO_HIGH`).
`[R-API-011]` The client mirrors validation locally for instant UX but treats the server result as truth; on rejection it rolls back the optimistic update.

### 3.3 Wave resolution
| Function | Input | Effect |
|----------|-------|--------|
| `resolveWave` | `{}` (uses active run + W) | Server generates wave from `(rngSeedRoot, W)` (`09`), runs `resolve()` (`10`), applies rewards (DP, drops, casualties/revive, W++), evaluates achievements, persists, returns **Timeline** for playback + reward summary. |

`[R-API-020]` `resolveWave` is the heart: it's the **only** way DP/drops/wave progress are granted. The client cannot self-report a win.
`[R-API-021]` Returns the full `Timeline` (`10`) so the client plays it back. For large crusades the timeline may be sizable → compress / send compactly (event deltas).

### 3.4 H2H (`12`)
| Function | Input | Effect |
|----------|-------|--------|
| `startH2H` | `{ snapshotId }` | Matchmake opponent from pool by rating; create `matches/{id}`; return setup + round-1 context. |
| `submitH2HRound` | `{ matchId, extraBuys }` | Generate shared wave + baseline + buys; `resolve()` vs both snapshots; persist round; return two timelines + outcome. |
| `getMatch` | `{ matchId }` | Read match record (participants only). |

### 3.5 Misc
| Function | Input | Effect |
|----------|-------|--------|
| `linkAnonAccount` | (handled client-side via Auth, server reconciles) | preserve data on link |
| `updateProfile` | `{ displayName?, settings? }` | non-authoritative profile fields |
| `setSnapshotShare` | `{ snapshotId, shareable }` | toggle H2H pool membership |
| `ping` | `{}` | health check (exists in scaffold) |

---

## 4. Determinism & versioning across client/server
`[R-API-030]` The `sim/` package and `CONFIG` are **shared** between client and Functions (same code, `17`). Both must run the same version. Every RunState/Snapshot/Match stores `simVersion`.
`[R-API-031]` `resolveWave`/`submitH2HRound` recompute outcomes from seeds server-side; client previews must reconcile to returned timelines (`10` §1, `12` §9).
`[R-API-032]` On sim version bump: active runs continue under their stored version if compatible, else are migrated or flagged; snapshots become legacy if incompatible (`13` §5).

---

## 5. Data sizing & cost considerations
`[R-API-040]` Keep `RunState` under Firestore's 1 MiB doc limit: map is sparse (`03`), unit/trap lists are compact (ids + refs), inventory references gear by item docs or compact inline (cap inventory growth). If a run risks exceeding the limit at extreme sizes, shard `map`/`inventory` into subdocs.
`[R-API-041]` Timelines are **not** persisted by default (regenerable from seed+state); optionally cache the last wave's timeline for re-watch. H2H match timelines may be persisted briefly for replay then expire (TTL).
`[R-API-042]` Reads: client subscribes to `run/active` (and gets optimistic local mirror); minimize per-tick writes (autosave debounced, `13`).

---

## 6. Indexes
`[R-API-050]` `firestore.indexes.json` will need composite indexes for: `h2hPool` by `rating` (matchmaking range queries), `snapshots` by `uid + createdAt`, `leaderboards` (reserved). Add as queries are implemented.

---

## 7. Mapping to existing scaffold
- `functions/src/index.ts`: replace placeholder `submitAction` with the real callables above; keep `ping`. Import shared `sim/` + `config`.
- `firestore.rules`: extend the existing `players/{uid}` owner rule and `public` read-only rule per §2; add `matches` rule. The existing "writes go through Functions" comment already anticipates this.
- `firestore.indexes.json`: add indexes from §6 when needed.
- Cloud Functions require **Blaze** plan to deploy (noted in setup); emulator works without it.

# 13 — Accounts, Saves & Achievements

Defines authentication, what persists, the save-state schema (the active run + saved snapshots), achievements, and meta-progression. Storage detail (Firestore collections, rules) is in `16`; this doc defines the **player-facing data contract**.

---

## 1. Accounts & auth

`[R-ACC-001]` Auth via **Firebase Auth**. Supported v1 methods:
- **Anonymous** (instant play; spec wants low friction). An anon account can be **upgraded/linked** to a permanent method without losing data.
- **Email/Password**.
- **Google** (OAuth).
(Enable these in the Firebase console; `00`/`16`.)
`[R-ACC-002]` All persistent data is keyed by `uid`. A profile doc is created on first sign-in.
`[R-ACC-003]` Anonymous accounts persist locally; the UI nudges linking to avoid data loss on device change (especially before entering H2H, since snapshots are shared).

### 1.1 Profile
```ts
interface Profile {
  uid: string;
  displayName: string;        // auto "Dungeon Lord #1234", renameable
  createdAt, lastSeenAt: number;
  settings: { sfx, music, playbackSpeed, reducedMotion, ... };
  stats: ProfileStats;        // lifetime aggregates (runs, best wave, kills, h2h record)
  meta: MetaProgression;      // unlocked cosmetics, NG+ modifiers unlocked, etc.
  h2h: { rating: number; mmr?: number; wins: number; losses: number };
  achievementsUnlocked: Record<string, number>; // achId -> timestamp
}
```

---

## 2. The save model

There are two kinds of persisted game state:

### 2.1 Active Run (one at a time)
The current in-progress run. Autosaved continuously (debounced) during BUILD and after each wave result.

```ts
interface RunState {
  id: string; uid: string;
  status: 'active' | 'ended';
  createdAt, updatedAt: number;
  wave: number;                 // current W
  dp: number;
  core: { level: number; hp: number; maxHp: number; ward?: number };
  map: DungeonMap;              // 03 schema
  units: PlacedUnit[];          // unit instances (id, defId, tier, pos, gear refs, ...)
  turrets: PlacedTurret[];      // (or unit flag)
  traps: PlacedTrap[];
  inventory: GearItem[];        // 07
  research: { owned: string[]; ranks: Record<string, number> };  // 06
  rngSeedRoot: number;          // run seed; wave seeds derive from this + W (10)
  modifiers?: NGModifier[];     // New Game+ modifiers active
  simVersion: string;           // 11 §7
  runStats: RunStats;           // kills, dp earned, drops, etc.
}
```

`[R-SAVE-001]` `RunState` is the **resumable** record (`01` §7, "Continue"). Only one `active` run per account at a time (starting a new run while one is active prompts to retire/abandon the old one).
`[R-SAVE-002]` Autosave is **debounced** (e.g., 2s after last edit) and on phase transitions. The server validates economy/placement on mutations (`16`); the client never writes authoritative DP.
`[R-SAVE-003]` Wave outcomes are computed server-side; the returned timeline + reward update `RunState` (DP, casualties, drops, wave++).

### 2.2 Saved Snapshots (many)
Spec: "you can pick any dungeon state that you have." On run end (death or retire), the final `RunState` is frozen into a **Snapshot** (immutable). Snapshots are the H2H roster (`12`).

```ts
interface Snapshot {
  id: string; uid: string;
  name: string;                 // auto-named, renameable ("Spike Gauntlet — W42")
  createdAt: number;
  source: 'death' | 'retire';
  endedAtWave: number;
  rating: number;               // 12 §6
  shareable: boolean;           // opt-in to H2H pool
  dungeon: FrozenDungeon;       // map+units+gear+traps+research+CL (no DP/seed needed)
  simVersion: string;
}
```

`[R-SAVE-010]` Snapshots are **immutable**; the player keeps a library and can rename/delete/toggle-share. A storage soft-cap (e.g., keep newest N + favorites) prevents unbounded growth (config).
`[R-SAVE-011]` A future feature ("borrow as template" `01` §4) could start a new run from a snapshot's layout; reserved.

---

## 3. Meta-progression (persists across runs)

Spec: death saves achievements + final state; meta should make death not-fully-punishing (`01` §4).

`[R-META-001]` Persists: achievements, lifetime stats, H2H rating/record, unlocked **cosmetics** (core skins, sprite tints, dungeon themes), and unlocked **New Game+ modifiers**.
`[R-META-002]` **New Game+ modifiers** are optional run rulesets the player can toggle when starting a run, unlocked via achievements:
- `hardcore` — permadeath units (no free revive, `01` §5).
- `fastStart` — extra starting DP/CL.
- `eliteWaves` — tougher waves, better rewards.
- `ironCore` — core can't be repositioned; fixed entrance.
- `loot+` — higher drop rates, fewer units allowed.
These change `RunState.modifiers` and feed config overrides into the sim/economy.
`[R-META-003]` No pay-to-win; meta unlocks are cosmetic or sidegrade/challenge, not raw power that breaks H2H fairness (H2H matches by rating which already accounts for power).

---

## 4. Achievements

Spec: "dozens of achievements it stores which ones you got." Achievements are evaluated server-side on the authoritative events (wave results, run end, H2H results) so they can't be spoofed.

### 4.1 Schema
```ts
interface AchievementDef {
  id: string; name: string; desc: string;
  hidden?: boolean;            // secret until unlocked
  category: 'progression'|'combat'|'building'|'economy'|'collection'|'h2h'|'challenge'|'meta';
  condition: AchCondition;     // declarative, evaluated against run/profile/match stats
  reward?: { dpThisRun?: number; cosmetic?: string; ngModifier?: string };
  tier?: 'bronze'|'silver'|'gold';  // for tiered/stacked achievements
}
```
`[R-ACH-001]` Conditions are **declarative** and evaluated by a single achievements engine over stat counters emitted by the sim/run (no bespoke code per achievement). Counters: kills, kills-by-trap, waves cleared, CL reached, families researched, uniques killed, gear equipped by quality, DP earned, H2H wins, etc.

### 4.2 Achievement catalog (the "dozens" — canonical starter set)

> ~50 to start; full list lives here. Tiered ones count as multiple.

**Progression**
- `first_blood` — Kill your first adventurer.
- `wave_10` / `wave_25` / `wave_50` — Reach wave 10/25/50.
- `cl_5` / `cl_10` / `cl_20` — Reach Core Level 5/10/20.
- `survivor` — Clear a Crusade milestone wave.
- `the_long_dark` — Reach wave 75.

**Combat**
- `trapmaster` — Kill 50 adventurers with traps (bronze 50 / silver 250 / gold 1000).
- `giant_slayer` — Kill a unique that reached the core halo.
- `flawless` — Clear a wave taking zero core damage (×10 for silver).
- `overkill` — Land a single hit > 25% of a target's max HP.
- `rogue_hunter` — Kill 25 rogues (counters working).
- `horde_breaker` — Kill 20+ adventurers in a single wave.
- `last_stand` — Win a wave with core < 10% HP.

**Building**
- `architect` — Open 100 tiles in one run.
- `labyrinth` — Have a trap-free path length ≥ 20 tiles to the core.
- `turret_command` — Field 5+ turrets at once.
- `full_house` — Use 100% of capacity at CL≥8.
- `one_of_each` — Field a unit from all 6 families simultaneously.

**Economy**
- `nest_egg` — Hold 5,000 DP at once.
- `big_spender` — Spend 50,000 DP in a run.
- `salvager` — Salvage 25 items.

**Collection / Research**
- `family_devotion` — Fully research one family branch.
- `polymath` — Own 40 research nodes in one run.
- `armory` — Have 25 items in inventory.
- `legendary_find` — Loot a legendary item.
- `mythic_find` — Loot a mythic item (hidden).

**H2H**
- `first_duel` — Complete an H2H match.
- `duelist` — Win 10 H2H matches (silver 50 / gold 200).
- `giant_among_lords` — Win an H2H vs a higher-rated opponent.
- `untouchable` — Win an H2H without your core taking damage.

**Challenge / Meta**
- `hardcore_hero` — Reach wave 25 in hardcore mode.
- `minimalist` — Reach wave 20 with ≤10 units total.
- `pure_blood` — Reach wave 30 using a single family only.
- `completionist` — Unlock 75% of achievements (hidden).

`[R-ACH-010]` Each achievement maps to counters the sim/run already emits; adding an achievement should require only a new `AchievementDef`, not engine changes.
`[R-ACH-011]` Achievement unlocks fire a toast in-game (`14`) and are written to `Profile.achievementsUnlocked` server-side.

---

## 5. Data lifecycle & integrity
`[R-DATA-001]` Authoritative writes (DP, wave results, achievements, H2H, snapshot creation) go through Cloud Functions; the client writes only **intent** (placement edits, purchases) which the server validates (`16`).
`[R-DATA-002]` Snapshots and run states store `simVersion`; on a breaking sim update, old snapshots are flagged "legacy" (viewable, not H2H-eligible) until re-validated.
`[R-DATA-003]` Deleting account → cascade delete run, snapshots, remove from H2H pool (privacy).
`[R-DATA-004]` Anonymous→permanent link preserves all of the above (same uid).

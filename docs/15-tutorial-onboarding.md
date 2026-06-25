# 15 — Tutorial & Onboarding

A scripted, constrained first run that teaches the loop in ~10 minutes (product goal, `00` §7). Built as a special run with a fixed seed, gated actions, and coachmark overlays. New players are routed here on first session (`01` §7).

---

## 1. Goals & principles
`[R-TUT-001]` Teach by **doing**, one concept at a time, in the natural order of the loop (dig → place → equip → wave → reward → invest → research → core up).
`[R-TUT-002]` **Gate** the UI so only the currently-taught action is enabled; everything else is dimmed/locked until its step.
`[R-TUT-003]` **No fail state** during the tutorial — waves are scripted to be winnable; the core can't actually die in the scripted portion (or death just retries the step with a hint).
`[R-TUT-004]` Skippable for returning players ("Skip tutorial" → normal new run), but recommended on first ever launch.
`[R-TUT-005]` Deterministic: fixed `rngSeedRoot` and scripted waves so coachmarks line up with events.

---

## 2. Structure

A short scripted run with a tiny pre-dug dungeon and a generous DP grant per step. Implemented as `RunState` with `modifiers: ['tutorial']` and a **step machine**.

```ts
interface TutorialStep {
  id: string;
  goal: string;                 // player-facing instruction
  enabledActions: string[];     // which UI affordances are active
  completeWhen: TutorialCond;   // event/condition that advances
  coachmark: { anchor: string; text: string };
  grantDpOnEnter?: number;
  scriptedWave?: WaveScript;     // for combat steps
}
```

---

## 3. Step-by-step script

| # | Step id | Teaches | Player does | Advances when |
|---|---------|---------|-------------|---------------|
| 1 | `welcome` | Premise | Read intro ("You are a Dungeon Core…"), see the core + entrance | Dismiss intro |
| 2 | `camera` | Pan/zoom | Pan and zoom the viewport | Camera moved + zoomed |
| 3 | `dig` | Pickaxe/expansion | Dig a 3-tile corridor from the open area | 3 tiles dug (adjacency enforced) |
| 4 | `place_unit` | Buying/placing units | Drag 2 Goblin Grunts onto corridor tiles | 2 units placed |
| 5 | `inspect` | Hover tooltips | Hover a unit to see stats/affinities | Tooltip viewed (unit hovered ≥1s) |
| 6 | `first_wave` | Running a wave | Press Run Wave; watch a Solo Bronze warrior get killed | Wave resolved (win) |
| 7 | `rewards` | DP & result | Read the Result overlay (DP earned), continue | Result dismissed |
| 8 | `place_trap` | Traps & hidden rating | Place a Spike Pit on the corridor (learn it can't go in entrance safe-radius) | 1 trap placed |
| 9 | `trap_wave` | Traps in action | Run a wave; watch the pit trigger + kill | Wave resolved; trap triggered |
| 10 | `equip` | Gear & affinities | A weapon dropped (scripted); equip it on a goblin; see affinity-adjusted stats | Item equipped |
| 11 | `core_up` | Core Level | Upgrade to CL2 (scripted DP granted); see capacity/size increase | CL2 reached |
| 12 | `research` | Research tree | Buy `res_gob_ferocity` rank 1; see family buff | 1 research node owned |
| 13 | `path_rule` | The fair-lane rule | Try to wall the path with traps → see the block message; learn the rule | Player triggers + reads the rule, then has a valid layout |
| 14 | `bigger_wave` | Group types / scout | Read the Scout readout (a Party incoming); build/adjust; run it | Party wave cleared |
| 15 | `graduate` | Hand-off | "You're ready." Explains endless escalation, H2H exists, achievements | Step done → tutorial flagged complete |

`[R-TUT-010]` On completion: set `Profile.meta.tutorialComplete = true`, grant a starter achievement (`first_blood` likely already earned), and transition into a **normal run** continuing from the tutorial dungeon (or offer a fresh start). Default: continue the same dungeon as a real run (keeps momentum).

---

## 4. Coachmarks & UX
`[R-TUT-020]` Coachmarks are non-blocking callouts anchored to the relevant UI (build bar button, a tile, the Run Wave button) with a dimmed backdrop and an arrow. One active at a time.
`[R-TUT-021]` A persistent **objective chip** (top-center) restates the current goal. A "?" reopens the last coachmark.
`[R-TUT-022]` Gating: disabled actions show a subtle lock + "Coming up" tooltip rather than being invisible (so players see what's ahead).
`[R-TUT-023]` Accessibility: coachmark text is screen-reader friendly; tutorial respects reduced-motion.

---

## 5. Just-in-time tips (post-tutorial)
`[R-TUT-030]` After graduation, surface **one-time contextual tips** the first time a player encounters a new system, then never again (stored as flags in `Profile.meta.tipsSeen`):
- First rogue appears → tip about spammers/anti-rogue traps.
- First Horde → tip about AoE/traps.
- First legendary drop → tip about affinity matching.
- First time near capacity → tip about Core Level/space efficiency.
- First Crusade milestone → tip about milestone cadence & rewards.
- CL3 reached → tip about the Gear Shop.
`[R-TUT-031]` Tips are dismissible and listed in a "Help" section in Settings for re-reading.

---

## 6. Implementation notes
`[R-TUT-040]` The tutorial is **data-driven** (the step table above as config) so steps can be reordered/edited without code changes; the step machine reads conditions from the same event stream the achievements engine uses (`13`).
`[R-TUT-041]` Scripted waves use fixed `WaveScript`s (explicit adventurer lists) instead of the random generator, for reproducibility.
`[R-TUT-042]` The tutorial must work fully offline-capable against the local sim for snappy feedback, then sync the resulting run state once (it's a real run after graduation).

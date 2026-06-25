import { useCallback, useState } from "react";
import { useStore } from "../state/store";
import type { RunState } from "../sim/types";
import type { Phase } from "../state/store";

// ----------------------------------------------------------------------------
// Lightweight just-in-time onboarding. Shows one dismissible coachmark at a
// time while building or reviewing results. Each tip fires the first time its
// condition holds, then is remembered (per-tip ids in localStorage) so it
// never shows again. See docs/15 (lightweight version).
// ----------------------------------------------------------------------------

const STORAGE_KEY = "dc_tips_seen";

interface Tip {
  id: string;
  match: (run: RunState, phase: Phase, seen: ReadonlySet<string>) => boolean;
  title: string;
  body: string;
}

// Priority order matters: the first matching, unseen tip wins.
const TIPS: Tip[] = [
  {
    id: "welcome",
    title: "Welcome, Dungeon Core",
    body:
      "You ARE the glowing crystal in the middle. Adventurers spawn at the blue " +
      "portal and try to reach and smash you. Your job: build a deadly maze and let " +
      "your monsters and traps tear them apart. Each round you Build, then press " +
      "Run Wave and watch the fight, then spend the loot to grow stronger.",
    match: (run) => run.wave === 1 && run.units.length === 0,
  },
  {
    id: "dig_rooms",
    title: "Dig Out Rooms",
    body:
      "Pick the Dig tool and click (or drag a rectangle) on the dark stone next to " +
      "your floor to carve it open. Don't just dig one hallway \u2014 carve several " +
      "ROOMS. Bigger monsters literally require bigger open rooms to be placed (a T5 " +
      "unit needs a 5x5 cleared area), so plan your space.",
    match: (run, _p, seen) => seen.has("welcome") && run.map.openedCount <= 27,
  },
  {
    id: "firstUnit",
    title: "Place & Inspect Monsters",
    body:
      "Open Units, click a monster, then click an open floor tile to place it. " +
      "Click a placed unit to inspect its stats, affinities and abilities. Use the " +
      "Move button to relocate it. Match gear to a unit's strong affinity for big " +
      "damage (a staff on a mage, a sword on a brute).",
    match: (run, _phase, seen) => run.units.length >= 1 && seen.has("welcome"),
  },
  {
    id: "rooms_spread",
    title: "Spread Out Into Many Rooms",
    body:
      "A unit can only be near 5 other units \u2014 cram in a 6th and it's blocked. " +
      "This forces you to build multiple rooms. BONUS: units of the SAME FAMILY " +
      "standing close together get a stat boost, so build themed rooms (a goblin den, " +
      "an undead crypt) for the best results.",
    match: (run) => run.units.length >= 4,
  },
  {
    id: "los",
    title: "Line of Sight Matters",
    body:
      "Archers and mages can't shoot through unexplored stone \u2014 they need line of " +
      "sight. Shape corridors and rooms so your ranged units get clear firing lanes, " +
      "and tuck squishy casters behind tanky front-liners. Archers out-range mages, " +
      "but mages hit areas.",
    match: (run) => run.wave >= 2,
  },
  {
    id: "firstWaveCleared",
    title: "Wave Survived",
    body:
      "You earned Dungeon Points (DP) and maybe some loot. Spend DP on more units, " +
      "research, traps, or a Core upgrade, then run the next wave. Waves get tougher " +
      "and bigger over time, with the occasional crusade.",
    match: (_run, phase) => phase === "result",
  },
  {
    id: "research",
    title: "Open the Research Lab",
    body:
      "Research unlocks new monsters and permanent family upgrades for this run. " +
      "You can't afford everything \u2014 specialize. Family upgrades make a themed " +
      "army (e.g. all goblinoids) punch far above their cost.",
    match: (run) => run.research.owned.length < 4 && run.dp >= 60,
  },
  {
    id: "coreUp",
    title: "Upgrade Your Core",
    body:
      "A Core Level upgrade raises your unit Capacity, your dungeon Size Cap, the " +
      "max unit tier you can field, and your Core HP. It's the backbone of progress " +
      "\u2014 open the Core panel to spend DP on it.",
    match: (run) => run.dp >= 120 && run.core.level === 1,
  },
  {
    id: "trapsTip",
    title: "Lay Some Traps",
    body:
      "Traps stay hidden until a rogue reveals them, so non-rogue waves walk right " +
      "into them. Some traps strip rogue dodge, freeze, or burn. Keep at least one " +
      "trap-free path open \u2014 the game won't let you fully wall the core off.",
    match: (run) => run.wave >= 3,
  },
  {
    id: "abilities",
    title: "Monsters Have Tricks",
    body:
      "Units have unique abilities: hellhounds BURN, frost monsters FREEZE, ghouls " +
      "BLEED, imps EXPLODE on death, some brutes go BERSERK at low HP (red ring), " +
      "wraiths turn INVISIBLE, mages with big AoE hit clusters. Mix counters: " +
      "spammers and detection beat rogues; AoE shreds hordes.",
    match: (run) => run.wave >= 4,
  },
  {
    id: "gearShop",
    title: "The Gear Shop Is Open",
    body:
      "Core Level 3 unlocked the Gear Shop. Buy weapons/armor and equip them on " +
      "units whose affinity matches the gear type. Loot also drops from defeated " +
      "adventurers \u2014 manage it in a unit's inspector.",
    match: (run) => run.core.level >= 3,
  },
  {
    id: "h2h",
    title: "Save a Dungeon for H2H",
    body:
      "Use Save Dungeon, then set a Main in Saved Dungeons. Your Main is the dungeon " +
      "other players face in Head-to-Head \u2014 an async battle where both sides take " +
      "the same waves and the last core standing wins. Watch it in split-screen.",
    match: (run) => run.wave >= 8,
  },
];

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
  } catch {
    // ignore malformed storage
  }
  return new Set();
}

function saveSeen(seen: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore storage write failures (private mode, quota, etc.)
  }
}

export function TutorialOverlay() {
  const run = useStore((s) => s.run);
  const phase = useStore((s) => s.phase);
  const [seen, setSeen] = useState<Set<string>>(loadSeen);

  const dismiss = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveSeen(next);
      return next;
    });
  }, []);

  if (!run) return null;
  if (phase !== "build" && phase !== "result") return null;
  // The guided tutorial owns onboarding until it's completed/skipped.
  try { if (localStorage.getItem("dc_tutorial_done") !== "1") return null; } catch { /* ignore */ }

  const active = TIPS.find((t) => !seen.has(t.id) && t.match(run, phase, seen));
  if (!active) return null;

  const isTutorialRun = run.modifiers.includes("tutorial");
  const emphasize = active.id === "welcome" && isTutorialRun;

  return (
    <div
      className="panel"
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 84,
        transform: "translateX(-50%)",
        width: 320,
        maxWidth: "92vw",
        maxHeight: "none",
        padding: 14,
        zIndex: 40,
        boxShadow: "0 8px 28px #0008",
        borderColor: emphasize ? "var(--accent)" : undefined,
      }}
    >
      <div
        className="small"
        style={{
          textTransform: "uppercase",
          letterSpacing: ".6px",
          color: emphasize ? "var(--accent)" : "var(--muted)",
        }}
      >
        {emphasize ? "Tutorial" : "Tip"}
      </div>
      <h3 style={{ margin: "2px 0 6px" }}>{active.title}</h3>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        {active.body}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="primary" onClick={() => dismiss(active.id)}>
          Got it
        </button>
      </div>
    </div>
  );
}

export default TutorialOverlay;

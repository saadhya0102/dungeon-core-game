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
      "You are a living Dungeon Core. Use the Dig tool to carve out rooms, " +
      "open the Units panel to place monsters, then press Run Wave to face " +
      "the adventurers.",
    match: (run) => run.wave === 1 && run.units.length === 0,
  },
  {
    id: "firstUnit",
    title: "Your First Monster",
    body:
      "Hover or click a placed unit to inspect it. In Select mode you can drag " +
      "a unit to reposition it, and you can equip gear through the inspector.",
    match: (run, _phase, seen) => run.units.length >= 1 && seen.has("welcome"),
  },
  {
    id: "firstWaveCleared",
    title: "Wave Survived",
    body:
      "You earned Dungeon Points (DP). Spend them on more units, research, " +
      "traps, or Core upgrades, then run the next wave when you are ready.",
    match: (_run, phase) => phase === "result",
  },
  {
    id: "research",
    title: "Open the Research Lab",
    body:
      "With some DP banked, open Research to unlock new monsters and permanent " +
      "upgrades for this run.",
    match: (run) => run.research.owned.length < 3 && run.dp >= 60,
  },
  {
    id: "coreUp",
    title: "Upgrade Your Core",
    body:
      "A Core Level upgrade raises your capacity and lets you dig a larger " +
      "dungeon. Open the Core panel to spend DP on it.",
    match: (run) => run.dp >= 120 && run.core.level === 1,
  },
  {
    id: "trapsTip",
    title: "Lay Some Traps",
    body:
      "Traps stay hidden until rogues reveal them. Spammers and anti-rogue " +
      "traps are great for punishing scouts. Open the Traps panel to place them.",
    match: (run) => run.wave >= 3,
  },
  {
    id: "gearShop",
    title: "The Gear Shop Is Open",
    body:
      "Your Core reached Level 3, unlocking the Gear Shop. Buy weapons and armor " +
      "there, then equip them on your units to push deeper.",
    match: (run) => run.core.level >= 3,
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

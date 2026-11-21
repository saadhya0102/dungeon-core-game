import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../state/store";
import type { RunState } from "../sim/types";
import type { Phase } from "../state/store";

// ============================================================================
// Polished, guided first-time onboarding. Spotlights each UI region and walks
// the player through the goal and every core action. Shown on the first run
// (or any run started with the "tutorial" modifier). Persists completion.
// ============================================================================

const DONE_KEY = "dc_tutorial_done";

type Anchor = "center" | "topbar" | "buildbar" | "bottombar" | "inspector";

interface Step {
  id: string;
  anchor: Anchor;
  title: string;
  body: string;
  // If set, the step auto-advances when the predicate becomes true (player did it).
  action?: (run: RunState, phase: Phase, selectionKind: string | null) => boolean;
  actionHint?: string;
  big?: boolean;
}

const STEPS: Step[] = [
  {
    id: "welcome", anchor: "center", big: true,
    title: "Welcome, Dungeon Core",
    body:
      "You are the glowing crystal at the heart of this dungeon. Waves of heroes will " +
      "march in to destroy you. Your goal: build a deadly maze of monsters and traps so " +
      "they never reach you.\n\nEach round you BUILD, then run a WAVE and watch the fight, " +
      "then spend the loot to grow stronger. Survive as long as you can.",
  },
  {
    id: "core", anchor: "center",
    title: "The Core & the Gate",
    body:
      "The purple diamond in the middle is YOU \u2014 if its health hits zero, the run ends. " +
      "The blue ring is the Entrance Gate, where adventurers spawn. They explore, fight " +
      "your monsters, and try to smash the core. Force them through a long, deadly route.",
  },
  {
    id: "topbar", anchor: "topbar",
    title: "Your Vitals (top bar)",
    body:
      "Up here: DP (Dungeon Points \u2014 your currency), your Core Level & HP, Capacity " +
      "(how much army you can field), the current Wave, Tiles opened, and INCOMING \u2014 a " +
      "scout report of the next wave's size, tiers, and makeup. Always check it before fighting.",
  },
  {
    id: "buildbar", anchor: "buildbar",
    title: "Build Tools (left bar)",
    body:
      "Inspect: click things to see their details or move them. Dig: carve open stone. Recruit and Traps: buy " +
      "and place defenders. Research: unlock monsters & upgrades. Gear Shop (CL3+): buy " +
      "equipment. Core Up: level your core. Save Dungeon: bank this layout for Head-to-Head.",
  },
  {
    id: "dig", anchor: "buildbar",
    title: "Carve Out a Room",
    body:
      "Click the Dig tool, then click (or drag a rectangle over) the dark stone next to your " +
      "floor. Dig out a proper ROOM, not just a hallway \u2014 bigger monsters literally need " +
      "bigger open rooms to be placed.",
    actionHint: "Dig a few tiles to continue\u2026",
    action: (run) => run.map.openedCount >= 29,
  },
  {
    id: "place", anchor: "buildbar",
    title: "Place Your First Monster",
    body:
      "Open Recruit, choose a monster (start with a Goblin Grunt), then click an open floor tile " +
      "to place it. Tip: a unit can be near at most 5 others, and same-FACTION units near each " +
      "other gain a stat bonus \u2014 so build themed rooms.",
    actionHint: "Place a unit to continue\u2026",
    action: (run) => run.units.length >= 1,
  },
  {
    id: "inspect", anchor: "inspector",
    title: "Inspect & Equip",
    body:
      "Click a placed unit to open its panel here. You'll see its stats, AFFINITIES (which " +
      "gear it's good with), and SPECIAL ABILITIES (burn, freeze, berserk, etc.). Equip looted " +
      "gear that matches its strong affinity for big power spikes.",
    actionHint: "Click one of your units to continue\u2026",
    action: (_run, _phase, sel) => sel === "unit",
  },
  {
    id: "runwave", anchor: "bottombar",
    title: "Run the Wave",
    body:
      "When ready, set a playback speed and press Start wave. Ranged units and mages need LINE " +
      "OF SIGHT \u2014 they can't shoot through unexplored stone \u2014 so give them clear lanes. " +
      "Watch how the fight goes and learn what to adjust.",
    actionHint: "Start the wave to continue…",
    action: (_run, phase) => phase === "wave" || phase === "result",
  },
  {
    id: "result", anchor: "center",
    title: "Spoils of War",
    body:
      "You earn DP for every kill plus a survival bonus, and sometimes gear drops. Spend DP on " +
      "more units, Research, Traps, or a Core upgrade. Waves grow bigger and tougher over time, " +
      "with the occasional crusade led by a named champion.",
  },
  {
    id: "graduate", anchor: "center", big: true,
    title: "You're Ready, Dungeon Lord",
    body:
      "That's the loop: dig rooms, place counters, equip gear, research upgrades, level your " +
      "core, and survive. Bring AoE for hordes, spammers/detection for rogues, tanks up front " +
      "and casters behind.\n\nWhen you've built something you're proud of, Save it and set it as " +
      "your Main in Saved Dungeons to battle other players in Head-to-Head. Good luck!",
  },
];

function isDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return false; }
}
function setDone() {
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
}

export function GuidedTutorial() {
  const run = useStore((s) => s.run);
  const phase = useStore((s) => s.phase);
  const selection = useStore((s) => s.selection);
  const openPanel = useStore((s) => s.openPanel);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Activate on first run, or any run flagged tutorial.
  useEffect(() => {
    if (!run) { setActive(false); return; }
    const force = run.modifiers.includes("tutorial");
    setActive(force || !isDone());
  }, [run]);

  const cur = STEPS[step];
  const selKind = selection?.kind ?? null;

  // Auto-advance action steps when completed.
  useEffect(() => {
    if (!active || !run || !cur?.action) return;
    if (cur.action(run, phase, selKind)) {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  }, [active, run, phase, selKind, cur]);

  if (!active || dismissed || !run) return null;
  if (openPanel || run.idle) return null;
  if (phase === "wave") return null; // don't cover the battle
  if (!cur) return null;

  const finish = () => { setDone(); setDismissed(true); };
  const next = () => { if (step >= STEPS.length - 1) finish(); else setStep(step + 1); };
  const back = () => setStep(Math.max(0, step - 1));

  const spot = spotlightRect(cur.anchor);
  const card = cardPosition(cur.anchor, cur.big);
  if (cur.action) {
    return (
      <aside className="guided-action" aria-label="Tutorial">
        <div><strong>{cur.title}</strong><p>{cur.body}</p></div>
        <div className="guided-actions">
          <span>{cur.actionHint}</span>
          {step > 0 && <button onClick={back}>Back</button>}
          <button onClick={finish}>Skip tutorial</button>
        </div>
      </aside>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      {/* Highlight the anchored region WITHOUT dimming the rest (so you can click). */}
      {spot && (
        <div style={{
          position: "fixed", ...spot, borderRadius: 10,
          boxShadow: "0 0 0 3px rgba(185,140,255,0.55), 0 0 22px 4px rgba(185,140,255,0.45)",
          border: "2px solid var(--accent)", pointerEvents: "none",
          transition: "all .2s ease",
        }} />
      )}

      {/* Coachmark card */}
      <div className="panel" style={{
        position: "fixed", ...card, width: cur.big ? 460 : 340, maxWidth: "92vw",
        maxHeight: "none", padding: 18, pointerEvents: "auto",
        boxShadow: "0 10px 36px #000a", borderColor: "var(--accent)",
      }}>
        <div className="small" style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".6px" }}>
          Tutorial &middot; {step + 1}/{STEPS.length}
        </div>
        <h2 style={{ margin: "4px 0 8px", fontSize: cur.big ? 24 : 19 }}>{cur.title}</h2>
        <p className="hint" style={{ margin: "0 0 14px", whiteSpace: "pre-line", lineHeight: 1.5 }}>{cur.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {step > 0 && <button onClick={back}>Back</button>}
          <button className="small" style={{ marginLeft: 0 }} onClick={finish}>Skip tutorial</button>
          <div style={{ flex: 1 }} />
          <button className="primary" onClick={next}>{step >= STEPS.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}

function spotlightRect(anchor: Anchor): CSSProperties | null {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (anchor) {
    case "topbar": return { top: 4, left: 6, width: w - 12, height: 50 };
    case "buildbar": return { top: 58, left: 6, width: 150, height: Math.min(360, h - 130) };
    case "bottombar": return { left: 6, top: h - 58, width: w - 12, height: 50 };
    case "inspector": return { top: 58, left: w - 290, width: 280, height: Math.min(440, h - 130) };
    case "center": return null;
  }
}

function cardPosition(anchor: Anchor, big?: boolean): CSSProperties {
  const w = window.innerWidth;
  if (w < 620 && (anchor === "buildbar" || anchor === "inspector")) {
    return { top: 76, left: "50%", transform: "translateX(-50%)" };
  }
  switch (anchor) {
    case "topbar": return { top: 64, left: "50%", transform: "translateX(-50%)" };
    case "buildbar": return { top: 96, left: 168 };
    case "bottombar": return { bottom: 70, left: "50%", transform: "translateX(-50%)" };
    case "inspector": return { top: 96, left: Math.max(12, w - 290 - 360) };
    case "center": return { top: big ? "32%" : "40%", left: "50%", transform: "translate(-50%, -20%)" };
  }
}

export default GuidedTutorial;

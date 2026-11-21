// ============================================================================
// Client store (Zustand) - holds the run, UI state, and wave playback.
// Wraps the shared sim action helpers; mutates then bumps a reference.
// ============================================================================
import { create } from "zustand";
import type { RunState, Timeline, GearSlot, NGModifier, Snapshot } from "../sim/types";
import * as sim from "../sim";
import { applyWaveResult, ACH_BY_ID } from "../sim";
import { evaluateAchievements, mergeCounters } from "../game/achievements";
import { clearActiveRun, saveActiveRun, saveSnapshot } from "../net/persistence";
import { recordSwift } from "../net/kingdom";
import type { SwiftRule } from "../sim/kingdom";
import { advanceIdle, IDLE_INTERVAL_MS, promoteIdle } from "../sim/idle";
import type { IdleReport } from "../sim/idle";
import { saveIdleRun } from "../net/idle";

function readJson(key: string): Record<string, number> {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function writeJson(key: string, v: Record<string, number>) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

function processAchievements(runStats: Record<string, number>): string[] {
  const lifetime = readJson("dc_ach_lifetime");
  for (const [k, v] of Object.entries(runStats)) {
    lifetime[k] = Math.max(lifetime[k] ?? 0, v);
  }
  writeJson("dc_ach_lifetime", lifetime);
  const unlocked = readJson("dc_ach_unlocked");
  const counters = mergeCounters(runStats, lifetime);
  const { newlyUnlocked } = evaluateAchievements(counters, unlocked);
  if (newlyUnlocked.length) {
    const now = Date.now();
    for (const id of newlyUnlocked) unlocked[id] = now;
    writeJson("dc_ach_unlocked", unlocked);
  }
  return newlyUnlocked;
}

export type Phase = "menu" | "build" | "wave" | "result";
export type Tool = "select" | "dig" | "room" | "placeUnit" | "placeTrap" | "move";

export interface Selection {
  kind: "unit" | "trap" | "tile" | "empty" | "core" | "entrance";
  id?: string;
  x?: number;
  y?: number;
}

export interface PendingMove {
  kind: "unit" | "trap" | "core" | "entrance";
  id?: string;
}

interface LastResult {
  dp: number;
  drops: number;
  kills: number;
  cleared: boolean;
  died: boolean;
  coreHp: number;
  cityCleared?: boolean;
}

interface StoreState {
  uid: string;
  run: RunState | null;
  phase: Phase;
  tool: Tool;
  buyDefId: string | null;   // unit or trap def to place
  turretMode: boolean;
  lastOrder: { tool: "placeUnit" | "placeTrap"; id: string; turret: boolean } | null;
  selection: Selection | null;
  pendingMove: PendingMove | null;
  hover: Selection | null;
  toast: string | null;
  openPanel: "units" | "traps" | "research" | "shop" | "core" | null;
  timeline: Timeline | null;
  playSpeed: number;
  playing: boolean;
  cursorTick: number;
  lastResult: LastResult | null;
  achievementsUnlocked: Record<string, number>;
  version: number;
  undoStack: RunState[];
  redoStack: RunState[];
  idleReport: IdleReport | null;

  // actions
  setUid: (uid: string) => void;
  newRun: (modifiers?: NGModifier[], swiftRule?: SwiftRule) => void;
  loadRun: (run: RunState) => void;
  exitRun: () => void;
  setTool: (t: Tool, buyDefId?: string | null, turret?: boolean) => void;
  setHover: (s: Selection | null) => void;
  select: (s: Selection | null) => void;
  setToast: (msg: string | null) => void;
  setPanel: (p: StoreState["openPanel"]) => void;
  repeatOrder: () => void;
  beginMove: () => void;
  cancelMove: () => void;
  onTileClick: (x: number, y: number) => void;
  digRect: (x0: number, y0: number, x1: number, y1: number) => void;
  // panel actions
  act: (fn: (run: RunState) => sim.ActionResult) => boolean;
  buyResearch: (id: string) => void;
  upgradeCore: () => void;
  buyGear: (id: string) => void;
  rerollShop: () => void;
  salvage: (id: string) => void;
  equip: (unitId: string, itemId: string, slot: GearSlot) => void;
  unequip: (unitId: string, slot: GearSlot, itemId?: string) => void;
  sellSelected: () => void;
  saveCurrentDungeon: () => void;
  // wave
  runWave: () => void;
  setPlaySpeed: (n: number) => void;
  setPlaying: (b: boolean) => void;
  setCursor: (t: number) => void;
  finishWave: () => void;
  backToBuild: () => void;
  tickIdle: () => void;
  toggleIdle: () => void;
  increaseIdle: () => void;
  undoBuild: () => void;
  redoBuild: () => void;
  dismissIdleReport: () => void;
}

function bump(set: (p: Partial<StoreState>) => void, run: RunState | null, extra: Partial<StoreState> = {}) {
  if (run) run.updatedAt = Date.now();
  set({ run: run ? { ...run } : null, ...extra });
}

function savedSpeed(): number {
  try {
    const speed = Number(localStorage.getItem("dc_play_speed"));
    return [0.25, 0.5, 1, 2, 4, 8].includes(speed) ? speed : 1;
  } catch { return 1; }
}

const HOLD_HISTORY = 24;

export const useStore = create<StoreState>((set, get) => ({
  uid: "local",
  run: null,
  phase: "menu",
  tool: "select",
  buyDefId: null,
  turretMode: false,
  lastOrder: null,
  selection: null,
  pendingMove: null,
  hover: null,
  toast: null,
  openPanel: null,
  timeline: null,
  playSpeed: savedSpeed(),
  playing: false,
  cursorTick: 0,
  lastResult: null,
  achievementsUnlocked: {},
  version: 0,
  undoStack: [],
  redoStack: [],
  idleReport: null,

  setUid: (uid) => set({ uid }),

  newRun: (modifiers = [], swiftRule) => get().loadRun(sim.createNewRun(get().uid, modifiers, undefined, swiftRule)),

  loadRun: (run) => {
    if (run.idle) {
      const state = structuredClone(run);
      const { report } = advanceIdle(state, Date.now());
      bump(set, state, { phase: "build", tool: "select", selection: null, pendingMove: null, openPanel: null,
        timeline: null, lastResult: null, undoStack: [], redoStack: [], lastOrder: null, toast: null, idleReport: report.waves ? report : null, playing: false });
      if (!saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
      return;
    }
    const city = sim.CAMPAIGN.find((entry) => entry.id === run.cityId);
    const cityCleared = !!city && run.stats.wavesCleared >= city.waves;
    const lastResult = cityCleared
      ? { dp: 0, drops: 0, kills: 0, cleared: true, died: false, coreHp: run.core.hp, cityCleared }
      : null;
    set({ run, phase: cityCleared ? "result" : run.status === "active" ? "build" : "menu",
      tool: "select", selection: null, pendingMove: null, openPanel: null, timeline: null, lastResult, lastOrder: null,
      undoStack: [], redoStack: [], toast: null });
  },
  exitRun: () => {
    const { run, phase } = get();
    if (!run || (phase !== "build" && !run.idle)) return;
    if (!run.idle && !run.practice) void saveActiveRun(run);
    set({ phase: "menu", run: null, timeline: null, playing: false, undoStack: [], redoStack: [], idleReport: null });
  },

  setTool: (tool, buyDefId = null, turret = false) =>
    set({ tool, buyDefId, turretMode: turret, selection: null, pendingMove: null,
      ...(buyDefId && (tool === "placeUnit" || tool === "placeTrap") ? { lastOrder: { tool, id: buyDefId, turret } } : {}) }),

  repeatOrder: () => {
    const order = get().lastOrder;
    if (order) get().setTool(order.tool, order.id, order.turret);
  },

  setHover: (hover) => set({ hover }),
  select: (selection) => set({ selection }),
  setPanel: (openPanel) => set({ openPanel }),

  beginMove: () => {
    const { selection: sel, run } = get();
    if (run?.idle?.nextAt != null) return;
    if (!sel) return;
    if (sel.kind === "unit" && sel.id) set({ pendingMove: { kind: "unit", id: sel.id }, tool: "move" });
    else if (sel.kind === "trap" && sel.id) set({ pendingMove: { kind: "trap", id: sel.id }, tool: "move" });
    else if (sel.kind === "core") set({ pendingMove: { kind: "core" }, tool: "move" });
    else if (sel.kind === "entrance") set({ pendingMove: { kind: "entrance" }, tool: "move" });
    else return;
    get().setToast("Click a destination tile to move it.");
  },
  cancelMove: () => set({ pendingMove: null, tool: "select" }),
  setToast: (toast) => {
    set({ toast });
    if (toast) setTimeout(() => { if (get().toast === toast) set({ toast: null }); }, 2600);
  },

  onTileClick: (x, y) => {
    const { run, tool, buyDefId, turretMode, pendingMove } = get();
    if (!run || get().phase !== "build") return;

    if (tool === "move" && pendingMove) {
      const changed = get().act((draft) => {
        if (pendingMove.kind === "unit" && pendingMove.id) return sim.moveUnit(draft, pendingMove.id, x, y);
        if (pendingMove.kind === "trap" && pendingMove.id) return sim.moveTrap(draft, pendingMove.id, x, y);
        if (pendingMove.kind === "core") return sim.moveCore(draft, x, y);
        if (pendingMove.kind === "entrance") return sim.moveEntrance(draft, x, y);
        return "Choose a unit or trap to move";
      });
      if (changed) set({ pendingMove: null, tool: "select", selection: { kind: pendingMove.kind, id: pendingMove.id, x, y } });
      return;
    }

    // Clicking anything already on the board selects it (and drops the active
    // tool), so there's no need for a dedicated Select button.
    const t = run.map.tiles[`${x},${y}`];
    const occupied = !!t && (!!t.unitId || !!t.trapId || t.state === "core" || t.state === "entrance");
    if (tool === "select" && occupied && t) {
      if (t.unitId) get().select({ kind: "unit", id: t.unitId, x, y });
      else if (t.trapId) get().select({ kind: "trap", id: t.trapId, x, y });
      else if (t.state === "core") get().select({ kind: "core", x, y });
      else get().select({ kind: "entrance", x, y });
      return;
    }

    if (tool === "dig") get().act((draft) => sim.digTile(draft, x, y));
    else if (tool === "room") get().act((draft) => sim.buyRoom(draft, x, y));
    else if (tool === "placeUnit" && buyDefId) get().act((draft) => sim.placeUnit(draft, buyDefId, x, y, turretMode));
    else if (tool === "placeTrap" && buyDefId) get().act((draft) => sim.placeTrap(draft, buyDefId, x, y));
    else get().select(t ? { kind: "tile", x, y } : null);
  },

  digRect: (x0, y0, x1, y1) => {
    const { run } = get();
    if (!run || get().phase !== "build" || get().tool !== "dig") return;
    const minX = Math.max(0, Math.min(x0, x1)), maxX = Math.min(run.map.width - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1)), maxY = Math.min(run.map.height - 1, Math.max(y0, y1));
    get().act((draft) => {
      let any = false;
      let lastErr = "No stone to excavate in that area";
      // Repeat until newly dug tiles stop joining the remaining stone to the floor.
      for (let pass = 0; pass < (maxX - minX) + (maxY - minY) + 1; pass++) {
        let changed = false;
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
          if (sim.isPassable(draft.map, x, y)) continue;
          const error = sim.digTile(draft, x, y);
          if (!error) { any = true; changed = true; } else lastErr = error;
        }
        if (!changed) break;
      }
      return any ? null : lastErr;
    });
  },

  act: (fn) => {
    const { run, phase, undoStack, version } = get();
    if (!run || phase !== "build") return false;
    if (run.idle?.nextAt != null) { get().setToast("Pause the patrol before editing your dungeon."); return false; }
    const draft = structuredClone(run);
    const err = fn(draft);
    if (err) { get().setToast(err); return false; }
    bump(set, draft, { version: version + 1, undoStack: [...undoStack.slice(1 - HOLD_HISTORY), run], redoStack: [] });
    if (draft.idle && !saveIdleRun(draft)) get().setToast("This browser could not save your patrol.");
    return true;
  },

  buyResearch: (id) => get().act((r) => sim.buyResearch(r, id)),
  upgradeCore: () => get().act((r) => sim.upgradeCore(r)),
  buyGear: (id) => get().act((r) => sim.buyGear(r, id)),
  rerollShop: () => get().act((r) => sim.rerollGearShop(r)),
  salvage: (id) => get().act((r) => sim.salvageGear(r, id)),
  equip: (unitId, itemId, slot) => get().act((r) => sim.equipGear(r, unitId, itemId, slot)),
  unequip: (unitId, slot, itemId) => get().act((r) => sim.unequipGear(r, unitId, slot, itemId)),

  sellSelected: () => {
    const sel = get().selection;
    if (!sel) return;
    if (sel.kind === "unit" && sel.id) get().act((r) => sim.sellUnit(r, sel.id!));
    else if (sel.kind === "trap" && sel.id) get().act((r) => sim.sellTrap(r, sel.id!));
    set({ selection: null });
  },

  saveCurrentDungeon: () => {
    const run = get().run;
    if (!run) return;
    const snap: Snapshot = {
      id: `snap_${Date.now().toString(36)}`,
      uid: run.uid,
      name: `Dungeon CL${run.core.level} \u2014 Wave ${run.wave}`,
      createdAt: Date.now(),
      source: "retire",
      endedAtWave: run.wave,
      rating: run.core.level * 100 + run.units.length * 10 + run.traps.length * 5,
      shareable: false,
      dungeon: {
        map: run.map, units: run.units, traps: run.traps,
        inventory: run.inventory, research: run.research, core: run.core,
      },
      simVersion: run.simVersion,
    };
    get().setToast("Saving dungeon snapshot…");
    void saveSnapshot(snap).then((saved) => get().setToast(saved ? "Dungeon snapshot saved" : "Could not save the dungeon snapshot"));
  },

  runWave: () => {
    const { run } = get();
    if (!run || run.idle || get().phase !== "build") return;
    const tl = sim.resolveWave(run);
    set({ timeline: tl, phase: "wave", playing: true, cursorTick: 0, undoStack: [], redoStack: [],
      tool: "select", pendingMove: null, selection: null, openPanel: null });
  },

  setPlaySpeed: (playSpeed) => {
    try { localStorage.setItem("dc_play_speed", String(playSpeed)); } catch { /* browser storage unavailable */ }
    set({ playSpeed });
  },
  setPlaying: (playing) => set({ playing }),
  setCursor: (cursorTick) => set({ cursorTick }),

  finishWave: () => {
    const { run, timeline } = get();
    if (!run || !timeline || get().phase !== "wave") return;
    if (run.idle) { set({ phase: "build", timeline: null, playing: false }); return; }
    const res = applyWaveResult(run, timeline);
    const city = sim.CAMPAIGN.find((entry) => entry.id === run.cityId);
    const cityCleared = !!city && run.stats.wavesCleared >= city.waves;
    if (cityCleared) run.status = "ended";
    const last: LastResult = {
      dp: timeline.reward.dp,
      drops: timeline.reward.drops.length,
      kills: timeline.reward.killCount,
      cleared: timeline.outcome.coreSurvived,
      died: res.died,
      coreHp: run.core.hp,
      cityCleared,
    };
    const newly = processAchievements(run.stats as unknown as Record<string, number>);
    bump(set, run, { phase: "result", playing: false, lastResult: last, version: get().version + 1 });
    if (cityCleared) void saveActiveRun(run);
    else if (res.died && !run.practice) void clearActiveRun(run.uid, !!run.cityId);
    if (!city) void recordSwift(run).catch(() => get().setToast("Swift best saved on this device."));
    if (newly.length) {
      const names = newly.map((id) => ACH_BY_ID[id]?.name ?? id).join(", ");
      setTimeout(() => get().setToast(`Achievement unlocked: ${names}`), 400);
    }
  },

  backToBuild: () => {
    const { run } = get();
    if (!run) return;
    if (run.status === "ended") { set({ phase: "menu", run: null }); return; }
    set({ phase: "build", timeline: null, selection: null });
  },

  tickIdle: () => {
    const { run, phase, version } = get();
    const now = Date.now();
    if (run?.idle?.nextAt == null || run.idle.nextAt > now) return;
    const state = structuredClone(run);
    const { report, timeline } = advanceIdle(state, now, phase === "build" && !document.hidden);
    bump(set, state, { version: version + 1, ...(timeline ? { timeline, phase: "wave", playing: true, cursorTick: 0 } : {}) });
    if (report.waves > 1) set({ idleReport: report });
    if (!saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
  },

  toggleIdle: () => {
    const { run, version } = get();
    if (!run?.idle) return;
    const state = structuredClone(run);
    const now = Date.now();
    const { report } = advanceIdle(state, now);
    state.idle!.nextAt = run.idle.nextAt == null ? now + IDLE_INTERVAL_MS : null;
    bump(set, state, { version: version + 1, phase: "build", timeline: null, playing: false, undoStack: [], redoStack: [],
      tool: "select", selection: null, openPanel: null, pendingMove: null, ...(report.waves > 1 ? { idleReport: report } : {}) });
    if (!saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
  },

  increaseIdle: () => {
    const { run, version } = get();
    if (!run?.idle) return;
    const state = structuredClone(run);
    const now = Date.now();
    advanceIdle(state, now);
    if (!promoteIdle(state)) return;
    if (state.idle!.nextAt != null) state.idle!.nextAt = now + IDLE_INTERVAL_MS;
    bump(set, state, { version: version + 1, phase: "build", timeline: null, playing: false, undoStack: [], redoStack: [] });
    if (!saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
  },

  undoBuild: () => {
    const { run, phase, undoStack, redoStack, version } = get();
    const previous = undoStack.at(-1);
    if (!run || phase !== "build" || run.idle?.nextAt != null || !previous) return;
    const state = structuredClone(previous);
    bump(set, state, { version: version + 1, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, run],
      tool: "select", selection: null, pendingMove: null, openPanel: null });
    if (state.idle && !saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
  },

  redoBuild: () => {
    const { run, phase, undoStack, redoStack, version } = get();
    const next = redoStack.at(-1);
    if (!run || phase !== "build" || run.idle?.nextAt != null || !next) return;
    const state = structuredClone(next);
    bump(set, state, { version: version + 1, undoStack: [...undoStack, run], redoStack: redoStack.slice(0, -1),
      tool: "select", selection: null, pendingMove: null, openPanel: null });
    if (state.idle && !saveIdleRun(state)) get().setToast("This browser could not save your patrol.");
  },

  dismissIdleReport: () => set({ idleReport: null }),
}));

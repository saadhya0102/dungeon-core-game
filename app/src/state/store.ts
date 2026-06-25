// ============================================================================
// Client store (Zustand) - holds the run, UI state, and wave playback.
// Wraps the shared sim action helpers; mutates then bumps a reference.
// ============================================================================
import { create } from "zustand";
import type { RunState, Timeline, GearSlot, NGModifier, Snapshot } from "../sim/types";
import * as sim from "../sim";
import { applyWaveResult, ACH_BY_ID } from "../sim";
import { evaluateAchievements, mergeCounters } from "../game/achievements";
import { saveSnapshot } from "../net/persistence";

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
export type Tool = "select" | "dig" | "placeUnit" | "placeTrap" | "move";

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
}

interface StoreState {
  uid: string;
  run: RunState | null;
  phase: Phase;
  tool: Tool;
  buyDefId: string | null;   // unit or trap def to place
  turretMode: boolean;
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

  // actions
  setUid: (uid: string) => void;
  newRun: (modifiers?: NGModifier[]) => void;
  loadRun: (run: RunState) => void;
  setTool: (t: Tool, buyDefId?: string | null, turret?: boolean) => void;
  setHover: (s: Selection | null) => void;
  select: (s: Selection | null) => void;
  setToast: (msg: string | null) => void;
  setPanel: (p: StoreState["openPanel"]) => void;
  beginMove: () => void;
  cancelMove: () => void;
  onTileClick: (x: number, y: number) => void;
  digRect: (x0: number, y0: number, x1: number, y1: number) => void;
  // panel actions
  act: (fn: (run: RunState) => sim.ActionResult) => void;
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
}

function bump(set: (p: Partial<StoreState>) => void, run: RunState | null, extra: Partial<StoreState> = {}) {
  set({ run: run ? { ...run } : null, ...extra });
}

export const useStore = create<StoreState>((set, get) => ({
  uid: "local",
  run: null,
  phase: "menu",
  tool: "select",
  buyDefId: null,
  turretMode: false,
  selection: null,
  pendingMove: null,
  hover: null,
  toast: null,
  openPanel: null,
  timeline: null,
  playSpeed: 0.5,
  playing: false,
  cursorTick: 0,
  lastResult: null,
  achievementsUnlocked: {},
  version: 0,

  setUid: (uid) => set({ uid }),

  newRun: (modifiers = []) => {
    const run = sim.createNewRun(get().uid, modifiers);
    set({ run, phase: "build", tool: "select", selection: null, timeline: null, lastResult: null });
  },

  loadRun: (run) => set({ run, phase: run.status === "active" ? "build" : "menu" }),

  setTool: (tool, buyDefId = null, turret = false) =>
    set({ tool, buyDefId, turretMode: turret, selection: null }),

  setHover: (hover) => set({ hover }),
  select: (selection) => set({ selection }),
  setPanel: (openPanel) => set({ openPanel }),

  beginMove: () => {
    const sel = get().selection;
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
    let err: sim.ActionResult = null;

    if (tool === "move" && pendingMove) {
      if (pendingMove.kind === "unit" && pendingMove.id) err = sim.moveUnit(run, pendingMove.id, x, y);
      else if (pendingMove.kind === "trap" && pendingMove.id) err = sim.moveTrap(run, pendingMove.id, x, y);
      else if (pendingMove.kind === "core") err = sim.moveCore(run, x, y);
      else if (pendingMove.kind === "entrance") err = sim.moveEntrance(run, x, y);
      if (err) { get().setToast(err); return; }
      const moved = pendingMove;
      set({ pendingMove: null, tool: "select" });
      bump(set, run, { version: get().version + 1, selection: { kind: moved.kind, id: moved.id, x, y } });
      return;
    }

    if (tool === "dig") err = sim.digTile(run, x, y);
    else if (tool === "placeUnit" && buyDefId) err = sim.placeUnit(run, buyDefId, x, y, turretMode);
    else if (tool === "placeTrap" && buyDefId) err = sim.placeTrap(run, buyDefId, x, y);
    else if (tool === "select") {
      const t = run.map.tiles[`${x},${y}`];
      if (t?.unitId) get().select({ kind: "unit", id: t.unitId, x, y });
      else if (t?.trapId) get().select({ kind: "trap", id: t.trapId, x, y });
      else if (t?.state === "core") get().select({ kind: "core", x, y });
      else if (t?.state === "entrance") get().select({ kind: "entrance", x, y });
      else if (t) get().select({ kind: "tile", x, y });
      else get().select(null);
      return;
    }
    if (err) get().setToast(err);
    else bump(set, run, { version: get().version + 1 });
  },

  digRect: (x0, y0, x1, y1) => {
    const { run } = get();
    if (!run) return;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    let any = false; let lastErr: sim.ActionResult = null;
    // multiple passes so adjacency propagates
    for (let pass = 0; pass < (maxX - minX) + (maxY - minY) + 1; pass++) {
      let changed = false;
      for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
        if (sim.isPassable(run.map, x, y)) continue;
        const e = sim.digTile(run, x, y);
        if (!e) { any = true; changed = true; } else lastErr = e;
      }
      if (!changed) break;
    }
    if (any) bump(set, run, { version: get().version + 1 });
    else if (lastErr) get().setToast(lastErr);
  },

  act: (fn) => {
    const { run } = get();
    if (!run) return;
    const err = fn(run);
    if (err) get().setToast(err);
    else bump(set, run, { version: get().version + 1 });
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
    saveSnapshot(snap);
    get().setToast("Dungeon saved. Set it as your Main in Saved Dungeons to use it in H2H.");
  },

  runWave: () => {
    const { run } = get();
    if (!run) return;
    const tl = sim.resolveWave(run);
    set({ timeline: tl, phase: "wave", playing: true, cursorTick: 0 });
  },

  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  setPlaying: (playing) => set({ playing }),
  setCursor: (cursorTick) => set({ cursorTick }),

  finishWave: () => {
    const { run, timeline } = get();
    if (!run || !timeline) return;
    const res = applyWaveResult(run, timeline);
    const last: LastResult = {
      dp: timeline.reward.dp,
      drops: timeline.reward.drops.length,
      kills: timeline.reward.killCount,
      cleared: timeline.outcome.coreSurvived,
      died: res.died,
      coreHp: run.core.hp,
    };
    const newly = processAchievements(run.stats as unknown as Record<string, number>);
    bump(set, run, { phase: "result", playing: false, lastResult: last, version: get().version + 1 });
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
}));

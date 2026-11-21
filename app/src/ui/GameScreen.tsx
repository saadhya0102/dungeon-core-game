import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { DungeonView } from "../game/pixi/DungeonView";
import { saveActiveRun, saveLocalActiveRun } from "../net/persistence";
import { idleSaveKey, loadIdleRun } from "../net/idle";
import { TopBar } from "./TopBar";
import { BuildBar } from "./BuildBar";
import { Inspector } from "./Inspector";
import { Panels } from "./Panels";
import { WaveBar } from "./WaveBar";
import { ResultOverlay } from "./ResultOverlay";
import { TutorialOverlay } from "./TutorialOverlay";
import { GuidedTutorial } from "./GuidedTutorial";
import { IdleBar } from "./IdleBar";
import { PlannerBoard } from "./PlannerBoard";
import { BoardControls, ControlHelp } from "./BoardControls";
import { buildOrder } from "./buildFeedback";
import { CONFIG } from "../sim";

export function GameScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<DungeonView | null>(null);
  const centeredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [simple, setSimple] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(false);
  const [help, setHelp] = useState(false);
  const [centerKey, setCenterKey] = useState(0);

  const run = useStore((s) => s.run);
  const version = useStore((s) => s.version);
  const phase = useStore((s) => s.phase);
  const tool = useStore((s) => s.tool);
  const buyDefId = useStore((s) => s.buyDefId);
  const turretMode = useStore((s) => s.turretMode);
  const selection = useStore((s) => s.selection);
  const timeline = useStore((s) => s.timeline);
  const toast = useStore((s) => s.toast);
  const nextPatrol = run?.idle?.nextAt;
  const building = phase === "build" && nextPatrol == null;

  function center() {
    const current = useStore.getState().run;
    if (!current) return;
    viewRef.current?.fitDungeon(current);
    setCenterKey((value) => value + 1);
  }

  function recoverGraphics(error: unknown) {
    console.warn("Using the planning board after a graphics issue.", error);
    setGraphicsFailed(true);
    setSimple(true);
  }

  useEffect(() => {
    if (simple || !hostRef.current) return;
    let active = true;
    setReady(false);
    centeredRef.current = false;
    const view = new DungeonView(hostRef.current);
    viewRef.current = view;
    view.onClick = (x, y) => useStore.getState().onTileClick(x, y);
    view.onHover = (info) => useStore.getState().setHover(info ? { kind: "tile", x: info.x, y: info.y } : null);
    view.onDragDig = (x0, y0, x1, y1) => useStore.getState().digRect(x0, y0, x1, y1);
    view.onCancel = () => useStore.getState().setTool("select");
    view.onError = (error) => { if (active) recoverGraphics(error); };
    const timeout = window.setTimeout(() => { if (active) recoverGraphics("Renderer startup timed out"); }, 4500);
    void view.init().then(() => { if (active) setReady(true); })
      .catch((error) => { if (active) recoverGraphics(error); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); view.destroy(); viewRef.current = null; };
  }, [simple]);

  // Re-center whenever a different run is loaded (new run, continue, etc.)
  useEffect(() => {
    centeredRef.current = false;
  }, [run?.id]);

  // Build scene render
  useEffect(() => {
    const view = viewRef.current;
    if (!ready || !view || !run) return;
    view.toolIsDig = tool === "dig";
    view.toolIsRoom = tool === "room";
    view.checkPlacement = building ? buildOrder(run, tool, buyDefId, turretMode)?.check ?? null : null;
    view.selectionId = selection?.kind === "unit" ? selection.id ?? null : null;
    try {
      if (phase !== "wave" || !centeredRef.current) view.renderBuild(run);
      if (!centeredRef.current) { view.fitDungeon(run); centeredRef.current = true; }
    } catch (error) { recoverGraphics(error); }
  }, [run, version, phase, tool, selection, ready, building, buyDefId, turretMode]);

  // Wave replay
  useEffect(() => {
    const view = viewRef.current;
    if (!ready || !view) return;
    if (phase === "wave" && timeline) {
      view.startReplay(
        timeline,
        () => {
          const state = useStore.getState();
          return state.playing ? (state.run?.idle ? 2 : state.playSpeed) : 0;
        },
        () => useStore.getState().finishWave(),
        (t) => useStore.getState().setCursor(t),
      );
    }
  }, [phase, timeline, ready]);

  useEffect(() => {
    if (!simple || phase !== "wave" || !timeline) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const state = useStore.getState();
      const now = performance.now();
      if (state.phase === "wave" && state.playing) {
        const tick = state.cursorTick + (now - last) * (state.run?.idle ? 2 : state.playSpeed) * CONFIG.TICKS_PER_SEC / 1000;
        state.setCursor(Math.min(tick, timeline.durationTicks));
        if (tick >= timeline.durationTicks) state.finishWave();
      }
      last = now;
    }, 70);
    return () => window.clearInterval(timer);
  }, [simple, phase, timeline]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.repeat) return;
      const state = useStore.getState();
      const run = state.run;
      if (!run) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (help) setHelp(false);
        else if (state.openPanel) state.setPanel(null);
        else if (state.pendingMove) state.cancelMove();
        else state.setTool("select");
        return;
      }
      if (help || (event.target instanceof HTMLElement && event.target.closest("input, select, textarea, [contenteditable]"))) return;
      if (key === "?" && !state.openPanel) { setHelp(true); return; }
      if (key === "f" && !state.openPanel) { center(); return; }
      if (state.phase === "wave" && !run.idle && key === " " && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        state.setPlaying(!state.playing);
        return;
      }
      if (state.phase !== "build" || run.idle?.nextAt != null) return;
      if (event.ctrlKey || event.metaKey) {
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (key === "y" || event.shiftKey) state.redoBuild();
          else state.undoBuild();
        }
        return;
      }
      if (state.openPanel) return;
      switch (key) {
        case "1": state.setTool("select"); break;
        case "2": if (run.swiftRule !== "oneRoom") state.setTool("dig"); break;
        case "3": if (run.swiftRule !== "oneRoom") state.setTool("room"); break;
        case "4": if (run.swiftRule !== "noUnits") state.setPanel("units"); break;
        case "5": if (run.swiftRule !== "unitsOnly") state.setPanel("traps"); break;
        case "6": state.setPanel("research"); break;
        case "b": state.repeatOrder(); break;
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [help]);

  // Autosave (debounced)
  useEffect(() => {
    if (!run || run.idle || run.practice || run.status === "ended") return;
    saveLocalActiveRun(run);
    const id = setTimeout(() => {
      void saveActiveRun(run);
    }, 1200);
    return () => clearTimeout(id);
  }, [run, version]);

  useEffect(() => {
    if (nextPatrol == null) return;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      const remaining = nextPatrol - Date.now();
      if (remaining > 0) timer = window.setTimeout(tick, remaining);
      else useStore.getState().tickIdle();
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [nextPatrol]);

  useEffect(() => {
    function refresh(event: StorageEvent) {
      const current = useStore.getState().run;
      if (!current?.idle || event.key !== idleSaveKey(current.uid)) return;
      const saved = loadIdleRun(current.uid);
      if (!saved || saved.updatedAt <= current.updatedAt) return;
      useStore.setState({ run: saved, phase: "build", tool: "select", timeline: null, selection: null,
        pendingMove: null, openPanel: null, playing: false, undoStack: [], redoStack: [] });
    }
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  return (
    <div className="game">
      <TopBar />
      <div className="main">
        <div className="pixi-host" ref={hostRef} />
        {simple && run && <PlannerBoard run={run} centerKey={centerKey} active={building}
          onTile={(x, y) => useStore.getState().onTileClick(x, y)}
          onHover={(x, y) => useStore.getState().setHover({ kind: "tile", x, y })} />}
        <BoardControls fallback={simple || !ready} onCenter={center}
          onZoom={(factor) => viewRef.current?.zoomBy(factor)} onHelp={() => setHelp(true)} />
        {!simple && !ready && <div className="graphics-status" role="status">Opening dungeon <button onClick={() => setSimple(true)}>Use planning board</button></div>}
        {simple && <div className="graphics-status">{graphicsFailed ? "Graphics unavailable · planning board" : "Planning board"} <button onClick={() => { setGraphicsFailed(false); setSimple(false); }}>Try graphics</button></div>}
        {(run?.idle ? building : phase !== "wave") && <BuildBar />}
        {(!run?.idle || building) && <Inspector />}
        <Panels />
        {help && <ControlHelp onClose={() => setHelp(false)} />}
        {toast && <div className="toast">{toast}</div>}
        {phase === "result" && <ResultOverlay />}
      </div>
      {!run?.idle && !help && <GuidedTutorial />}
      {!help && <TutorialOverlay />}
      {run?.idle ? <IdleBar /> : <WaveBar />}
    </div>
  );
}

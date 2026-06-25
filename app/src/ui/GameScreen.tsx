import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { DungeonView } from "../game/pixi/DungeonView";
import { saveActiveRun, clearActiveRun } from "../net/persistence";
import { TopBar } from "./TopBar";
import { BuildBar } from "./BuildBar";
import { Inspector } from "./Inspector";
import { Panels } from "./Panels";
import { WaveBar } from "./WaveBar";
import { ResultOverlay } from "./ResultOverlay";
import { TutorialOverlay } from "./TutorialOverlay";
import { GuidedTutorial } from "./GuidedTutorial";

export function GameScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<DungeonView | null>(null);
  const centeredRef = useRef(false);

  const run = useStore((s) => s.run);
  const version = useStore((s) => s.version);
  const phase = useStore((s) => s.phase);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const timeline = useStore((s) => s.timeline);
  const toast = useStore((s) => s.toast);

  // Create the Pixi view once
  useEffect(() => {
    if (!hostRef.current) return;
    const view = new DungeonView(hostRef.current);
    viewRef.current = view;
    view.onClick = (x, y) => useStore.getState().onTileClick(x, y);
    view.onHover = (info) => useStore.getState().setHover(info ? { kind: "tile", x: info.x, y: info.y } : null);
    view.onDragDig = (x0, y0, x1, y1) => useStore.getState().digRect(x0, y0, x1, y1);
    view.init();
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  // Re-center whenever a different run is loaded (new run, continue, etc.)
  useEffect(() => {
    centeredRef.current = false;
  }, [run?.id]);

  // Build scene render
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !run) return;
    view.toolIsDig = tool === "dig";
    view.selectionId = selection?.kind === "unit" ? selection.id ?? null : null;
    if (phase === "build" || phase === "result") {
      view.renderBuild(run);
      if (!centeredRef.current) { view.centerOn(run.map.core.x, run.map.core.y); centeredRef.current = true; }
    }
  }, [run, version, phase, tool, selection]);

  // Wave replay
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (phase === "wave" && timeline) {
      view.startReplay(
        timeline,
        () => (useStore.getState().playing ? useStore.getState().playSpeed : 0),
        () => useStore.getState().finishWave(),
        (t) => useStore.getState().setCursor(t),
      );
    }
  }, [phase, timeline]);

  // Autosave (debounced)
  useEffect(() => {
    if (!run) return;
    const id = setTimeout(() => {
      if (run.status === "ended") clearActiveRun(run.uid);
      else saveActiveRun(run);
    }, 1200);
    return () => clearTimeout(id);
  }, [run, version]);

  return (
    <div className="game">
      <TopBar />
      <div className="main">
        <div className="pixi-host" ref={hostRef} />
        {phase !== "wave" && <BuildBar />}
        <Inspector />
        <Panels />
        {toast && <div className="toast">{toast}</div>}
        {phase === "result" && <ResultOverlay />}
        <TutorialOverlay />
        <GuidedTutorial />
      </div>
      <WaveBar />
    </div>
  );
}

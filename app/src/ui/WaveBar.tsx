import { useStore } from "../state/store";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

function SpeedPicker() {
  const playSpeed = useStore((s) => s.playSpeed);
  const setPlaySpeed = useStore((s) => s.setPlaySpeed);
  return (
    <div className="speeds">
      {SPEEDS.map((s) => (
        <button key={s} className={playSpeed === s ? "active" : ""} onClick={() => setPlaySpeed(s)}>{s}x</button>
      ))}
    </div>
  );
}

export function WaveBar() {
  const phase = useStore((s) => s.phase);
  const run = useStore((s) => s.run);
  const runWave = useStore((s) => s.runWave);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const finishWave = useStore((s) => s.finishWave);
  const timeline = useStore((s) => s.timeline);
  const cursor = useStore((s) => s.cursorTick);
  const openPanel = useStore((s) => s.openPanel);
  if (!run) return null;

  if (phase === "build" || phase === "result") {
    return (
      <div className="bottombar">
        <button className="primary big wave-launch" disabled={phase === "result" || !!openPanel} onClick={runWave}>Start wave {run.wave}</button>
        <span className="small speed-label">Replay speed</span>
        <SpeedPicker />
        <div className="log">{run.units.length || run.traps.length
          ? `${run.units.length} ${run.units.length === 1 ? "unit" : "units"} · ${run.traps.length} ${run.traps.length === 1 ? "trap" : "traps"}`
          : "No defenders or traps placed"}</div>
      </div>
    );
  }

  const progress = timeline ? Math.min(100, (cursor / timeline.durationTicks) * 100) : 0;
  let kills = 0;
  let totalInvaders = 0;
  if (timeline) {
    totalInvaders = timeline.meta.filter((m) => m.side === "invader" && !m.id.includes("_add_")).length;
    for (const ev of timeline.events) {
      if (ev.tick > cursor) break;
      if (ev.type === "death" && ev.data?.side === "invader" && ev.targetId && !ev.targetId.includes("_add_")) kills++;
    }
  }
  return (
    <div className="bottombar">
      <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
      <SpeedPicker />
      <button onClick={finishWave}>Skip</button>
      <div className="bar" style={{ flex: 1, height: 10 }}>
        <div style={{ width: `${progress}%`, background: "var(--accent)" }} />
      </div>
      <div className="log">Wave {run.wave} &middot; invaders slain {kills}/{totalInvaders}</div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DungeonView } from "../game/pixi/DungeonView";
import { frozenToRun } from "../sim";
import type { Snapshot, H2HMatchResult } from "../sim";

const SPEEDS = [0.5, 1, 2, 4];

export function H2HMatchView({ challenger, opponent, result, onClose }: {
  challenger: Snapshot;
  opponent: Snapshot;
  result: H2HMatchResult;
  onClose: () => void;
}) {
  const leftHost = useRef<HTMLDivElement>(null);
  const rightHost = useRef<HTMLDivElement>(null);
  const leftView = useRef<DungeonView | null>(null);
  const rightView = useRef<DungeonView | null>(null);

  const [round, setRound] = useState(0);
  const [roundDone, setRoundDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const speedRef = useRef(1);
  const playingRef = useRef(true);
  const done = useRef({ left: false, right: false });
  speedRef.current = speed;
  playingRef.current = playing;

  // Create the two Pixi views once.
  useEffect(() => {
    if (!leftHost.current || !rightHost.current) return;
    let cancelled = false;
    const lv = new DungeonView(leftHost.current);
    const rv = new DungeonView(rightHost.current);
    leftView.current = lv; rightView.current = rv;
    Promise.all([lv.init(), rv.init()]).then(() => { if (!cancelled) setReady(true); });
    return () => {
      cancelled = true;
      setReady(false);
      lv.destroy(); rv.destroy();
      leftView.current = null; rightView.current = null;
    };
  }, []);

  // Play the current round on both sides (once the views are ready).
  useEffect(() => {
    if (!ready) return;
    const lv = leftView.current, rv = rightView.current;
    if (!lv || !rv) return;
    const r = result.rounds[round];
    if (!r) return;
    setRoundDone(false);
    setPlaying(true);
    done.current = { left: false, right: false };

    const lRun = frozenToRun(challenger.dungeon, 1);
    const rRun = frozenToRun(opponent.dungeon, 2);
    lv.renderBuild(lRun); lv.centerOn(lRun.map.core.x, lRun.map.core.y);
    rv.renderBuild(rRun); rv.centerOn(rRun.map.core.x, rRun.map.core.y);

    const getSpeed = () => (playingRef.current ? speedRef.current : 0);
    const checkDone = () => { if (done.current.left && done.current.right) setRoundDone(true); };
    lv.startReplay(r.challengerTimeline, getSpeed, () => { done.current.left = true; checkDone(); }, () => {});
    rv.startReplay(r.opponentTimeline, getSpeed, () => { done.current.right = true; checkDone(); }, () => {});
  }, [round, ready, challenger, opponent, result]);

  const r = result.rounds[round];
  const isLast = round >= result.rounds.length - 1;

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: "min(1100px, 96vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>H2H &mdash; Round {round + 1} / {result.rounds.length}</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <SidePanel name="You" snap={challenger} survived={r?.challengerSurvived} hp={r?.challengerCoreHp} hostRef={leftHost} accent="var(--good)" />
          <SidePanel name="Rival" snap={opponent} survived={r?.opponentSurvived} hp={r?.opponentCoreHp} hostRef={rightHost} accent="var(--danger)" />
        </div>

        <div className="bottombar" style={{ borderTop: "none", marginTop: 8, padding: "8px 0" }}>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
          <div className="speeds">
            {SPEEDS.map((s) => <button key={s} className={speed === s ? "active" : ""} onClick={() => setSpeed(s)}>{s}x</button>)}
          </div>
          <div className="log">
            {roundDone
              ? (r ? `Round ${round + 1}: You ${r.challengerSurvived ? "held" : "fell"} \u00b7 Rival ${r.opponentSurvived ? "held" : "fell"}` : "")
              : "Both dungeons face the same wave\u2026"}
          </div>
          {roundDone && !isLast && <button className="primary" onClick={() => setRound((n) => n + 1)}>Next Round</button>}
          {roundDone && isLast && (
            <b style={{ color: result.winner === "challenger" ? "var(--good)" : result.winner === "opponent" ? "var(--danger)" : "var(--muted)" }}>
              {result.winner === "challenger" ? "VICTORY" : result.winner === "opponent" ? "DEFEAT" : "DRAW"}
            </b>
          )}
        </div>
      </div>
    </div>
  );
}

function SidePanel({ name, snap, survived, hp, hostRef, accent }: {
  name: string; snap: Snapshot; survived?: boolean; hp?: number;
  hostRef: RefObject<HTMLDivElement | null>; accent: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <b style={{ color: accent }}>{name}</b>
        <span className="small">{snap.name} &middot; {survived === undefined ? "" : survived ? `core ${Math.ceil(hp ?? 0)}` : "core destroyed"}</span>
      </div>
      <div ref={hostRef} className="h2h-canvas" style={{ position: "relative", height: "46vh", background: "#0e0f1a", borderRadius: 8, border: `1px solid var(--border)` }} />
    </div>
  );
}

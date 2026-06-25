import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { loadSnapshots, deleteSnapshot, setMainDungeon, clearMainDungeon, getMainId } from "../net/persistence";
import type { Snapshot } from "../sim/types";

export function SnapshotsView({ onClose }: { onClose: () => void }) {
  const uid = useStore((s) => s.uid);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [mainId, setMainIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setMainIdState(getMainId(uid));
    loadSnapshots(uid)
      .then((list) => { setSnapshots(list); setLoading(false); })
      .catch(() => { setSnapshots([]); setLoading(false); });
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [uid]);

  async function onSetMain(s: Snapshot) {
    setBusy(s.id);
    await setMainDungeon(s);
    setMainIdState(s.id);
    setBusy(null);
  }
  async function onClearMain() {
    setBusy("clear");
    await clearMainDungeon(uid);
    setMainIdState(null);
    setBusy(null);
  }
  async function onDelete(s: Snapshot) {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    setBusy(s.id);
    await deleteSnapshot(uid, s.id);
    setSnapshots((prev) => prev.filter((x) => x.id !== s.id));
    if (mainId === s.id) setMainIdState(null);
    setBusy(null);
  }

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Saved Dungeons ({snapshots.length})</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="hint">
          Pick ONE dungeon as your <b>Main</b> &mdash; that is the only dungeon other players can face in Head-to-Head, and it's the dungeon you bring as the challenger.
        </div>
        {mainId && <div className="small">Current Main is set. <button className="small" onClick={onClearMain} disabled={busy === "clear"}>Unset Main</button></div>}
        {loading
          ? <div className="small">Loading snapshots&hellip;</div>
          : snapshots.length === 0
            ? <div className="small">No saved dungeons yet &mdash; use "Save Dungeon" during a run, or finish a run to capture one.</div>
            : (
              <div className="grid-cards">
                {snapshots.map((s) => {
                  const isMain = s.id === mainId;
                  return (
                    <div key={s.id} className="card" style={{ cursor: "default", borderColor: isMain ? "var(--gold)" : undefined }}>
                      <div className="name">{isMain ? "\u2605 " : ""}{s.name}</div>
                      <div className="meta">Reached wave {s.endedAtWave} &middot; rating {s.rating}</div>
                      <div className="meta">{s.source}{isMain ? " \u00b7 MAIN (shown in H2H)" : ""}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button className="small" disabled={busy === s.id || isMain} onClick={() => onSetMain(s)}>
                          {isMain ? "Is Main" : "Set as Main"}
                        </button>
                        <button className="small danger" disabled={busy === s.id} onClick={() => onDelete(s)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
}

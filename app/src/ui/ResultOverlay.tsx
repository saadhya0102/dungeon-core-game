import { useStore } from "../state/store";
import { saveSnapshot } from "../net/persistence";
import type { Snapshot } from "../sim/types";

export function ResultOverlay() {
  const result = useStore((s) => s.lastResult);
  const run = useStore((s) => s.run);
  const backToBuild = useStore((s) => s.backToBuild);
  if (!result || !run) return null;

  async function retire(source: "death" | "retire") {
    if (!run) return;
    const snap: Snapshot = {
      id: `snap_${Date.now().toString(36)}`,
      uid: run.uid,
      name: `Dungeon \u2014 Wave ${run.stats.bestWave || run.wave}`,
      createdAt: Date.now(),
      source,
      endedAtWave: run.wave,
      rating: run.core.level * 100 + run.units.length * 10,
      shareable: true,
      dungeon: {
        map: run.map, units: run.units, traps: run.traps, inventory: run.inventory,
        research: run.research, core: run.core,
      },
      simVersion: run.simVersion,
    };
    await saveSnapshot(snap);
    backToBuild();
  }

  if (result.died) {
    return (
      <div className="result">
        <div className="box">
          <h2 style={{ color: "var(--danger)" }}>The Core Has Fallen</h2>
          <p>Your dungeon survived to wave {run.stats.bestWave || run.wave}.</p>
          <div className="row" style={{ justifyContent: "center", gap: 16 }}>
            <span>Total kills: {run.stats.kills}</span>
            <span>DP earned: {run.stats.dpEarned}</span>
          </div>
          <p className="small">Your final dungeon is saved as a snapshot for Head-to-Head.</p>
          <button className="primary big" style={{ marginTop: 12, width: "100%" }} onClick={() => retire("death")}>
            Save &amp; Return to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="result">
      <div className="box">
        <h2 style={{ color: "var(--good)" }}>Wave {run.wave - 1} Cleared!</h2>
        <div className="big-stat">+{result.dp} DP</div>
        <div className="row" style={{ justifyContent: "center", gap: 16, marginTop: 8 }}>
          <span>Kills: {result.kills}</span>
          <span>Drops: {result.drops}</span>
          <span>Core HP: {Math.ceil(result.coreHp)}</span>
        </div>
        <button className="primary big" style={{ marginTop: 16, width: "100%" }} onClick={backToBuild}>
          Continue to Build
        </button>
      </div>
    </div>
  );
}

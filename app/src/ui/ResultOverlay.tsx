import { useStore } from "../state/store";
import { useState } from "react";
import { claimCity } from "../net/kingdom";
import { clearActiveRun, saveSnapshot } from "../net/persistence";
import { CAMPAIGN } from "../sim/kingdom";
import type { Snapshot } from "../sim/types";

export function ResultOverlay() {
  const result = useStore((s) => s.lastResult);
  const run = useStore((s) => s.run);
  const backToBuild = useStore((s) => s.backToBuild);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  if (!result || !run) return null;
  const city = CAMPAIGN.find((entry) => entry.id === run.cityId);

  async function finishCity() {
    if (!city || !run || claiming) return;
    setClaiming(true);
    setError("");
    try {
      await claimCity(run);
      await clearActiveRun(run.uid, true);
      backToBuild();
    } catch {
      setError("Your city clear could not be saved. Try again to return.");
    } finally {
      setClaiming(false);
    }
  }

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

  if (city && result.cityCleared) {
    return <div className="result"><div className="box">
      <h2>{city.name} defended</h2>
      <p>You survived all {city.waves} waves. A first clear earns {city.shards} shards.</p>
      {error && <p role="alert">{error}</p>}
      <button className="primary big" disabled={claiming} onClick={() => void finishCity()}>{claiming ? "Saving…" : "Return to campaign"}</button>
    </div></div>;
  }

  if (result.died) {
    return (
      <div className="result">
        <div className="box">
          <h2 style={{ color: "var(--danger)" }}>The Core Has Fallen</h2>
          <p>{city ? `${city.name} · ${run.stats.wavesCleared}/${city.waves} waves cleared` : `Swift best this run · wave ${run.stats.bestWave}`}</p>
          <div className="row" style={{ justifyContent: "center", gap: 16 }}>
            <span>Total kills: {run.stats.kills}</span>
            <span>DP earned: {run.stats.dpEarned}</span>
          </div>
          {!city && <p className="small">Save this dungeon to your snapshot library.</p>}
          <button className="primary big" style={{ marginTop: 12, width: "100%" }} onClick={() => city ? backToBuild() : void retire("death")}>
            {city ? "Return to campaign" : "Save & return to Swift"}
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

import { useStore } from "../state/store";
import { loadActiveRun } from "../net/persistence";
import { useEffect, useState } from "react";
import { AchievementsView } from "./AchievementsView";
import { SnapshotsView } from "./SnapshotsView";
import { H2H } from "./H2H";
import { ProfileView } from "./ProfileView";

type SubView = "achievements" | "snapshots" | "h2h" | "profile" | null;

export function Menu() {
  const newRun = useStore((s) => s.newRun);
  const loadRun = useStore((s) => s.loadRun);
  const uid = useStore((s) => s.uid);
  const [hasSave, setHasSave] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sub, setSub] = useState<SubView>(null);

  useEffect(() => {
    let alive = true;
    loadActiveRun(uid).then((run) => {
      if (!alive) return;
      setHasSave(!!run && run.status === "active");
      setChecking(false);
    }).catch(() => setChecking(false));
    return () => { alive = false; };
  }, [uid]);

  async function onContinue() {
    const run = await loadActiveRun(uid);
    if (run) loadRun(run);
  }

  return (
    <div className="menu">
      <h1>DUNGEON CORE</h1>
      <div className="sub">Build your lair. Crush the heroes. Become legend.</div>
      <div className="btns">
        {hasSave && <button className="primary big" onClick={onContinue}>Continue Run</button>}
        <button className="big" onClick={() => newRun([])} disabled={checking}>New Run</button>
        <button className="big" onClick={() => newRun(["tutorial", "fastStart"])} disabled={checking}>
          New Run (Guided / Fast Start)
        </button>
        <button onClick={() => setSub("h2h")}>Head-to-Head</button>
        <button onClick={() => setSub("snapshots")}>Saved Dungeons</button>
        <button onClick={() => setSub("achievements")}>Achievements</button>
        <button onClick={() => setSub("profile")}>Profile / Sign In</button>
      </div>
      <div className="small" style={{ marginTop: 20 }}>
        {checking ? "Loading..." : uid === "local" ? "Playing in local mode (sign-in unavailable)" : "Signed in - progress saved to the cloud"}
      </div>

      {sub === "achievements" && <AchievementsView onClose={() => setSub(null)} />}
      {sub === "snapshots" && <SnapshotsView onClose={() => setSub(null)} />}
      {sub === "h2h" && <H2H onClose={() => setSub(null)} />}
      {sub === "profile" && <ProfileView onClose={() => setSub(null)} />}
    </div>
  );
}

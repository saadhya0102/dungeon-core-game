import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { loadActiveRun, readActiveRun } from "../net/persistence";
import { loadIdleRun } from "../net/idle";
import { createIdleRun } from "../sim/idle";
import { buyBuilding, loadStronghold, loadSwiftBoard, localStronghold } from "../net/kingdom";
import type { SwiftScore } from "../net/kingdom";
import { CAMPAIGN, SWIFT_BOARDS, cityUnlocked, createCampaignRun } from "../sim/kingdom";
import { createNewRun } from "../sim/factory";
import type { BuildingId, SwiftRule } from "../sim/kingdom";
import type { RunState } from "../sim/types";
import { AchievementsView } from "./AchievementsView";
import { SnapshotsView } from "./SnapshotsView";
import { H2H } from "./H2H";
import { ProfileView } from "./ProfileView";
import { Duel } from "./Duel";
import { StrongholdScene } from "./StrongholdScene";
import { CampaignMap } from "./CampaignMap";
import { Bestiary } from "./Bestiary";

const SECTIONS = ["Stronghold", "Campaign", "Duels", "Swift", "Idle"] as const;
type Section = typeof SECTIONS[number];
type SubView = "achievements" | "snapshots" | "h2h" | "profile" | "bestiary" | null;
let lastSection: Section = "Stronghold";

function usableCampaign(run: RunState | null): RunState | null {
  const city = CAMPAIGN.find((entry) => entry.id === run?.cityId);
  return city && run && (run.status === "active" || run.stats.wavesCleared >= city.waves) ? run : null;
}

export function Menu() {
  const uid = useStore((state) => state.uid);
  const loadRun = useStore((state) => state.loadRun);
  const [section, setSection] = useState(lastSection);
  const [sub, setSub] = useState<SubView>(null);
  const [base, setBase] = useState(() => localStronghold(uid));
  const [swiftSave, setSwiftSave] = useState<RunState | null>(() => readActiveRun(uid));
  const [campaignSave, setCampaignSave] = useState<RunState | null>(() => usableCampaign(readActiveRun(uid, true)));
  const [loading, setLoading] = useState(uid !== "local");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [cloudIssue, setCloudIssue] = useState(false);
  const [pendingSwift, setPendingSwift] = useState<{ uid: string; board: SwiftRule } | null>(null);
  const [board, setBoard] = useState<SwiftRule>("standard");
  const [standings, setStandings] = useState<{ scores: SwiftScore[]; online: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(uid !== "local");
    setCloudIssue(false);
    setBase(localStronghold(uid));
    setSwiftSave(readActiveRun(uid));
    setCampaignSave(usableCampaign(readActiveRun(uid, true)));
    const profile = loadStronghold(uid).then((stronghold) => { if (active) setBase(stronghold); })
      .catch(() => { if (active) setCloudIssue(true); });
    const swift = loadActiveRun(uid).then((run) => { if (active) setSwiftSave(run); });
    const campaign = loadActiveRun(uid, true).then((run) => { if (active) setCampaignSave(usableCampaign(run)); });
    void Promise.allSettled([profile, swift, campaign]).then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    if (section !== "Swift") return;
    let active = true;
    void loadSwiftBoard(uid, board).then((result) => { if (active) setStandings(result); });
    return () => { active = false; };
  }, [uid, section, board]);

  function navigate(next: Section) {
    lastSection = next;
    setSection(next);
  }

  async function upgrade(id: BuildingId) {
    setBuying(true);
    setError("");
    try { setBase(await buyBuilding(uid, id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not upgrade the building."); }
    finally { setBuying(false); }
  }

  const boardInfo = SWIFT_BOARDS.find(([id]) => id === board)!;
  const inStronghold = section === "Stronghold";
  const idleSave = section === "Idle" ? loadIdleRun(uid) : null;
  const newRunUid = loading || cloudIssue ? "local" : uid;
  const resumedCampaign = [campaignSave, usableCampaign(readActiveRun("local", true))]
    .filter((run): run is RunState => !!run).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const resumedSwift = [swiftSave, readActiveRun("local")]
    .filter((run): run is RunState => run?.status === "active").sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const campaignBase = newRunUid === uid ? base : localStronghold("local");
  const nextCity = CAMPAIGN.find((entry) => cityUnlocked(campaignBase, entry.id) && !campaignBase.cleared.includes(entry.id)) ?? CAMPAIGN[0];

  function startSwift(guided: boolean) {
    if (guided) {
      loadRun({ ...createNewRun("local", ["tutorial", "fastStart"]), practice: true });
      return;
    }
    if (readActiveRun(newRunUid)?.status === "active" || resumedSwift?.uid === newRunUid) {
      setPendingSwift({ uid: newRunUid, board });
      return;
    }
    loadRun(createNewRun(newRunUid, [], undefined, board));
  }

  return (
    <div className={`kingdom${inStronghold ? " kingdom-stronghold" : ""}`}>
      <header className="kingdom-header">
        <a className="kingdom-brand" href="#stronghold" onClick={(event) => { event.preventDefault(); navigate("Stronghold"); }}><i aria-hidden="true" />Dungeon <b>Core</b></a>
        <nav aria-label="Game modes">
          {SECTIONS.map((item) => <button key={item} className={section === item ? "active" : ""} aria-current={section === item ? "page" : undefined} onClick={() => navigate(item)}>{item}</button>)}
        </nav>
        <div className="kingdom-wallet"><span className="shard" aria-hidden="true" /> {base.shards} <span>shards</span></div>
      </header>

      <main className={inStronghold ? "stronghold-main" : "kingdom-main"}>
        {error && !inStronghold && <p className="kingdom-error" role="alert">{error}</p>}
        {inStronghold && <StrongholdScene base={base} loading={loading} buying={buying} error={error} onUpgrade={(id) => void upgrade(id)} modalOpen={sub !== null}
          launch={<div className="stronghold-play">
            <div><small>{resumedCampaign ? "Campaign save" : "Campaign"}</small><strong>{resumedCampaign ? CAMPAIGN.find((city) => city.id === resumedCampaign.cityId)?.name : nextCity.name}</strong></div>
            <button className="primary" onClick={() => {
              const run = resumedCampaign ?? createCampaignRun(newRunUid, nextCity.id, campaignBase);
              if (run) { navigate("Campaign"); loadRun(run); }
            }}>{resumedCampaign ? "Continue" : "Play campaign"}</button>
          </div>} />}
        {section === "Campaign" && <CampaignMap key={newRunUid} base={campaignBase} saved={resumedCampaign} uid={newRunUid} loading={false} openRun={loadRun} />}
        {section === "Idle" && <section className="idle-intro">
          <div>
            <h1>Night Watch</h1>
            <p>Set your defenses and leave the watch running. A fresh wave arrives every 30 seconds while your monsters respawn and your core recovers.</p>
            <p>Earn Embers while you’re away. Pause to rebuild, then try a tougher wave after three wins in a row. A loss drops you one difficulty.</p>
            {idleSave?.idle && <p><b>Difficulty {idleSave.wave}</b> · {idleSave.idle.nextAt == null ? "Paused" : "Patrolling"} · {idleSave.dp.toLocaleString()} saved Embers</p>}
            <button className="primary big" onClick={() => loadRun(loadIdleRun(uid) ?? createIdleRun(uid))}>{idleSave ? "Open my dungeon" : "Build an idle dungeon"}</button>
          </div>
        </section>}

        {section === "Swift" && (
          <>
            <div className="kingdom-title"><div><h1>Swift</h1><p>Endless waves. A fresh dungeon every run.</p></div></div>
            <div className="swift-grid">
              <div className="kingdom-sheet">
                <h2>Choose a ruleset</h2>
                <div className="swift-rules">{SWIFT_BOARDS.map(([id, label]) =>
                  <button key={id} aria-pressed={board === id} className={board === id ? "active" : ""} onClick={() => {
                    if (board !== id) { setStandings(null); setBoard(id); }
                  }}>{label}</button>)}</div>
                <p>{boardInfo[2]}</p>
                <div className="kingdom-actions">
                  {resumedSwift && <button className="primary" onClick={() => loadRun(resumedSwift)}>Continue Swift · wave {resumedSwift.wave}</button>}
                  <button className={resumedSwift ? "" : "primary"} onClick={() => startSwift(false)}>Start Swift run</button>
                  <button onClick={() => startSwift(true)}>Guided practice</button>
                </div>
              </div>
              <div className="kingdom-sheet">
                <h2>{boardInfo[1]} standings</h2>
                <p>{standings ? standings.online ? "Online leaderboard" : "Personal best on this device" : "Loading scores…"}</p>
                {standings?.scores.length === 0 && <p>No waves cleared yet.</p>}
                {!!standings?.scores.length && <table className="swift-scores"><thead><tr><th>Rank</th><th>Player</th><th>Wave</th><th>Kills</th></tr></thead><tbody>
                  {standings.scores.map((entry, index) => <tr key={entry.uid}><td>{index + 1}</td><td>{entry.uid === uid ? "You" : `Keeper ${entry.uid.slice(-5)}`}</td><td>{entry.wave}</td><td>{entry.kills}</td></tr>)}
                </tbody></table>}
              </div>
            </div>
          </>
        )}

        {section === "Duels" && <Duel onReward={() => { void loadStronghold(uid).then(setBase).catch(() => {}); }} />}
      </main>
      <footer className="kingdom-footer">
        <div className="profile-status">{cloudIssue ? "Cloud unavailable · local play" : loading ? "Syncing profile · local play ready" : uid === "local" ? "Local profile" : "Cloud profile"}</div>
        <div className="kingdom-actions">
          <button onClick={() => setSub("bestiary")}>Bestiary</button>
          <button onClick={() => setSub("snapshots")}>Saved Dungeons</button>
          <button onClick={() => setSub("h2h")}>Snapshot H2H</button>
          <button onClick={() => setSub("achievements")}>Achievements</button>
          <button onClick={() => setSub("profile")}>Profile</button>
        </div>
      </footer>
      {sub === "achievements" && <AchievementsView onClose={() => setSub(null)} />}
      {sub === "snapshots" && <SnapshotsView onClose={() => setSub(null)} />}
      {sub === "h2h" && <H2H onClose={() => setSub(null)} />}
      {sub === "profile" && <ProfileView onClose={() => setSub(null)} />}
      {sub === "bestiary" && <Bestiary onClose={() => setSub(null)} />}
      {pendingSwift && <div className="panel-modal"><section className="panel replace-run" role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <h2 id="replace-title">Replace the saved Swift run?</h2>
        <p>Starting a new run will replace the current dungeon.</p>
        <div className="kingdom-actions">
          <button autoFocus onClick={() => setPendingSwift(null)}>Cancel</button>
          <button className="primary" onClick={() => loadRun(createNewRun(pendingSwift.uid, [], undefined, pendingSwift.board))}>Start new run</button>
        </div>
      </section></div>}
    </div>
  );
}

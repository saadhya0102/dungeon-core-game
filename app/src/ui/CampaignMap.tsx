import { useState } from "react";
import { CAMPAIGN, CAMPAIGN_REGIONS, cityUnlocked, createCampaignRun } from "../sim/kingdom";
import type { Stronghold } from "../sim/kingdom";
import type { RunState } from "../sim/types";
import borderlandsArt from "../assets/campaign-map.webp";
import frontierArt from "../assets/frozen-frontier.webp";

const MAPS = [borderlandsArt, frontierArt] as const;

export function CampaignMap({ base, saved, uid, loading, openRun }: {
  base: Stronghold; saved: RunState | null; uid: string; loading: boolean; openRun: (run: RunState) => void;
}) {
  const [pick, setPick] = useState<{ part: number; city?: string } | null>(null);
  const homeIndex = CAMPAIGN.findIndex((entry) => entry.id === saved?.cityId);
  const progress = CAMPAIGN.findIndex((entry) => cityUnlocked(base, entry.id) && !base.cleared.includes(entry.id));
  const defaultIndex = homeIndex >= 0 ? homeIndex : Math.max(0, progress);
  const part = pick?.part ?? (defaultIndex >= CAMPAIGN_REGIONS[1].start ? 1 : 0);
  const region = CAMPAIGN_REGIONS[part];
  const cities = CAMPAIGN.slice(region.start, region.end);
  const city = cities.find((entry) => entry.id === pick?.city)
    ?? (defaultIndex >= region.start && defaultIndex < region.end ? CAMPAIGN[defaultIndex] : cities[0]);
  const resumed = saved?.cityId === city.id && (saved.status === "active" || saved.stats.wavesCleared >= city.waves);
  const cleared = base.cleared.includes(city.id);
  const open = cityUnlocked(base, city.id) || resumed;
  const clearedCount = CAMPAIGN.filter((entry) => base.cleared.includes(entry.id)).length;
  const choose = (id: string) => setPick({ part, city: id });

  return (
    <>
      <div className="kingdom-title">
        <div><h1>Campaign</h1><p>Hold the road from Mossgate to the Aurora Throne.</p></div>
        <strong>{clearedCount} / {CAMPAIGN.length} cleared</strong>
      </div>
      <nav className="campaign-regions" aria-label="Campaign regions">
        {CAMPAIGN_REGIONS.map(({ name, start, end }, index) => (
          <button key={name} className={part === index ? "active" : ""} aria-pressed={part === index} onClick={() => setPick({ part: index })}>
            <span>{name}</span><small>{CAMPAIGN.slice(start, end).filter((entry) => base.cleared.includes(entry.id)).length} / {end - start}</small>
          </button>
        ))}
      </nav>
      <div className="campaign-grid">
        <div className="campaign-map">
          <img src={MAPS[part]} alt={part ? "Frozen towns, an icebound harbor, and a citadel under the aurora" : "A route winding from forest settlements to a mountain citadel"} />
          {cities.slice(1).map((entry, index) => {
            const previous = cities[index];
            const dx = entry.x - previous.x;
            const dy = (entry.y - previous.y) * 2 / 3;
            return <i aria-hidden="true" key={entry.id} className={`campaign-trail${base.cleared.includes(previous.id) ? " traveled" : ""}`}
              style={{ left: `${previous.x}%`, top: `${previous.y}%`, width: `${Math.hypot(dx, dy)}%`, transform: `rotate(${Math.atan2(dy, dx)}rad)` }} />;
          })}
          {cities.map((entry, index) => {
            const complete = base.cleared.includes(entry.id);
            const locked = !cityUnlocked(base, entry.id) && saved?.cityId !== entry.id;
            return <button key={entry.id} className={`city-pin${complete ? " cleared" : ""}${locked ? " locked" : ""}${city.id === entry.id ? " selected" : ""}`}
              style={{ left: `${entry.x}%`, top: `${entry.y}%` }} aria-pressed={city.id === entry.id}
              aria-label={`${entry.name}, ${entry.waves} waves${locked ? ", locked" : complete ? ", cleared" : ""}`}
              onClick={() => choose(entry.id)}>{complete ? "✓" : region.start + index + 1}</button>;
          })}
        </div>
        <aside className="kingdom-sheet campaign-stops">
          <h2>{city.name}</h2>
          <p>{city.waves} waves · {city.shards} shards on first clear</p>
          {!open && <p>Clear the previous stop to unlock.</p>}
          <button className="primary" disabled={loading || !open} onClick={() => {
            const run = resumed ? saved : createCampaignRun(uid, city.id, base);
            if (run) openRun(run);
          }}>{resumed ? "Continue" : cleared ? "Replay city" : "Defend city"}</button>
          <ol className="city-list" start={region.start + 1}>
            {cities.map((entry) => <li key={entry.id}><button onClick={() => choose(entry.id)} className={city.id === entry.id ? "active" : ""}>
              <span>{entry.name}</span><small>{base.cleared.includes(entry.id) ? "Cleared" : cityUnlocked(base, entry.id) || saved?.cityId === entry.id ? `${entry.waves} waves` : "Locked"}</small>
            </button></li>)}
          </ol>
        </aside>
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { loadSnapshots, loadPoolOpponents, getMainId } from "../net/persistence";
import {
  createNewRun, placeUnit, upgradeCore, resolveH2HMatch, ORIGIN, SIM_VERSION,
} from "../sim";
import type { H2HMatchResult, H2HExtraBuy } from "../sim";
import type { Snapshot, Archetype, Tier } from "../sim/types";
import { H2HMatchView } from "./H2HMatchView";

const STARTER_UNITS = ["gob_grunt", "und_skeleton", "bst_direwolf", "dem_imp", "con_animarmor", "abr_ooze"];

function makeBot(uid: string, seed: number, coreUps: number): Snapshot {
  const run = createNewRun(uid, [], seed);
  run.dp = 9_999_999;
  for (let i = 0; i < coreUps; i++) upgradeCore(run);
  const cx = ORIGIN, cy = ORIGIN;
  const spots: [number, number][] = [
    [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
    [cx - 2, cy], [cx + 2, cy], [cx, cy - 2], [cx, cy + 2],
  ];
  spots.forEach(([x, y], i) => placeUnit(run, STARTER_UNITS[i % STARTER_UNITS.length], x, y));
  return {
    id: `bot_${seed}`, uid: `bot_${seed}`, name: `Practice Bot (CL${run.core.level})`, createdAt: 0,
    source: "retire", endedAtWave: 5, rating: run.core.level * 100 + run.units.length * 10,
    shareable: false,
    dungeon: { map: run.map, units: run.units, traps: run.traps, inventory: run.inventory, research: run.research, core: run.core },
    simVersion: SIM_VERSION,
  };
}

const BUY_OPTIONS: { label: string; buy: H2HExtraBuy }[] = [
  { label: "+5 Rogues", buy: { archetype: "rogue" as Archetype, tier: 3 as Tier, count: 5 } },
  { label: "+8 Warriors", buy: { archetype: "warrior" as Archetype, tier: 3 as Tier, count: 8 } },
  { label: "+4 Mages", buy: { archetype: "mage" as Archetype, tier: 4 as Tier, count: 4 } },
];

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export function H2H({ onClose }: { onClose: () => void }) {
  const uid = useStore((s) => s.uid);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [pool, setPool] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState<Snapshot | null>(null);
  const [shownOpponents, setShownOpponents] = useState<Snapshot[]>([]);
  const [buys, setBuys] = useState<H2HExtraBuy[]>([]);
  const [match, setMatch] = useState<{ opp: Snapshot; result: H2HMatchResult } | null>(null);

  const mainId = useMemo(() => getMainId(uid), [uid]);

  useEffect(() => {
    Promise.all([loadSnapshots(uid), loadPoolOpponents(uid)])
      .then(([s, p]) => {
        setSnaps(s);
        setPool(p);
        const main = s.find((x) => x.id === mainId) ?? s[0] ?? null;
        setChallenger(main);
        setShownOpponents(sample(p, 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid, mainId]);

  function reroll() { setShownOpponents(sample(pool, 4)); }

  function fight(opp: Snapshot) {
    if (!challenger) return;
    const result = resolveH2HMatch(challenger, opp, undefined, () => buys);
    setMatch({ opp, result });
  }

  function toggleBuy(b: H2HExtraBuy) {
    setBuys((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  }

  if (match && challenger) {
    return <H2HMatchView challenger={challenger} opponent={match.opp} result={match.result} onClose={() => setMatch(null)} />;
  }

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Head-to-Head</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="hint">Both dungeons face the same escalating waves &mdash; last core standing wins. Watch it play out in split-screen.</div>

        {loading && <div>Loading&hellip;</div>}

        {!loading && (
          <>
            <div className="section-title">Your dungeon (challenger)</div>
            {challenger
              ? (
                <div className="card" style={{ maxWidth: 280, borderColor: challenger.id === mainId ? "var(--gold)" : undefined }}>
                  <div className="name">{challenger.id === mainId ? "\u2605 " : ""}{challenger.name}</div>
                  <div className="meta">Wave {challenger.endedAtWave} &middot; rating {challenger.rating}</div>
                </div>
              )
              : (
                <div className="small">
                  No saved dungeon yet. Save one in a run (then set a Main in "Saved Dungeons"), or{" "}
                  <button className="small" onClick={() => setChallenger(makeBot(uid, 4242, 4))}>use a generated dungeon</button> to try H2H now.
                </div>
              )}
            {snaps.length > 1 && (
              <div className="small" style={{ marginTop: 6 }}>
                Bring a different save:{" "}
                {snaps.map((s) => (
                  <button key={s.id} className="small" style={{ margin: 2 }} onClick={() => setChallenger(s)}>{s.name}</button>
                ))}
              </div>
            )}

            <div className="section-title">Extra adventurers (attack BOTH dungeons)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BUY_OPTIONS.map((o) => (
                <button key={o.label} className={buys.includes(o.buy) ? "active" : ""} onClick={() => toggleBuy(o.buy)}>{o.label}</button>
              ))}
            </div>

            <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Opponents (other players' Main dungeons)</span>
              <button className="small" onClick={reroll} disabled={pool.length === 0}>Reroll</button>
            </div>
            {shownOpponents.length === 0 && (
              <div className="small">No other players' dungeons available yet. Set a Main so others can face you, or fight a practice bot below.</div>
            )}
            <div className="grid-cards">
              {shownOpponents.map((s) => (
                <div key={s.id} className="card" onClick={() => challenger && fight(s)}>
                  <div className="name">{s.name}</div>
                  <div className="meta">Wave {s.endedAtWave} &middot; rating {s.rating}</div>
                  <div className="small">Click to fight</div>
                </div>
              ))}
            </div>

            <div className="section-title">Practice</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary" disabled={!challenger} onClick={() => fight(makeBot(uid, 777, 3))}>Practice Bot (CL4)</button>
              <button className="primary" disabled={!challenger} onClick={() => fight(makeBot(uid, 999, 6))}>Tough Bot (CL7)</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

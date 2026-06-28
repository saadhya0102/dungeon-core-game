import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../state/store";
import { loadSnapshots, loadPoolOpponents, getMainId, getRating, setRating } from "../net/persistence";
import {
  createNewRun, placeUnit, upgradeCore, resolveH2HMatch, ORIGIN, SIM_VERSION,
  getLadderBots, ratingDelta,
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

function PlayerRow({ rank, rating }: { rank: number; rating: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "rgba(227,195,78,0.12)", borderTop: "1px solid var(--border)" }}>
      <span className="small" style={{ width: 30, color: "var(--gold)" }}>#{rank}</span>
      <span style={{ flex: 1, fontWeight: 700, color: "var(--gold)" }}>YOU</span>
      <span className="small" />
      <b style={{ width: 56, textAlign: "right", color: "var(--gold)" }}>{rating}</b>
    </div>
  );
}

export function H2H({ onClose }: { onClose: () => void }) {
  const uid = useStore((s) => s.uid);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [pool, setPool] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenger, setChallenger] = useState<Snapshot | null>(null);
  const [shownOpponents, setShownOpponents] = useState<Snapshot[]>([]);
  const [buys, setBuys] = useState<H2HExtraBuy[]>([]);
  const [match, setMatch] = useState<{ opp: Snapshot; result: H2HMatchResult; delta: number } | null>(null);
  const [rating, setRatingState] = useState(() => getRating(uid));

  const mainId = useMemo(() => getMainId(uid), [uid]);
  const ladder = useMemo(() => getLadderBots(), []);
  // Real players' Main dungeons first, then the ladder bots ("subagent" accounts).
  const allOpps = useMemo(() => [...pool, ...ladder], [pool, ladder]);
  // Ladder display: everyone sorted by rating (descending).
  const ranked = useMemo(() => [...allOpps].sort((a, b) => b.rating - a.rating), [allOpps]);

  useEffect(() => { setRatingState(getRating(uid)); }, [uid]);

  useEffect(() => {
    Promise.all([loadSnapshots(uid), loadPoolOpponents(uid)])
      .then(([s, p]) => {
        setSnaps(s);
        setPool(p);
        const main = s.find((x) => x.id === mainId) ?? s[0] ?? null;
        setChallenger(main);
        setShownOpponents(sample([...p, ...getLadderBots()], 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid, mainId]);

  function reroll() { setShownOpponents(sample(allOpps, 4)); }

  function fight(opp: Snapshot) {
    if (!challenger) return;
    const result = resolveH2HMatch(challenger, opp, undefined, () => buys);
    const score = result.winner === "challenger" ? 1 : result.winner === "draw" ? 0.5 : 0;
    const delta = ratingDelta(rating, opp.rating, score);
    const next = rating + delta;
    setRating(uid, next);
    setRatingState(next);
    setMatch({ opp, result, delta });
  }

  function toggleBuy(b: H2HExtraBuy) {
    setBuys((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  }

  if (match && challenger) {
    return <H2HMatchView challenger={challenger} opponent={match.opp} result={match.result} ratingDelta={match.delta} onClose={() => setMatch(null)} />;
  }

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Head-to-Head</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="small">Your rating <b style={{ color: "var(--gold)", fontSize: 16 }}>{rating}</b></span>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="hint">Both dungeons face the same escalating waves &mdash; last core standing wins. Watch it play out in split-screen. Climb the ladder by beating higher-rated dungeons.</div>

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
              <span>Featured opponents</span>
              <button className="small" onClick={reroll} disabled={allOpps.length === 0}>Reroll</button>
            </div>
            <div className="grid-cards">
              {shownOpponents.map((s) => (
                <div key={s.id} className="card" onClick={() => challenger && fight(s)}>
                  <div className="name">{s.name}</div>
                  <div className="meta">Wave {s.endedAtWave} &middot; rating {s.rating}</div>
                  <div className="small">Click to fight</div>
                </div>
              ))}
            </div>

            <div className="section-title">Ladder</div>
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              {(() => {
                let insertAt = ranked.findIndex((s) => s.rating <= rating);
                if (insertAt === -1) insertAt = ranked.length;
                const rows: ReactNode[] = [];
                ranked.forEach((s, i) => {
                  if (i === insertAt) rows.push(<PlayerRow key="__you" rank={insertAt + 1} rating={rating} />);
                  const isReal = pool.some((p) => p.id === s.id);
                  rows.push(
                    <div key={s.id} className="ladder-row" onClick={() => challenger && fight(s)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", cursor: challenger ? "pointer" : "default", borderTop: "1px solid var(--border)" }}>
                      <span className="small" style={{ width: 30, color: "var(--muted)" }}>#{i + 1 + (i >= insertAt ? 1 : 0)}</span>
                      <span style={{ flex: 1 }}>{s.name}<span className="small" style={{ color: "var(--muted)" }}>{isReal ? " \u00b7 player" : " \u00b7 bot"}</span></span>
                      <span className="small">Wave {s.endedAtWave}</span>
                      <b style={{ width: 56, textAlign: "right", color: "var(--gold)" }}>{s.rating}</b>
                    </div>,
                  );
                });
                if (insertAt === ranked.length) rows.push(<PlayerRow key="__you" rank={insertAt + 1} rating={rating} />);
                if (ranked.length === 0) rows.push(<div key="none" className="small" style={{ padding: 10 }}>No opponents yet.</div>);
                return rows;
              })()}
            </div>
            <div className="small" style={{ marginTop: 6 }}>Click any dungeon to challenge it.</div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DungeonView } from "../game/pixi/DungeonView";
import { PlannerBoard } from "./PlannerBoard";
import { createDuelRoom, joinDuelRoom, loadDuelRound, playDuelAction, watchDuel } from "../net/duels";
import { useStore } from "../state/store";
import { capacityMax, capacityUsed, clUpgradeCost, coreLevelRow, RESEARCH, roomCost, TRAPS, UNIT_BY_ID, unitCost, unlockedUnits, resolveWave } from "../sim";
import {
  DUEL_SEND_LIMIT, DUEL_WIN_SHARDS, rankCost, sendAvailable, sendCost, sendDelayMs, sendUnlockWave,
} from "../sim/duel";
import type { DuelAction, DuelRoom, DuelRound } from "../sim/duel";
import type { RunState, Timeline } from "../sim/types";

function savedRoom(uid: string) {
  try { return localStorage.getItem(`dc_duel_${uid}`) ?? ""; } catch { return ""; }
}

type Tool = "dig" | "room" | "place" | "trap" | "move";
const errorText = (error: unknown) => error instanceof Error ? error.message : "The duel connection failed.";

export function Duel({ onReward }: { onReward: () => void }) {
  const uid = useStore((state) => state.uid);
  const [code, setCode] = useState("");
  const [roomId, setRoomId] = useState(() => savedRoom(uid));
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [round, setRound] = useState<DuelRound | null>(null);
  const [hiddenReplay, setHiddenReplay] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<Tool>("place");
  const [recruit, setRecruit] = useState("");
  const [trap, setTrap] = useState("trap_dart");
  const [research, setResearch] = useState("");
  const [selected, setSelected] = useState("");
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const notified = useRef("");
  const reward = useRef(onReward);
  reward.current = onReward;
  const player = room?.players[uid];
  const rivalId = room?.uids.find((id) => id !== uid);
  const rival = rivalId ? room?.players[rivalId] : undefined;

  useEffect(() => {
    setRoomId(savedRoom(uid));
    setRoom(null);
    setRound(null);
    setHiddenReplay(0);
    setError("");
  }, [uid]);

  useEffect(() => {
    if (!roomId || uid === "local") return;
    return watchDuel(roomId, setRoom, (failure) => setError(errorText(failure)));
  }, [roomId, uid]);

  useEffect(() => {
    if (!room || room.status !== "playing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.id, room?.status, room]);

  const lastRound = room?.lastRound ?? 0;
  useEffect(() => {
    if (!roomId || !lastRound) return;
    let active = true;
    void loadDuelRound(roomId, lastRound).then((result) => { if (active) setRound(result); })
      .catch((failure) => { if (active) setError(errorText(failure)); });
    return () => { active = false; };
  }, [roomId, lastRound]);

  useEffect(() => {
    if (!room || room.status !== "finished" || room.winner !== uid || notified.current === room.id) return;
    notified.current = room.id;
    reward.current();
  }, [room, uid]);

  useEffect(() => {
    if (!room || room.status !== "playing" || now < room.deadline || !rival) return;
    // One client requests resolution. The other takes over if the connection drops.
    const delay = room.uids[0] === uid ? 0 : 2_000;
    const resolve = () => { void playDuelAction(room.id, room.wave, { type: "advance" }).catch((failure) => setError(errorText(failure))); };
    const first = window.setTimeout(resolve, delay);
    const retry = window.setInterval(resolve, 6_000);
    return () => { window.clearTimeout(first); window.clearInterval(retry); };
  }, [room, uid, !!rival, !!room && now >= room.deadline]);

  async function connect(enter: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      const id = await enter();
      setRoomId(id);
      try { localStorage.setItem(`dc_duel_${uid}`, id); } catch { /* room still works */ }
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function send(action: DuelAction) {
    if (!room || activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true);
    setError("");
    try { await playDuelAction(room.id, room.wave, action); }
    catch (failure) { setError(errorText(failure)); }
    finally { activeRequest.current = false; setBusy(false); }
  }

  function leave() {
    try { localStorage.removeItem(`dc_duel_${uid}`); } catch { /* room can still be closed */ }
    setRoomId("");
    setRoom(null);
    setRound(null);
    setHiddenReplay(0);
    setConfirmSurrender(false);
    setError("");
  }

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim()) void connect(() => joinDuelRoom(code.trim()));
  }

  const watchReplay = !!round && lastRound === round.wave && hiddenReplay < round.wave &&
    !!rivalId && (room?.status === "finished" || now < (room?.buildAt ?? 0));
  const timelines = useMemo(() => {
    if (!watchReplay || !round || !rivalId) return undefined;
    return [resolveWave(round.boards[uid], round.waves[uid]), resolveWave(round.boards[rivalId], round.waves[rivalId])] as const;
  }, [round, rivalId, uid, watchReplay]);

  if (uid === "local") return <section className="kingdom-sheet"><h1>Live Duels</h1><p>Connect a profile online to create or join a room.</p></section>;

  if (!room || !player || room.status === "waiting" || !rival) {
    return (
      <>
        <div className="kingdom-title"><div><h1>Live Duels</h1><p>Build while your rival builds. Queue monsters to attack their dungeon next wave.</p></div></div>
        <section className="kingdom-sheet duel-lobby">
          {error && <p className="kingdom-error" role="alert">{error}</p>}
          {!roomId ? (
            <>
              <button className="primary" disabled={busy} onClick={() => void connect(createDuelRoom)}>Create room</button>
              <form onSubmit={join} className="kingdom-actions">
                <label htmlFor="duel-code">Room code</label>
                <input id="duel-code" value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase())} />
                <button disabled={busy || code.length !== 8}>Join room</button>
              </form>
              <p>Win a duel to earn {DUEL_WIN_SHARDS} shards.</p>
            </>
          ) : (
            <>
              <h2>Room <code>{roomId}</code></h2>
              <p>{room?.status === "waiting" ? "Share this code with your opponent." : room?.status === "finished" ? "Room closed." : "Connecting to room…"}</p>
              {room?.status === "waiting" && <button onClick={() => {
                void navigator.clipboard.writeText(roomId).catch(() => setError("Copy the room code shown above."));
              }}>Copy code</button>}
              {room?.status === "waiting" ? <button disabled={busy} onClick={() => void send({ type: "surrender" })}>Close room</button> : <button onClick={leave}>Back to lobby</button>}
            </>
          )}
        </section>
      </>
    );
  }

  const run = player.run;
  const row = coreLevelRow(run.core.level);
  const elapsed = now - room.buildAt;
  const locked = room.status !== "playing" || elapsed < 0 || now >= room.deadline || player.ready;
  const seconds = Math.max(0, Math.ceil((room.deadline - now) / 1000));
  const unlocked = unlockedUnits(run);
  const recruits = [...unlocked].map((id) => UNIT_BY_ID[id]).filter((def) => def.tier <= row.maxUnitTier);
  const chosen = recruits.find((def) => def.id === recruit) ?? recruits[0];
  const rank = chosen ? run.monsterRanks?.[chosen.id] ?? 0 : 0;
  const researchOptions = RESEARCH.filter((node) => node.researchTier <= row.researchTier && node.prereqs.every((id) => run.research.owned.includes(id))
    && (run.research.ranks[node.id] ?? (run.research.owned.includes(node.id) ? 1 : 0)) < node.ranks);
  const researchId = researchOptions.some((node) => node.id === research) ? research : researchOptions[0]?.id ?? "";
  const outcome = room.winner === uid ? `Victory · +${DUEL_WIN_SHARDS} shards` : room.winner ? "Defeat" : "Draw";

  function clickTile(x: number, y: number) {
    if (locked || busy) return;
    const unitId = run.map.tiles[`${x},${y}`]?.unitId;
    if (unitId) { setSelected(unitId); setTool("move"); return; }
    if (tool === "dig" || tool === "room") void send({ type: tool, x, y });
    if (tool === "place" && chosen) void send({ type: "place", id: chosen.id, x, y });
    if (tool === "trap") void send({ type: "trap", id: trap, x, y });
    if (tool === "move" && selected) void send({ type: "move", id: selected, x, y });
  }

  return (
    <>
      <div className="kingdom-title">
        <div><h1>{room.status === "finished" ? outcome : `Round ${watchReplay ? round.wave : room.wave}`}</h1>
          <p>{room.status === "finished" ? `Room ${roomId}` : watchReplay ? "Queued monsters are attacking." : player.ready ? "Waiting for your rival." : elapsed < 0 ? "Next build phase starts shortly." : now >= room.deadline ? "Resolving both waves…" : `${seconds}s to build and queue sends`}</p></div>
        <div className="kingdom-actions">
          {watchReplay && <button onClick={() => setHiddenReplay(lastRound)}>Skip replay</button>}
          {room.status === "finished" ? <button onClick={leave}>Back to lobby</button>
            : <button disabled={busy} onClick={() => confirmSurrender ? void send({ type: "surrender" }) : setConfirmSurrender(true)}>
              {confirmSurrender ? "Confirm surrender" : "Surrender"}</button>}
        </div>
      </div>
      {error && <p className="kingdom-error" role="alert">{error}</p>}
      <DuelBoards me={watchReplay ? round.boards[uid] : run} rival={watchReplay ? round.boards[rivalId!] : rival.run}
        timelines={timelines} selected={selected} roomTool={tool === "room" && !locked} onClick={clickTile} />
      {!watchReplay && room.status === "playing" && (
        <div className="kingdom-sheet duel-controls">
          <fieldset disabled={locked || busy}>
            <legend>Build · {run.dp} DP · {capacityUsed(run)}/{capacityMax(run)} capacity</legend>
            <div className="kingdom-actions">
              <button className={tool === "dig" ? "active" : ""} onClick={() => setTool("dig")}>Dig</button>
              <button className={tool === "room" ? "active" : ""} onClick={() => setTool("room")}>5 × 5 room · {roomCost(run)} DP</button>
              <button disabled={run.core.level >= 20 || run.dp < clUpgradeCost(run.core.level)} onClick={() => void send({ type: "core" })}>Core upgrade · {clUpgradeCost(run.core.level)} DP</button>
              {selected && <button onClick={() => { void send({ type: "sell", id: selected }); setSelected(""); setTool("place"); }}>Sell selected unit</button>}
            </div>
            <div className="kingdom-actions">
              <label htmlFor="duel-recruit">Monster</label>
              <select id="duel-recruit" value={chosen?.id ?? ""} onChange={(event) => { setRecruit(event.target.value); setTool("place"); }}>
                {recruits.map((def) => <option key={def.id} value={def.id}>{def.name} · T{def.tier}</option>)}
              </select>
              {chosen && <button className={tool === "place" ? "active" : ""} onClick={() => setTool("place")}>Place · {unitCost(chosen)} DP</button>}
              {chosen && <button disabled={rank >= 3 || run.dp < rankCost(chosen, rank)} onClick={() => void send({ type: "rank", id: chosen.id })}>
                {rank >= 3 ? "Max rank" : `Rank up · ${rankCost(chosen, rank)} DP`}</button>}
              {chosen && <button disabled={player.sends.length >= DUEL_SEND_LIMIT || !sendAvailable(run, chosen, elapsed) || run.dp < sendCost(chosen)}
                onClick={() => void send({ type: "send", id: chosen.id })}>Send · {sendCost(chosen)} DP</button>}
            </div>
            {chosen && !sendAvailable(run, chosen, elapsed) && <p className="duel-hint">
              {run.wave < sendUnlockWave(chosen) ? `Sending unlocks in round ${sendUnlockWave(chosen)}.` : `Sending opens ${sendDelayMs(chosen) / 1000}s into each build phase.`}</p>}
            <div className="kingdom-actions">
              <label htmlFor="duel-research">Research</label>
              <select id="duel-research" value={researchId} onChange={(event) => setResearch(event.target.value)}>
                {researchOptions.map((node) => <option key={node.id} value={node.id}>{node.name} · {node.cost} DP</option>)}
              </select>
              <button disabled={!researchId} onClick={() => void send({ type: "research", id: researchId })}>Research</button>
              {run.research.owned.includes("res_basic_traps") && <>
                <label htmlFor="duel-trap">Trap</label>
                <select id="duel-trap" value={trap} onChange={(event) => { setTrap(event.target.value); setTool("trap"); }}>
                  {TRAPS.filter((def) => def.tier <= row.maxUnitTier && (def.tier <= 2 || (def.tier <= 5 ? run.research.owned.includes("res_adv_traps") : run.research.owned.includes("res_elite_traps"))))
                    .map((def) => <option key={def.id} value={def.id}>{def.name} · {def.cost} DP</option>)}
                </select>
                <button className={tool === "trap" ? "active" : ""} onClick={() => setTool("trap")}>Place trap</button>
              </>}
            </div>
          </fieldset>
          <div className="kingdom-actions duel-ready">
            <span>Queued {player.sends.length}/{DUEL_SEND_LIMIT}{player.sends.length ? ` · ${player.sends.map((id) => UNIT_BY_ID[id].name).join(", ")}` : ""}</span>
            <button className="primary" disabled={locked || busy} onClick={() => void send({ type: "ready" })}>{player.ready ? "Ready" : "Lock dungeon"}</button>
          </div>
        </div>
      )}
    </>
  );
}

function DuelBoards({ me, rival, timelines, selected, roomTool, onClick }: {
  me: RunState; rival: RunState; timelines?: readonly [Timeline, Timeline]; selected: string; roomTool: boolean;
  onClick: (x: number, y: number) => void;
}) {
  const leftHost = useRef<HTMLDivElement>(null);
  const rightHost = useRef<HTMLDivElement>(null);
  const views = useRef<[DungeonView, DungeonView] | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const click = useRef(onClick);
  click.current = onClick;
  const centered = useRef(false);
  const boards = useRef<{ me: RunState; rival: RunState } | null>(null);

  useEffect(() => {
    if (failed || !leftHost.current || !rightHost.current) return;
    let active = true;
    let raf = 0;
    const left = new DungeonView(leftHost.current, { manual: true });
    const right = new DungeonView(rightHost.current, { manual: true });
    views.current = [left, right];
    left.onClick = (x, y) => click.current(x, y);
    left.onError = right.onError = () => { if (active) setFailed(true); };
    const timeout = window.setTimeout(() => { if (active) setFailed(true); }, 4500);
    void Promise.all([left.init(), right.init()]).then(() => {
      if (!active) return;
      setReady(true);
      let last = performance.now();
      function frame(now: number) {
        const dt = Math.min(50, now - last);
        last = now;
        left.frameStep(dt);
        right.frameStep(dt);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }).catch(() => { if (active) setFailed(true); }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); cancelAnimationFrame(raf); left.destroy(); right.destroy(); views.current = null; };
  }, [failed]);

  useEffect(() => {
    if (failed || !ready || !views.current) return;
    const [left, right] = views.current;
    try {
    left.toolIsRoom = roomTool;
    left.selectionId = selected;
    left.renderBuild(me);
    if (boards.current?.rival !== rival || timelines) right.renderBuild(rival);
    boards.current = { me, rival };
    if (!centered.current) {
      left.centerOn(me.map.core.x, me.map.core.y);
      right.centerOn(rival.map.core.x, rival.map.core.y);
      centered.current = true;
    }
    if (timelines) {
      left.startReplay(timelines[0], () => 8, () => {}, () => {});
      right.startReplay(timelines[1], () => 8, () => {}, () => {});
    }
    } catch { setFailed(true); }
  }, [me, rival, ready, roomTool, selected, timelines, failed]);

  return (
    <>
      {failed && <p role="status">Using planning boards for this duel.</p>}
      <div className="duel-boards">
        <article><h2>Your dungeon <small>{Math.ceil(me.core.hp)} core HP</small></h2><div className="duel-canvas h2h-canvas" ref={leftHost}>
          {failed && <PlannerBoard run={me} label="Your duel dungeon" onTile={onClick} active={!timelines} />}
        </div></article>
        <article><h2>Rival dungeon <small>{Math.ceil(rival.core.hp)} core HP</small></h2><div className="duel-canvas h2h-canvas" ref={rightHost}>
          {failed && <PlannerBoard run={rival} label="Rival dungeon" />}
        </div></article>
      </div>
    </>
  );
}

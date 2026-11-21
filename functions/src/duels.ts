import { randomBytes, randomInt } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { RESEARCH_BY_ID, TRAP_BY_ID, UNIT_BY_ID } from "../../app/src/sim/content";
import { emptyStronghold } from "../../app/src/sim/kingdom";
import type { Stronghold } from "../../app/src/sim/kingdom";
import {
  applyDuelAction, DUEL_BUILD_MS, DUEL_FIRST_BUILD_MS, DUEL_REPLAY_MS, DUEL_WIN_SHARDS, newDuelPlayer, settleDuelRound,
} from "../../app/src/sim/duel";
import type { DuelAction, DuelRoom, DuelRound } from "../../app/src/sim/duel";

const options = { region: "us-central1", maxInstances: 10 } as const;
const strongholdPath = (uid: string) => `players/${uid}/kingdom/stronghold`;
const serialized = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function playerId(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to play a duel.");
  return uid;
}

function roomCode(id: unknown): string {
  if (typeof id !== "string" || !/^[A-F\d]{8}$/i.test(id)) throw new HttpsError("invalid-argument", "Enter the eight-character room code.");
  return id.toUpperCase();
}

function readAction(raw: unknown): DuelAction {
  if (typeof raw !== "object" || raw === null) throw new HttpsError("invalid-argument", "Invalid duel action.");
  const action = raw as Record<string, unknown>;
  const { type, x, y, id } = action;
  function invalid(): never { throw new HttpsError("invalid-argument", "Invalid duel action."); }
  function coordinates() {
    if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 63 || y > 63) return invalid();
    return { x, y };
  }
  function identifier(catalog?: object): string {
    if (typeof id !== "string" || !/^[a-z\d_]{1,100}$/i.test(id) || (catalog && !Object.hasOwn(catalog, id))) return invalid();
    return id;
  }
  switch (type) {
    case "dig": case "room": return { type, ...coordinates() };
    case "place": return { type, ...coordinates(), id: identifier(UNIT_BY_ID) };
    case "trap": return { type, ...coordinates(), id: identifier(TRAP_BY_ID) };
    case "move": return { type, ...coordinates(), id: identifier() };
    case "send": case "rank": return { type, id: identifier(UNIT_BY_ID) };
    case "research": return { type, id: identifier(RESEARCH_BY_ID) };
    case "sell": return { type, id: identifier() };
    case "advance": case "core": case "ready": case "surrender": return { type };
    default: return invalid();
  }
}

export const createDuel = onCall(options, async ({ auth }) => {
  const uid = playerId(auth?.uid);
  const db = getFirestore();
  const id = randomBytes(4).toString("hex").toUpperCase();
  const seed = randomInt(0x7fffffff);
  const base = (await db.doc(strongholdPath(uid)).get()).data() as Stronghold | undefined;
  const room: DuelRoom = { id, seed, uids: [uid], players: { [uid]: newDuelPlayer(uid, seed, base?.levels) },
    wave: 1, status: "waiting", buildAt: 0, deadline: 0, winner: null, lastRound: 0 };
  await db.doc(`duels/${id}`).create(serialized(room));
  return { id };
});

export const joinDuel = onCall(options, async ({ auth, data }) => {
  const uid = playerId(auth?.uid);
  const id = roomCode(data?.id);
  const db = getFirestore();
  const ref = db.doc(`duels/${id}`);
  await db.runTransaction(async (transaction) => {
    const room = (await transaction.get(ref)).data() as DuelRoom | undefined;
    if (!room) throw new HttpsError("not-found", "Duel room was not found.");
    if (room.uids.includes(uid)) return;
    if (room.status !== "waiting") throw new HttpsError("failed-precondition", "That duel is already full or finished.");
    const base = (await transaction.get(db.doc(strongholdPath(uid)))).data() as Stronghold | undefined;
    room.uids.push(uid);
    room.players[uid] = newDuelPlayer(uid, room.seed, base?.levels);
    room.status = "playing";
    room.buildAt = Date.now() + 1_000;
    room.deadline = room.buildAt + DUEL_FIRST_BUILD_MS;
    transaction.set(ref, serialized(room));
  });
  return { id };
});

export const playDuel = onCall(options, async ({ auth, data }) => {
  const uid = playerId(auth?.uid);
  const id = roomCode(data?.id);
  const action = readAction(data?.action);
  const db = getFirestore();
  const ref = db.doc(`duels/${id}`);
  await db.runTransaction(async (transaction) => {
    const room = (await transaction.get(ref)).data() as DuelRoom | undefined;
    if (!room?.uids.includes(uid)) throw new HttpsError("permission-denied", "You are not in that duel.");
    if (room.status === "finished" || data?.wave !== room.wave) {
      if (action.type === "advance" || (room.status === "finished" && action.type === "surrender")) return;
      throw new HttpsError("failed-precondition", "That round is finished.");
    }
    const now = Date.now();
    let round: DuelRound | undefined;
    if (action.type === "surrender") {
      room.winner = room.uids.find((opponent) => opponent !== uid) ?? null;
      room.status = "finished";
    } else {
      if (room.status !== "playing" || now < room.buildAt) throw new HttpsError("failed-precondition", "The build phase has not started.");
      if (action.type === "advance") {
        if (now < room.deadline && !room.uids.every((id) => room.players[id].ready)) return;
      } else {
        if (now >= room.deadline) throw new HttpsError("deadline-exceeded", "The build phase has ended.");
        const player = room.players[uid];
        const error = applyDuelAction(player, action, now - room.buildAt);
        if (error) throw new HttpsError("failed-precondition", error);
        player.commands++;
      }
      if (now >= room.deadline || room.uids.every((id) => room.players[id].ready)) {
        round = settleDuelRound(room);
        if (room.status === "playing") {
          room.buildAt = Date.now() + DUEL_REPLAY_MS;
          room.deadline = room.buildAt + DUEL_BUILD_MS;
        }
      }
    }
    if (room.status === "finished" && room.winner) {
      const baseRef = db.doc(strongholdPath(room.winner));
      const base = (await transaction.get(baseRef)).data() as Stronghold | undefined;
      const winnerBase = base ?? emptyStronghold();
      transaction.set(baseRef, { ...winnerBase, shards: winnerBase.shards + DUEL_WIN_SHARDS });
    }
    if (round) transaction.set(ref.collection("rounds").doc(String(round.wave)), serialized(round));
    transaction.set(ref, serialized(room));
  });
  return { ok: true };
});

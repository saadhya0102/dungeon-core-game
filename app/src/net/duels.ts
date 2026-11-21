import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { requireCloud } from "../firebase";
import type { DuelAction, DuelRoom, DuelRound } from "../sim/duel";

export const createDuelRoom = async () => (await httpsCallable<void, { id: string }>(requireCloud().functions, "createDuel")()).data.id;
export const joinDuelRoom = async (id: string) => (await httpsCallable<{ id: string }, { id: string }>(requireCloud().functions, "joinDuel")({ id })).data.id;
export const playDuelAction = async (id: string, wave: number, action: DuelAction) =>
  httpsCallable<{ id: string; wave: number; action: DuelAction }, { ok: boolean }>(requireCloud().functions, "playDuel")({ id, wave, action });

export function watchDuel(id: string, onRoom: (room: DuelRoom | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(requireCloud().db, "duels", id), (snapshot) => onRoom(snapshot.exists() ? snapshot.data() as DuelRoom : null), onError);
}

export async function loadDuelRound(id: string, round: number) {
  const snapshot = await getDoc(doc(requireCloud().db, "duels", id, "rounds", String(round)));
  return snapshot.exists() ? snapshot.data() as DuelRound : null;
}

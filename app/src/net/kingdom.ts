import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { CAMPAIGN, clearCity, emptyStronghold, upgradeBuilding } from "../sim/kingdom";
import type { BuildingId, Stronghold, SwiftRule } from "../sim/kingdom";
import type { RunState } from "../sim/types";
import { withDeadline } from "./deadline";

export const strongholdPath = (uid: string) => `players/${uid}/kingdom/stronghold`;

export function localStronghold(uid: string): Stronghold {
  try {
    const raw = localStorage.getItem(`dc_stronghold_${uid}`);
    const base = raw ? JSON.parse(raw) as Stronghold : null;
    if (base?.levels && Array.isArray(base.cleared) && Number.isFinite(base.shards)) return base;
  } catch { /* no cache available */ }
  return emptyStronghold();
}

function cacheStronghold(uid: string, base: Stronghold) {
  try { localStorage.setItem(`dc_stronghold_${uid}`, JSON.stringify(base)); } catch { /* cloud is authoritative */ }
}

export async function loadStronghold(uid: string): Promise<Stronghold> {
  if (!db || uid === "local") return localStronghold(uid);
  const snapshot = await withDeadline(getDoc(doc(db, strongholdPath(uid))));
  const base = snapshot.exists() ? snapshot.data() as Stronghold : emptyStronghold();
  cacheStronghold(uid, base);
  return base;
}

async function changeStronghold(uid: string, change: (base: Stronghold) => Stronghold): Promise<Stronghold> {
  if (!db || uid === "local") {
    const next = change(localStronghold(uid));
    localStorage.setItem(`dc_stronghold_${uid}`, JSON.stringify(next));
    return next;
  }
  const ref = doc(db, strongholdPath(uid));
  const next = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const base = snapshot.exists() ? snapshot.data() as Stronghold : emptyStronghold();
    const next = change(base);
    if (next !== base) transaction.set(ref, next);
    return next;
  });
  cacheStronghold(uid, next);
  return next;
}

export const buyBuilding = (uid: string, id: BuildingId) => changeStronghold(uid, (base) => {
  const next = upgradeBuilding(base, id);
  if (!next) throw new Error("You need enough shards and an available building level.");
  return next;
});
export const claimCity = (run: RunState) => changeStronghold(run.uid, (base) => {
  const city = CAMPAIGN.find((entry) => entry.id === run.cityId);
  return city && run.status === "ended" && run.stats.wavesCleared >= city.waves ? clearCity(base, city.id, true) : base;
});

export interface SwiftScore { uid: string; wave: number; kills: number }

export const swiftBoardId = (run: RunState) => run.modifiers.length ? null : (run.swiftRule ?? "standard");

function localScore(uid: string, board: SwiftRule): SwiftScore | null {
  try { return JSON.parse(localStorage.getItem(`dc_swift_${uid}_${board}`) ?? "null") as SwiftScore | null; }
  catch { return null; }
}

function beats(score: SwiftScore, previous: SwiftScore | null): boolean {
  return !previous || score.wave > previous.wave || (score.wave === previous.wave && score.kills > previous.kills);
}

export async function recordSwift(run: RunState) {
  const board = swiftBoardId(run);
  if (!board || run.cityId || run.stats.bestWave < 1) return;
  const score: SwiftScore = { uid: run.uid, wave: run.stats.bestWave, kills: run.stats.kills };
  const previous = localScore(run.uid, board);
  const best = previous && !beats(score, previous) ? previous : score;
  localStorage.setItem(`dc_swift_${run.uid}_${board}`, JSON.stringify(best));
  if (!db || run.uid === "local") return;
  const ref = doc(db, "swiftBoards", board, "scores", run.uid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (beats(best, snapshot.exists() ? snapshot.data() as SwiftScore : null)) transaction.set(ref, best);
  });
}

export async function loadSwiftBoard(uid: string, board: SwiftRule) {
  const own = localScore(uid, board);
  if (!db || uid === "local") return { scores: own ? [own] : [], online: false };
  try {
    const scores = await withDeadline(getDocs(query(collection(db, "swiftBoards", board, "scores"), orderBy("wave", "desc"), orderBy("kills", "desc"), limit(50))));
    const entries = scores.docs.map((entry) => entry.data() as SwiftScore);
    if (own && !entries.some((entry) => entry.uid === uid && !beats(own, entry))) {
      const index = entries.findIndex((entry) => entry.uid === uid);
      if (index < 0) entries.push(own);
      else entries[index] = own;
    }
    entries.sort((a, b) => b.wave - a.wave || b.kills - a.kills);
    return { scores: entries.slice(0, 50), online: true };
  } catch {
    return { scores: own ? [own] : [], online: false };
  }
}

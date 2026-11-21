// Persistence (docs/13, 16). Firestore when signed in; localStorage fallback.
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, limit } from "firebase/firestore";
import { db, requireCloud } from "../firebase";
import type { RunState, Snapshot } from "../sim/types";
import { withDeadline } from "./deadline";

function lsKeyRun(uid: string, campaign = false) { return `dc_run_${uid}${campaign ? "_campaign" : ""}`; }
const activeDoc = (uid: string, campaign: boolean) => doc(requireCloud().db, "players", uid, "run", campaign ? "campaign" : "active");
function lsKeySnaps(uid: string) { return `dc_snaps_${uid}`; }

let cloudWarned = false;
function warnCloudOnce(e: unknown) {
  if (cloudWarned) return;
  cloudWarned = true;
  console.warn("Cloud sync unavailable (deploy Firestore rules to enable). Using local saves.", e);
}

export function saveLocalActiveRun(run: RunState) {
  try { localStorage.setItem(lsKeyRun(run.uid, !!run.cityId), JSON.stringify(run)); } catch { /* cloud may still be available */ }
}

export async function saveActiveRun(run: RunState): Promise<void> {
  saveLocalActiveRun(run);
  if (db && run.uid !== "local") {
    try {
      await setDoc(activeDoc(run.uid, !!run.cityId), run as object);
      return;
    } catch (e) { warnCloudOnce(e); }
  }
}

function readableRun(value: unknown): RunState | null {
  const run = value as RunState | null;
  return run?.id && run.uid && run.core && run.map?.tiles && run.research?.ranks && run.stats
    && Array.isArray(run.research?.owned) && Array.isArray(run.inventory) && Array.isArray(run.gearShop)
    && Array.isArray(run.units) && Array.isArray(run.traps) && Array.isArray(run.modifiers)
    ? run : null;
}

export function readActiveRun(uid: string, campaign = false): RunState | null {
  try {
    const raw = localStorage.getItem(lsKeyRun(uid, campaign));
    return raw ? readableRun(JSON.parse(raw)) : null;
  } catch { return null; }
}

export async function loadActiveRun(uid: string, campaign = false): Promise<RunState | null> {
  if (db && uid !== "local") {
    try {
      const snap = await withDeadline(getDoc(activeDoc(uid, campaign)));
      const local = readActiveRun(uid, campaign);
      const remote = snap.exists() ? readableRun(snap.data()) : null;
      if (remote && (!local || remote.updatedAt >= local.updatedAt)) { saveLocalActiveRun(remote); return remote; }
    } catch (e) { warnCloudOnce(e); }
  }
  return readActiveRun(uid, campaign);
}

export async function clearActiveRun(uid: string, campaign = false): Promise<void> {
  try { localStorage.removeItem(lsKeyRun(uid, campaign)); } catch { /* ignore */ }
  if (db && uid !== "local") {
    try { await withDeadline(deleteDoc(activeDoc(uid, campaign))); } catch (e) { warnCloudOnce(e); }
  }
}

export async function saveSnapshot(snap: Snapshot): Promise<boolean> {
  if (db && snap.uid !== "local") {
    try {
      await withDeadline(setDoc(doc(db, "players", snap.uid, "snapshots", snap.id), snap as object));
      return true;
    } catch (e) { warnCloudOnce(e); }
  }
  try {
    const raw = localStorage.getItem(lsKeySnaps(snap.uid));
    const list: Snapshot[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(lsKeySnaps(snap.uid), JSON.stringify([...list.filter((item) => item.id !== snap.id), snap].slice(-40)));
    return true;
  } catch { return false; }
}

export async function loadSnapshots(uid: string): Promise<Snapshot[]> {
  if (db && uid !== "local") {
    try {
      const col = await withDeadline(getDocs(collection(db, "players", uid, "snapshots")));
      return [...new Map([...cachedSnapshots(uid), ...col.docs.map((d) => d.data() as Snapshot)]
        .map((snapshot) => [snapshot.id, snapshot])).values()].sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) { warnCloudOnce(e); }
  }
  return cachedSnapshots(uid).sort((a, b) => b.createdAt - a.createdAt);
}

function cachedSnapshots(uid: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(lsKeySnaps(uid));
    const list: Snapshot[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export async function deleteSnapshot(uid: string, id: string): Promise<void> {
  if (getMainId(uid) === id) await clearMainDungeon(uid);
  if (db && uid !== "local") {
    try { await deleteDoc(doc(db, "players", uid, "snapshots", id)); } catch (e) { warnCloudOnce(e); }
  }
  try {
    const raw = localStorage.getItem(lsKeySnaps(uid));
    const list: Snapshot[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(lsKeySnaps(uid), JSON.stringify(list.filter((s) => s.id !== id)));
  } catch { /* ignore */ }
}

// --- "Main dungeon" per profile + global H2H pool (Tier 2; rules-only) ---
// The pool holds exactly ONE entry per profile, keyed by uid: the player's
// chosen main dungeon. That single entry is all other players can face.
function lsKeyMain(uid: string) { return `dc_main_${uid}`; }

export function getMainId(uid: string): string | null {
  try { return localStorage.getItem(lsKeyMain(uid)); } catch { return null; }
}
function setMainId(uid: string, id: string | null) {
  try { if (id) localStorage.setItem(lsKeyMain(uid), id); else localStorage.removeItem(lsKeyMain(uid)); } catch { /* ignore */ }
}

export async function setMainDungeon(snap: Snapshot): Promise<void> {
  setMainId(snap.uid, snap.id);
  if (!db || snap.uid === "local") return;
  try { await setDoc(doc(db, "h2hPool", snap.uid), { ...snap, shareable: true } as object); }
  catch (e) { warnCloudOnce(e); }
}

export async function clearMainDungeon(uid: string): Promise<void> {
  setMainId(uid, null);
  if (!db || uid === "local") return;
  try { await deleteDoc(doc(db, "h2hPool", uid)); } catch { /* ignore */ }
}

// --- Ladder rating (Elo-lite), per profile. Local-first. ---
function lsKeyRating(uid: string) { return `dc_rating_${uid}`; }
const DEFAULT_RATING = 1000;

export function getRating(uid: string): number {
  try {
    const r = localStorage.getItem(lsKeyRating(uid));
    return r ? parseInt(r, 10) : DEFAULT_RATING;
  } catch { return DEFAULT_RATING; }
}

export function setRating(uid: string, n: number): void {
  try { localStorage.setItem(lsKeyRating(uid), String(Math.round(n))); } catch { /* ignore */ }
}

export async function loadPoolOpponents(uid: string, count = 50): Promise<Snapshot[]> {
  if (!db || uid === "local") return [];
  try {
    const col = await withDeadline(getDocs(query(collection(db, "h2hPool"), limit(count))));
    return col.docs.map((d) => d.data() as Snapshot).filter((s) => s.uid !== uid);
  } catch (e) { warnCloudOnce(e); return []; }
}

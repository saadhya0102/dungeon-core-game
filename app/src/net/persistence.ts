// Persistence (docs/13, 16). Firestore when signed in; localStorage fallback.
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import type { RunState, Snapshot } from "../sim/types";

function lsKeyRun(uid: string) { return `dc_run_${uid}`; }
function lsKeySnaps(uid: string) { return `dc_snaps_${uid}`; }

const useCloud = (uid: string) => uid !== "local";

let cloudWarned = false;
function warnCloudOnce(e: unknown) {
  if (cloudWarned) return;
  cloudWarned = true;
  console.warn("Cloud sync unavailable (deploy Firestore rules to enable). Using local saves.", e);
}

export async function saveActiveRun(run: RunState): Promise<void> {
  if (useCloud(run.uid)) {
    try {
      await setDoc(doc(db, "players", run.uid, "run", "active"), run as object);
      return;
    } catch (e) { warnCloudOnce(e); }
  }
  try { localStorage.setItem(lsKeyRun(run.uid), JSON.stringify(run)); } catch { /* ignore */ }
}

export async function loadActiveRun(uid: string): Promise<RunState | null> {
  if (useCloud(uid)) {
    try {
      const snap = await getDoc(doc(db, "players", uid, "run", "active"));
      if (snap.exists()) return snap.data() as RunState;
    } catch (e) { warnCloudOnce(e); }
  }
  try {
    const raw = localStorage.getItem(lsKeyRun(uid));
    if (raw) return JSON.parse(raw) as RunState;
  } catch { /* ignore */ }
  return null;
}

export async function clearActiveRun(uid: string): Promise<void> {
  if (useCloud(uid)) {
    try { await deleteDoc(doc(db, "players", uid, "run", "active")); } catch { /* ignore */ }
  }
  try { localStorage.removeItem(lsKeyRun(uid)); } catch { /* ignore */ }
}

export async function saveSnapshot(snap: Snapshot): Promise<void> {
  if (useCloud(snap.uid)) {
    try {
      await setDoc(doc(db, "players", snap.uid, "snapshots", snap.id), snap as object);
      return;
    } catch (e) { warnCloudOnce(e); }
  }
  try {
    const raw = localStorage.getItem(lsKeySnaps(snap.uid));
    const list: Snapshot[] = raw ? JSON.parse(raw) : [];
    list.push(snap);
    localStorage.setItem(lsKeySnaps(snap.uid), JSON.stringify(list.slice(-40)));
  } catch { /* ignore */ }
}

export async function loadSnapshots(uid: string): Promise<Snapshot[]> {
  if (useCloud(uid)) {
    try {
      const col = await getDocs(collection(db, "players", uid, "snapshots"));
      return col.docs.map((d) => d.data() as Snapshot).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) { warnCloudOnce(e); }
  }
  try {
    const raw = localStorage.getItem(lsKeySnaps(uid));
    const list: Snapshot[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch { return []; }
}

export async function deleteSnapshot(uid: string, id: string): Promise<void> {
  if (getMainId(uid) === id) await clearMainDungeon(uid);
  if (useCloud(uid)) {
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
  if (!useCloud(snap.uid)) return;
  try { await setDoc(doc(db, "h2hPool", snap.uid), { ...snap, shareable: true } as object); }
  catch (e) { warnCloudOnce(e); }
}

export async function clearMainDungeon(uid: string): Promise<void> {
  setMainId(uid, null);
  if (!useCloud(uid)) return;
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
  if (!useCloud(uid)) return [];
  try {
    const col = await getDocs(query(collection(db, "h2hPool"), limit(count)));
    return col.docs.map((d) => d.data() as Snapshot).filter((s) => s.uid !== uid);
  } catch (e) { warnCloudOnce(e); return []; }
}

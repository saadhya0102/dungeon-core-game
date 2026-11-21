// Auth wrapper (docs/13 §1). Anonymous sign-in with graceful local fallback.
import {
  onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut,
} from "firebase/auth";
import { auth, requireCloud } from "../firebase";

let currentUid = "local";
export function getUid(): string { return currentUid; }

export function initAuth(onUid: (uid: string) => void) {
  if (!auth) return () => {};
  const service = auth;
  let active = true;
  const unsubscribe = onAuthStateChanged(service, (user) => {
    currentUid = user?.uid ?? "local";
    onUid(currentUid);
  });
  void service.authStateReady().then(async () => {
    if (active && !service.currentUser) await signInAnonymously(service);
  }).catch((failure) => {
    if (active) console.warn("Anonymous auth unavailable. Using local play.", failure);
  });
  return () => { active = false; unsubscribe(); };
}

export async function signUpEmail(email: string, pass: string) {
  await createUserWithEmailAndPassword(requireCloud().auth, email, pass);
}
export async function signInEmail(email: string, pass: string) {
  await signInWithEmailAndPassword(requireCloud().auth, email, pass);
}
export async function signInGoogle() {
  await signInWithPopup(requireCloud().auth, new GoogleAuthProvider());
}
export async function doSignOut() {
  const service = requireCloud().auth;
  await signOut(service);
  // Return to a fresh anonymous session so the player can keep playing.
  try { await signInAnonymously(service); } catch { /* local mode */ }
}

export function currentUserInfo(): { uid: string; email: string | null; isAnonymous: boolean } | null {
  const u = auth?.currentUser;
  if (!u) return null;
  return { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous };
}

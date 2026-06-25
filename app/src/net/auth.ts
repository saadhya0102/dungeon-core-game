// Auth wrapper (docs/13 §1). Anonymous sign-in with graceful local fallback.
import {
  onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut,
} from "firebase/auth";
import { auth } from "../firebase";

let currentUid = "local";
export function getUid(): string { return currentUid; }

export function initAuth(onUid: (uid: string) => void) {
  try {
    onAuthStateChanged(auth, (user) => {
      if (user) { currentUid = user.uid; onUid(user.uid); }
    });
    signInAnonymously(auth).catch((e) => {
      console.warn("Anonymous auth unavailable, using local mode:", e?.code ?? e);
      onUid("local");
    });
  } catch (e) {
    console.warn("Auth init failed, local mode:", e);
    onUid("local");
  }
}

export async function signUpEmail(email: string, pass: string) {
  await createUserWithEmailAndPassword(auth, email, pass);
}
export async function signInEmail(email: string, pass: string) {
  await signInWithEmailAndPassword(auth, email, pass);
}
export async function signInGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function doSignOut() {
  await signOut(auth);
  // Return to a fresh anonymous session so the player can keep playing.
  try { await signInAnonymously(auth); } catch { /* local mode */ }
}

export function currentUserInfo(): { uid: string; email: string | null; isAnonymous: boolean } | null {
  const u = auth.currentUser;
  if (!u) return null;
  return { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous };
}

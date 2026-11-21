// ============================================================================
// Cloud Functions - authoritative server path (docs/16).
// The deterministic sim is shared with the client and bundled in via esbuild
// (see package.json build script). Deploying Functions requires the Blaze plan;
// the client also works fully client-authoritative / offline without these.
// ============================================================================
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

import {
  createNewRun, resolveWave, applyWaveResult,
} from "../../app/src/sim";
import type { RunState, NGModifier } from "../../app/src/sim";
export { createDuel, joinDuel, playDuel } from "./duels";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = getFirestore();

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to play.");
  return uid;
}

export const ping = onCall((request) => ({
  pong: true,
  uid: request.auth?.uid ?? null,
  serverTime: Date.now(),
}));

/** Create a new authoritative run and persist it. */
export const startRunAuth = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const modifiers = (request.data?.modifiers ?? []) as NGModifier[];
  const run = createNewRun(uid, modifiers);
  await db.doc(`players/${uid}/run/active`).set(run as object);
  return { run };
});

/**
 * Authoritative wave resolution. Loads the player's active run, runs the
 * deterministic sim server-side, applies rewards/damage, persists, and returns
 * the timeline for client playback. The client cannot self-report outcomes.
 */
export const resolveWaveAuth = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const snap = await db.doc(`players/${uid}/run/active`).get();
  if (!snap.exists) throw new HttpsError("not-found", "No active run.");
  const run = snap.data() as RunState;
  if (run.status !== "active") throw new HttpsError("failed-precondition", "Run has ended.");

  const timeline = resolveWave(run);
  const result = applyWaveResult(run, timeline);
  await db.doc(`players/${uid}/run/active`).set(run as object);

  return { timeline, dpGained: result.dpGained, died: result.died, run };
});

/** Persist a snapshot of a (possibly ended) run for H2H / library. */
export const saveSnapshotAuth = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const snapshot = request.data?.snapshot;
  if (!snapshot || snapshot.uid !== uid) throw new HttpsError("invalid-argument", "Bad snapshot.");
  await db.doc(`players/${uid}/snapshots/${snapshot.id}`).set(snapshot as object);
  if (snapshot.shareable) {
    await db.doc(`public/h2hPool/snapshots/${snapshot.id}`).set({
      id: snapshot.id, uid, name: snapshot.name, rating: snapshot.rating,
      endedAtWave: snapshot.endedAtWave, simVersion: snapshot.simVersion,
    });
  }
  return { ok: true };
});

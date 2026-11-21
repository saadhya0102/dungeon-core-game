import type { RunState } from "../sim/types";

export const idleSaveKey = (uid: string) => `dc_idle_${uid}`;

export function loadIdleRun(uid: string): RunState | null {
  try {
    const run = JSON.parse(localStorage.getItem(idleSaveKey(uid)) ?? "null") as RunState | null;
    return run?.idle && run.uid === uid ? run : null;
  } catch {
    return null;
  }
}

export function saveIdleRun(run: RunState) {
  try {
    localStorage.setItem(idleSaveKey(run.uid), JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

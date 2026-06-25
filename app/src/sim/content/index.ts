// Content barrel + validation (docs/19 §12)
export * from "./units";
export * from "./enemies";
export * from "./traps";
export * from "./gear";
export * from "./research";
export * from "./achievements";

import { UNITS, UNIT_BY_ID } from "./units";
import { CLASSES } from "./enemies";
import { RESEARCH } from "./research";
import { tierOf } from "../power";

export interface ContentIssue { kind: string; id: string; detail: string; }

/** Validate the content catalog (used by tests and a dev-time check). */
export function validateContent(): ContentIssue[] {
  const issues: ContentIssue[] = [];

  for (const u of UNITS) {
    const computed = tierOf(u.stats);
    if (computed !== u.tier) {
      issues.push({ kind: "unit-tier", id: u.id, detail: `declared T${u.tier} but computes T${computed}` });
    }
  }
  for (const c of CLASSES) {
    const computed = tierOf(c.stats);
    if (computed !== c.tier) {
      issues.push({ kind: "class-tier", id: c.id, detail: `declared T${c.tier} but computes T${computed}` });
    }
  }
  for (const n of RESEARCH) {
    if (n.effect.unlockUnitId && !UNIT_BY_ID[n.effect.unlockUnitId]) {
      issues.push({ kind: "research-unit", id: n.id, detail: `references missing unit ${n.effect.unlockUnitId}` });
    }
    for (const p of n.prereqs) {
      if (!RESEARCH.find((r) => r.id === p)) {
        issues.push({ kind: "research-prereq", id: n.id, detail: `missing prereq ${p}` });
      }
    }
  }
  return issues;
}

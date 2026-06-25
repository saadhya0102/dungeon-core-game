import { useMemo } from "react";
import { useStore } from "../state/store";
import { ACHIEVEMENTS } from "../sim/content/achievements";
import { evaluateAchievements, mergeCounters } from "../game/achievements";
import type { AchProgress } from "../game/achievements";
import type { AchievementDef } from "../sim/types";

const ACH_UNLOCKED_KEY = "dc_ach_unlocked";
const ACH_LIFETIME_KEY = "dc_ach_lifetime";

function readCounterMap(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
  } catch { /* ignore malformed storage */ }
  return {};
}

export function AchievementsView({ onClose }: { onClose: () => void }) {
  const run = useStore((s) => s.run);

  const { byCategory, unlockedCount, total } = useMemo(() => {
    const unlocked = readCounterMap(ACH_UNLOCKED_KEY);
    const lifetime = readCounterMap(ACH_LIFETIME_KEY);
    const counters = mergeCounters(run?.stats ?? {}, lifetime);
    const { progress } = evaluateAchievements(counters, unlocked);

    const progById = new Map<string, AchProgress>(progress.map((p) => [p.id, p]));

    const visible = ACHIEVEMENTS.filter((def) => {
      if (!def.hidden) return true;
      return progById.get(def.id)?.unlocked ?? false;
    });

    const groups = new Map<string, { def: AchievementDef; prog: AchProgress }[]>();
    for (const def of visible) {
      const prog = progById.get(def.id);
      if (!prog) continue;
      const list = groups.get(def.category) ?? [];
      list.push({ def, prog });
      groups.set(def.category, list);
    }

    const unlockedNum = progress.filter((p) => p.unlocked).length;
    return { byCategory: groups, unlockedCount: unlockedNum, total: progress.length };
  }, [run]);

  const categories = [...byCategory.keys()];

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Achievements ({unlockedCount}/{total})</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="hint">
          Progress combines this run with your lifetime totals. Hidden achievements appear once unlocked.
        </div>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="section-title" style={{ textTransform: "capitalize" }}>{cat}</div>
            <div className="grid-cards">
              {byCategory.get(cat)!.map(({ def, prog }) => (
                <div key={def.id} className={`card ${prog.unlocked ? "" : "locked"}`}>
                  <div className="name">
                    {prog.unlocked ? "[x] " : ""}{def.name}
                  </div>
                  <div className="meta">{def.desc}</div>
                  {prog.unlocked
                    ? <div className="small" style={{ color: "var(--good)" }}>Unlocked</div>
                    : <div className="small">{Math.min(prog.current, prog.target)} / {prog.target}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

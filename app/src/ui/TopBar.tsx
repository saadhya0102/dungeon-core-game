import { useStore } from "../state/store";
import { CAMPAIGN, SWIFT_BOARDS, capacityMax, capacityUsed, sizeCap, waveForRun } from "../sim";
import { idleWave } from "../sim/idle";
import { CLASS_BY_ID, UNIQUE_BY_ID } from "../sim/content/enemies";
import type { Archetype } from "../sim/types";

export function TopBar() {
  const run = useStore((s) => s.run);
  const phase = useStore((s) => s.phase);
  const exitRun = useStore((s) => s.exitRun);
  if (!run) return null;
  const cap = capacityMax(run);
  const used = capacityUsed(run);
  const hpFrac = run.core.hp / run.core.maxHp;
  const city = CAMPAIGN.find((entry) => entry.id === run.cityId);
  const rules = SWIFT_BOARDS.find(([id]) => id === (run.swiftRule ?? "standard"));
  const wave = run.idle ? idleWave(run) : waveForRun(run);
  const counts: Record<Archetype, number> = { warrior: 0, archer: 0, mage: 0, rogue: 0 };
  const uniqueNames: string[] = [];
  for (const inv of wave.invaders) {
    const cls = CLASS_BY_ID[inv.classId];
    if (cls) counts[cls.archetype]++;
    if (inv.isUnique && cls) uniqueNames.push(`${(inv.uniqueId && UNIQUE_BY_ID[inv.uniqueId]?.name) || cls.name} T${inv.tier}`);
  }
  const ARCH_LABEL: Record<Archetype, string> = { warrior: "Warrior", archer: "Archer", mage: "Mage", rogue: "Rogue" };
  const breakdown = (Object.keys(counts) as Archetype[])
    .filter((a) => counts[a] > 0)
    .map((a) => `${counts[a]} ${ARCH_LABEL[a]}${counts[a] > 1 ? "s" : ""}`)
    .join(", ");

  return (
    <div className="topbar">
      <button className="exit-dungeon" onClick={exitRun} disabled={phase !== "build" && !run.idle}>{run.practice ? "Exit practice" : "Save & exit"}</button>
      <div className="stat dungeon-location"><span className="lbl">{run.idle ? "Idle" : city ? "Campaign" : "Swift"}</span><span className="val">{run.idle ? "Night Watch" : run.practice ? "Training dungeon" : city?.name ?? rules?.[1]}</span></div>
      <div className="stat"><span className="lbl">{run.idle ? "Embers" : "Dungeon Points"}</span><span className="val" style={{ color: "var(--gold)" }}>{run.dp.toLocaleString()}</span></div>
      <div className="stat" style={{ minWidth: 140 }}>
        <span className="lbl">Core Lv {run.core.level} &middot; HP {Math.ceil(run.core.hp)}/{run.core.maxHp}{run.core.ward > 0 ? ` (+${Math.ceil(run.core.ward)})` : ""}</span>
        <div className="bar" style={{ width: 140 }}><div style={{ width: `${hpFrac * 100}%`, background: hpFrac > 0.5 ? "var(--good)" : hpFrac > 0.25 ? "var(--gold)" : "var(--danger)" }} /></div>
      </div>
      <div className="stat"><span className="lbl">Capacity</span><span className="val" style={{ color: used > cap ? "var(--danger)" : "var(--text)" }}>{used}/{cap}</span></div>
      <div className="stat"><span className="lbl">{run.idle ? "Difficulty" : "Wave"}</span><span className="val">{city ? `${Math.min(run.wave, city.waves)}/${city.waves}` : run.wave}</span></div>
      <div className="stat"><span className="lbl">Tiles</span><span className="val">{run.map.openedCount}/{sizeCap(run)}</span></div>
      <div className="spacer" />
      <div className="scout" title={uniqueNames.length ? `Leaders: ${uniqueNames.join(", ")}` : undefined}>
        <span className="lbl" style={{ color: "var(--muted)" }}>INCOMING&nbsp;</span>
        <b style={{ textTransform: "capitalize", color: wave.groupType === "crusade" ? "var(--danger)" : wave.groupType === "horde" ? "var(--gold)" : "var(--text)" }}>{wave.groupType}</b>
        <span className="small"> · {wave.invaders.length} {wave.invaders.length === 1 ? "foe" : "foes"} (T{wave.tierBand[0]}{wave.tierBand[0] !== wave.tierBand[1] ? `–${wave.tierBand[1]}` : ""})</span>
        <div className="small" style={{ marginTop: 2 }}>{breakdown}</div>
        {uniqueNames.length > 0 && <div className="scout-champion">{uniqueNames.join(" · ")}</div>}
      </div>
    </div>
  );
}

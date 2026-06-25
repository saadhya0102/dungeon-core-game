import { useState } from "react";
import { useStore } from "../state/store";
import { UNITS } from "../sim/content/units";
import { TRAPS } from "../sim/content/traps";
import { RESEARCH, researchByBranch } from "../sim/content/research";
import {
  unitCost, turretCost, gearPrice, salvageValue, coreLevelRow, spaceCost,
  capacityMax, capacityUsed, unlockedUnits, FAMILIES,
} from "../sim";
import type { ResearchBranch } from "../sim/types";

export function Panels() {
  const panel = useStore((s) => s.openPanel);
  if (!panel) return null;
  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) useStore.getState().setPanel(null); }}>
      <div className="panel">
        {panel === "units" && <UnitsPanel />}
        {panel === "traps" && <TrapsPanel />}
        {panel === "research" && <ResearchPanel />}
        {panel === "shop" && <ShopPanel />}
        {panel === "core" && <CorePanel />}
      </div>
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h2>{title}</h2>
      <button onClick={() => useStore.getState().setPanel(null)}>Close</button>
    </div>
  );
}

function UnitsPanel() {
  const run = useStore((s) => s.run)!;
  const setTool = useStore((s) => s.setTool);
  const setPanel = useStore((s) => s.setPanel);
  const unlocked = unlockedUnits(run);
  const maxTier = coreLevelRow(run.core.level).maxUnitTier;
  const cap = capacityMax(run), used = capacityUsed(run);

  return (
    <div>
      <PanelHeader title={`Units  (capacity ${used}/${cap})`} />
      <div className="hint">Click a unit, then click an open floor tile to place it. Drag units in Select mode to move.</div>
      {FAMILIES.map((fam) => {
        const units = UNITS.filter((u) => u.family === fam);
        return (
          <div key={fam}>
            <div className="section-title" style={{ textTransform: "capitalize" }}>{fam}</div>
            <div className="grid-cards">
              {units.map((u) => {
                const isUnlocked = unlocked.has(u.id);
                const tierOk = u.tier <= maxTier;
                const cost = unitCost(u);
                const afford = run.dp >= cost;
                const ok = isUnlocked && tierOk && afford;
                return (
                  <div key={u.id} className={`card ${ok ? "" : "locked"}`}
                    onClick={() => { if (!ok) return; setTool("placeUnit", u.id, false); setPanel(null); }}>
                    <div className="name">{u.name}</div>
                    <div className="meta">T{u.tier} &middot; {u.role} &middot; {spaceCost(u.tier)} space</div>
                    <div className="meta">HP {u.stats.hp} &middot; DEF {u.stats.def} &middot; ATK {Math.max(u.stats.phys, u.stats.mag, u.stats.rng)}</div>
                    <div className="cost">{cost} DP</div>
                    {!isUnlocked && <div className="small">Locked (research)</div>}
                    {isUnlocked && !tierOk && <div className="small">Needs Core Lv (T{u.tier})</div>}
                    {u.turretCapable && isUnlocked && tierOk && run.core.level >= 2 && (
                      <button className="small" style={{ marginTop: 4 }}
                        onClick={(e) => { e.stopPropagation(); setTool("placeUnit", u.id, true); setPanel(null); }}>
                        Place as Turret ({turretCost(u)} DP)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrapsPanel() {
  const run = useStore((s) => s.run)!;
  const setTool = useStore((s) => s.setTool);
  const setPanel = useStore((s) => s.setPanel);
  const maxTier = coreLevelRow(run.core.level).maxUnitTier;
  const trapUnlocked = (tier: number) =>
    tier <= 2 ? run.research.owned.includes("res_basic_traps")
      : tier <= 5 ? run.research.owned.includes("res_adv_traps")
        : run.research.owned.includes("res_elite_traps");

  return (
    <div>
      <PanelHeader title="Traps" />
      <div className="hint">Click a trap, then place on floor (not near the entrance/core). Hidden until a rogue reveals it.</div>
      <div className="grid-cards">
        {TRAPS.map((t) => {
          const ok = trapUnlocked(t.tier) && t.tier <= maxTier && run.dp >= t.cost;
          return (
            <div key={t.id} className={`card ${ok ? "" : "locked"}`}
              onClick={() => { if (!ok) return; setTool("placeTrap", t.id); setPanel(null); }}>
              <div className="name">{t.name}</div>
              <div className="meta">T{t.tier} &middot; {t.category} &middot; hidden {t.hiddenRating}</div>
              <div className="meta">{t.effect.damage ? `DMG ${t.effect.damage} ` : ""}{t.effect.stripDodge ? "anti-rogue " : ""}{t.charges === "infinite" ? "\u221e" : `${t.charges} charges`}</div>
              <div className="cost">{t.cost} DP</div>
              {!trapUnlocked(t.tier) && <div className="small">Locked (research)</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResearchPanel() {
  const run = useStore((s) => s.run)!;
  const buy = useStore((s) => s.buyResearch);
  const [branch, setBranch] = useState<ResearchBranch>("goblinoid");
  const branches: ResearchBranch[] = [...FAMILIES, "general"];
  const rTier = coreLevelRow(run.core.level).researchTier;
  const nodes = researchByBranch(branch);

  return (
    <div>
      <PanelHeader title="Research" />
      <div className="hint">Research tier R{rTier} available (raise Core Level for more). Family upgrades buff all units of that family.</div>
      <div className="tabs">
        {branches.map((b) => (
          <button key={b} className={branch === b ? "active" : ""} style={{ textTransform: "capitalize" }} onClick={() => setBranch(b)}>{b}</button>
        ))}
      </div>
      <div className="grid-cards">
        {nodes.map((n) => {
          const rank = run.research.ranks[n.id] ?? (run.research.owned.includes(n.id) ? 1 : 0);
          const maxed = rank >= n.ranks;
          const tierOk = rTier >= n.researchTier;
          const prereqOk = n.prereqs.every((p) => run.research.owned.includes(p));
          const afford = run.dp >= n.cost;
          const ok = !maxed && tierOk && prereqOk && afford;
          return (
            <div key={n.id} className={`card ${ok ? "" : "locked"}`} onClick={() => ok && buy(n.id)}>
              <div className="name">{n.name}{n.ranks > 1 ? ` (${rank}/${n.ranks})` : ""}</div>
              <div className="meta">R{n.researchTier} &middot; {n.type}</div>
              {maxed ? <div className="small" style={{ color: "var(--good)" }}>Owned</div>
                : <div className="cost">{n.cost} DP {!tierOk ? "(R locked)" : !prereqOk ? "(needs prereq)" : ""}</div>}
            </div>
          );
        })}
      </div>
      <div className="small" style={{ marginTop: 8 }}>Total nodes: {RESEARCH.length}</div>
    </div>
  );
}

function ShopPanel() {
  const run = useStore((s) => s.run)!;
  const buyGear = useStore((s) => s.buyGear);
  const reroll = useStore((s) => s.rerollShop);
  const salvage = useStore((s) => s.salvage);

  return (
    <div>
      <PanelHeader title="Gear Shop" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={reroll}>Reroll (15 DP)</button>
        <span className="small">Stock refreshes on reroll. Match gear type to a unit's strong affinity.</span>
      </div>
      <div className="grid-cards">
        {run.gearShop.map((g) => (
          <div key={g.id} className="card" onClick={() => buyGear(g.id)}>
            <div className={`name q-${g.quality}`}>{g.name}</div>
            <div className="meta">T{g.tier} &middot; {g.slot} &middot; {g.itemType}</div>
            <div className="meta">{Object.entries(g.mods).map(([k, v]) => `${k}+${v}`).join(", ")}</div>
            {g.affixes.length > 0 && <div className="small">{g.affixes.map((a) => `${a.stat}+${a.value}`).join(", ")}</div>}
            <div className="cost">{gearPrice(g.tier, g.quality)} DP</div>
          </div>
        ))}
      </div>
      <div className="section-title">Inventory ({run.inventory.length})</div>
      <div className="inv-grid">
        {run.inventory.map((g) => (
          <div key={g.id} className="card">
            <div className={`name q-${g.quality}`}>{g.name}</div>
            <div className="meta">T{g.tier} &middot; {g.slot}</div>
            <button className="small" onClick={() => salvage(g.id)}>Salvage (+{salvageValue(g.tier, g.quality)})</button>
          </div>
        ))}
        {run.inventory.length === 0 && <div className="small">No items yet &mdash; defeat adventurers for drops.</div>}
      </div>
    </div>
  );
}

function CorePanel() {
  const run = useStore((s) => s.run)!;
  const upgrade = useStore((s) => s.upgradeCore);
  if (run.core.level >= 20) return <div><PanelHeader title="Core" /><div>Core is at maximum level.</div></div>;
  const cur = coreLevelRow(run.core.level);
  const next = coreLevelRow(run.core.level + 1);
  return (
    <div>
      <PanelHeader title={`Core Level ${run.core.level} -> ${run.core.level + 1}`} />
      <div className="grid-cards">
        <div className="card"><div className="name">Core HP</div><div className="meta">{cur.coreHp} &rarr; {next.coreHp}</div></div>
        <div className="card"><div className="name">Capacity</div><div className="meta">{cur.capacity} &rarr; {next.capacity}</div></div>
        <div className="card"><div className="name">Size Cap</div><div className="meta">{cur.sizeCap} &rarr; {next.sizeCap}</div></div>
        <div className="card"><div className="name">Max Unit Tier</div><div className="meta">T{cur.maxUnitTier} &rarr; T{next.maxUnitTier}</div></div>
        <div className="card"><div className="name">Research Tier</div><div className="meta">R{cur.researchTier} &rarr; R{next.researchTier}</div></div>
      </div>
      <button className="primary big" style={{ marginTop: 12, width: "100%" }}
        disabled={run.dp < next.cost}
        onClick={() => { upgrade(); useStore.getState().setPanel(null); }}>
        Upgrade ({next.cost} DP)
      </button>
    </div>
  );
}

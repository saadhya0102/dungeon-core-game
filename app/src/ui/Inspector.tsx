import { useState } from "react";
import { useStore } from "../state/store";
import { UNIT_BY_ID } from "../sim/content/units";
import { TRAP_BY_ID } from "../sim/content/traps";
import { spaceCost } from "../sim";
import type { GearItem, GearSlot } from "../sim/types";
import { abilityList } from "./abilityText";

const BANDS: [number, string][] = [[1.8, "S"], [1.5, "A"], [1.2, "B"], [1.0, "C"], [0.7, "D"], [0.4, "E"], [0.15, "F"]];
function band(mult: number): string {
  let best = "C";
  let diff = Infinity;
  for (const [v, l] of BANDS) { const d = Math.abs(v - mult); if (d < diff) { diff = d; best = l; } }
  return best;
}

export function Inspector() {
  const run = useStore((s) => s.run);
  const selection = useStore((s) => s.selection);
  const sellSelected = useStore((s) => s.sellSelected);
  const equip = useStore((s) => s.equip);
  const unequip = useStore((s) => s.unequip);
  const beginMove = useStore((s) => s.beginMove);
  const cancelMove = useStore((s) => s.cancelMove);
  const pendingMove = useStore((s) => s.pendingMove);
  const [equipSlot, setEquipSlot] = useState<GearSlot | null>(null);

  if (pendingMove) {
    return (
      <div className="inspector">
        <h3>Moving {pendingMove.kind}</h3>
        <div className="hint">Click any valid destination tile to place it there.</div>
        <button style={{ width: "100%" }} onClick={cancelMove}>Cancel move</button>
      </div>
    );
  }

  if (!run || !selection) return null;

  if (selection.kind === "core") {
    return (
      <div className="inspector">
        <h3>Dungeon Core</h3>
        <div className="row"><span>Level</span><b>{run.core.level}</b></div>
        <div className="row"><span>HP</span><b>{Math.ceil(run.core.hp)}/{run.core.maxHp}</b></div>
        <div className="hint">If the core dies, the run ends. Move it to reshape the route invaders must take.</div>
        <button style={{ width: "100%" }} onClick={beginMove}>Move Core</button>
      </div>
    );
  }

  if (selection.kind === "entrance") {
    return (
      <div className="inspector">
        <h3>Entrance Gate</h3>
        <div className="hint">Adventurers spawn here. No traps allowed nearby. Move it to design longer kill-corridors.</div>
        <button style={{ width: "100%" }} onClick={beginMove}>Move Gate</button>
      </div>
    );
  }

  if (selection.kind === "trap" && selection.id) {
    const trap = run.traps.find((t) => t.id === selection.id);
    const def = trap && TRAP_BY_ID[trap.defId];
    if (!def) return null;
    return (
      <div className="inspector">
        <h3>{def.name}</h3>
        <div className="row"><span>Tier</span><b>T{def.tier}</b></div>
        <div className="row"><span>Category</span><b>{def.category}</b></div>
        <div className="row"><span>Hidden rating</span><b>{def.hiddenRating}</b></div>
        <div className="row"><span>Trigger</span><b>{def.trigger}</b></div>
        <div className="row"><span>Charges</span><b>{def.charges}</b></div>
        {def.effect.damage ? <div className="row"><span>Damage</span><b>{def.effect.damage}</b></div> : null}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={{ flex: 1 }} onClick={beginMove}>Move</button>
          <button className="danger" style={{ flex: 1 }} onClick={sellSelected}>Sell</button>
        </div>
      </div>
    );
  }

  if (selection.kind === "unit" && selection.id) {
    const unit = run.units.find((u) => u.id === selection.id);
    const def = unit && UNIT_BY_ID[unit.defId];
    if (!unit || !def) return null;
    const s = def.stats;
    const acc = unit.gear.accessory ?? [];
    const validItems = (slot: GearSlot): GearItem[] =>
      run.inventory.filter((g) => g.slot === slot && g.tier <= def.tier + 1
        && g.id !== unit.gear.weapon && g.id !== unit.gear.armor && !acc.includes(g.id));

    return (
      <div className="inspector">
        <h3>{def.name} {unit.isTurret ? "(Turret)" : ""}</h3>
        <div className="small" style={{ textTransform: "capitalize" }}>{def.family} &middot; T{def.tier} &middot; {def.role} &middot; {spaceCost(def.tier)} space</div>
        <div className="row"><span>HP</span><b>{s.hp}</b></div>
        <div className="row"><span>Defense</span><b>{s.def}</b></div>
        {s.phys ? <div className="row"><span>Physical</span><b>{s.phys}</b></div> : null}
        {s.mag ? <div className="row"><span>Magic</span><b>{s.mag}</b></div> : null}
        {s.rng ? <div className="row"><span>Ranged</span><b>{s.rng}</b></div> : null}
        <div className="chips">
          {Object.entries(def.affinities).map(([k, v]) => (
            <span className="chip" key={k}>{k} {band(v as number)}</span>
          ))}
        </div>
        {abilityList(def.abilities).length > 0 && (
          <>
            <div className="section-title">Special Abilities</div>
            {abilityList(def.abilities).map((a, i) => (
              <div key={i} style={{ marginBottom: 3 }}>
                <b className="chip" style={{ color: "var(--accent)" }}>{a.name}</b>{" "}
                <span className="small">{a.desc}</span>
              </div>
            ))}
          </>
        )}

        <div className="section-title">Equipment</div>
        <EquipSlot label="Weapon" slot="weapon" itemId={unit.gear.weapon} run={run}
          onUnequip={() => unequip(unit.id, "weapon")} onEquipOpen={() => setEquipSlot("weapon")} />
        <EquipSlot label="Armor" slot="armor" itemId={unit.gear.armor} run={run}
          onUnequip={() => unequip(unit.id, "armor")} onEquipOpen={() => setEquipSlot("armor")} />
        {acc.map((id) => (
          <EquipSlot key={id} label="Accessory" slot="accessory" itemId={id} run={run}
            onUnequip={() => unequip(unit.id, "accessory", id)} onEquipOpen={() => setEquipSlot("accessory")} />
        ))}
        {(acc.length < (run.core.level >= 7 ? 3 : run.core.level >= 3 ? 2 : 1)) && (
          <button style={{ width: "100%", marginTop: 4 }} onClick={() => setEquipSlot("accessory")}>+ Accessory</button>
        )}

        {equipSlot && (
          <div style={{ marginTop: 8 }}>
            <div className="section-title">Equip {equipSlot}</div>
            {validItems(equipSlot).length === 0 && <div className="small">No suitable items</div>}
            {validItems(equipSlot).map((it) => (
              <button key={it.id} style={{ width: "100%", marginBottom: 3 }}
                className={`q-${it.quality}`}
                onClick={() => { equip(unit.id, it.id, equipSlot); setEquipSlot(null); }}>
                {it.name} (T{it.tier})
              </button>
            ))}
            <button className="small" style={{ width: "100%" }} onClick={() => setEquipSlot(null)}>Cancel</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={{ flex: 1 }} onClick={beginMove}>Move</button>
          <button className="danger" style={{ flex: 1 }} onClick={sellSelected}>Sell</button>
        </div>
      </div>
    );
  }

  return null;
}

function EquipSlot({ label, itemId, run, onUnequip, onEquipOpen }: {
  label: string; slot: GearSlot; itemId?: string; run: NonNullable<ReturnType<typeof useStore.getState>["run"]>;
  onUnequip: () => void; onEquipOpen: () => void;
}) {
  const item = itemId ? run.inventory.find((g) => g.id === itemId) : undefined;
  return (
    <div className="row" style={{ alignItems: "center" }}>
      <span>{label}</span>
      {item
        ? <span><b className={`q-${item.quality}`}>{item.name}</b> <button className="small" onClick={onUnequip}>x</button></span>
        : <button className="small" onClick={onEquipOpen}>equip</button>}
    </div>
  );
}

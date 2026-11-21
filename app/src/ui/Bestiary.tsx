import { useEffect, useState } from "react";
import { CLASSES, CLASS_BY_ID, UNIQUES, championAbilities } from "../sim/content/enemies";
import { UNITS } from "../sim/content/units";
import { abilityVisual } from "../game/art/abilityVisuals";
import type { CharacterClip } from "../game/art/pixels";
import { abilityInfo } from "./abilityText";
import { AnimatedCharacter } from "./AnimatedCharacter";

const GROUPS = ["Monsters", "Adventurers", "Champions"] as const;
type Group = typeof GROUPS[number];
const ENTRIES = {
  Monsters: UNITS.map((unit) => ({
    id: unit.id, name: unit.name, detail: `Tier ${unit.tier} · ${unit.family} · ${unit.role}`,
    abilities: unit.abilities ?? [], flavor: unit.notes,
  })),
  Adventurers: CLASSES.map((hero) => ({
    id: hero.id, name: hero.name, detail: `Tier ${hero.tier} · ${hero.archetype}`,
    abilities: hero.abilities ?? [], flavor: undefined,
  })),
  Champions: UNIQUES.map((hero) => ({
    id: hero.id, name: hero.name, detail: `Champion · ${CLASS_BY_ID[hero.baseClassId]?.archetype ?? "adventurer"}`,
    abilities: championAbilities(hero), flavor: hero.flavor,
  })),
};

const CLIPS: [CharacterClip, string][] = [
  ["idle", "Idle"], ["walk", "Move"], ["attack", "Attack"], ["ability", "Ability"], ["hit", "Hit"], ["defeat", "Defeat"],
];

export function Bestiary({ onClose }: { onClose: () => void }) {
  const [group, setGroup] = useState<Group>("Monsters");
  const [id, setId] = useState(ENTRIES.Monsters[0].id);
  const [clip, setClip] = useState<CharacterClip>("walk");
  const [effect, setEffect] = useState("");
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  const entries = ENTRIES[group];
  const entry = entries.find((candidate) => candidate.id === id) ?? entries[0];
  const effects = [...new Set(entry.abilities.map((ability) => ability.effect))];
  const activeEffect = effects.find((candidate) => candidate === effect) ?? effects[0];
  const activeClip = clip === "ability" && !activeEffect ? "attack" : clip;
  const visual = activeClip === "ability" ? abilityVisual(activeEffect) : undefined;

  return (
    <div className="panel-modal" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel bestiary" role="dialog" aria-modal="true" aria-labelledby="bestiary-title">
        <header><h2 id="bestiary-title">Bestiary</h2><button autoFocus onClick={onClose}>Close</button></header>
        <div className="tabs" aria-label="Character group">
          {GROUPS.map((category) => <button key={category} className={category === group ? "active" : ""} aria-pressed={category === group}
            onClick={() => { setGroup(category); setId(ENTRIES[category][0].id); setEffect(""); }}>{category}</button>)}
        </div>
        <div className="bestiary-layout">
          <div className="bestiary-stage" style={visual ? { color: `#${visual.color.toString(16).padStart(6, "0")}` } : undefined}>
            <AnimatedCharacter key={`${entry.id}:${activeClip}:${activeEffect}`} id={entry.id} clip={activeClip} label={entry.name} />
            {visual && <i aria-hidden="true" className={`bestiary-effect bestiary-${visual.pattern}`} key={activeEffect} />}
          </div>
          <div>
            <label htmlFor="bestiary-character">Character</label>
            <select id="bestiary-character" value={entry.id} onChange={(event) => { setId(event.target.value); setEffect(""); }}>
              {entries.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
            <h3>{entry.name}</h3>
            <small>{entry.detail}</small>
            {entry.flavor && <p>{entry.flavor}</p>}
            <div className="tabs bestiary-clips" aria-label="Animation">
              {CLIPS.map(([key, label]) => <button key={key} className={activeClip === key ? "active" : ""}
                disabled={key === "ability" && !effects.length} aria-pressed={activeClip === key} onClick={() => setClip(key)}>{label}</button>)}
            </div>
            {!!effects.length && <div className="bestiary-abilities">
              {effects.map((ability) => <button key={ability} className={activeClip === "ability" && activeEffect === ability ? "active" : ""}
                aria-pressed={activeClip === "ability" && activeEffect === ability}
                onClick={() => { setEffect(ability); setClip("ability"); }}>{abilityInfo(ability).name}</button>)}
            </div>}
            {activeClip === "ability" && activeEffect && <p className="hint">{abilityInfo(activeEffect).desc}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

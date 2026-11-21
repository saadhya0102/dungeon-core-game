import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import strongholdArt from "../assets/monster-stronghold.webp";
import { AnimatedCharacter } from "./AnimatedCharacter";
import { BUILDINGS, MAX_BUILDING_LEVEL, buildingCost } from "../sim/kingdom";
import type { BuildingId, Stronghold } from "../sim/kingdom";

const WIDTH = 1536;
const HEIGHT = 1024;
type Site = { x: number; y: number; size: number; note: string };
const LANDMARKS: Record<BuildingId, Site> = {
  barracks: { x: 240, y: 141, size: 195, note: "Bone-armored recruits drill at the gate before joining the watch." },
  range: { x: 485, y: 153, size: 143, note: "Goblin slingers practice on bundles of stolen straw." },
  spire: { x: 868, y: 132, size: 181, note: "The hexkeepers draw spellfire from veins of violet crystal." },
  bastion: { x: 1324, y: 103, size: 223, note: "The strongest hides and shells train to hold the cavern gate." },
  reliquary: { x: 817, y: 423, size: 125, note: "Monsters stop here to tend the fragments of the old core." },
  quarry: { x: 814, y: 797, size: 213, note: "Stonebreakers cut the blocks that make new chambers affordable." },
  goblinoid: { x: 376, y: 503, size: 196, note: "The warren keeps its kitchens, bunks, and spear racks under the same mushroom roofs." },
  undead: { x: 1377, y: 308, size: 201, note: "Skeletons piece together fresh armor in the shadows of the crypt." },
  beast: { x: 1343, y: 795, size: 216, note: "Night beasts rest beneath the antler gate between hunts." },
  demon: { x: 193, y: 747, size: 187, note: "Demon smiths work the lava-fed hearth around the clock." },
  construct: { x: 1328, y: 536, size: 221, note: "Golems haul replacement joints and wind up the ore lifts." },
  aberration: { x: 169, y: 329, size: 201, note: "The old eye watches the alley from above the shrine stairs." },
};

const WALKERS = [
  { sprite: 0, route: "M 85 994 Q 161 902 242 883 Q 310 852 369 832 Q 416 817 413 749 Q 435 697 536 656", duration: 23 },
  { sprite: 1, route: "M 1206 278 Q 1119 295 1077 341 Q 1046 383 1042 400 Q 1010 416 973 425", duration: 20, westbound: true },
  { sprite: 2, route: "M 1407 902 Q 1355 878 1291 889 Q 1230 906 1178 908 Q 1136 910 1092 924", duration: 19, westbound: true },
  { sprite: 3, route: "M 461 692 Q 523 663 597 639 Q 671 616 675 577 Q 668 550 621 533", duration: 21 },
  { sprite: 4, route: "M 1271 610 Q 1168 598 1113 628 Q 1075 648 1046 673 Q 1027 649 1006 619", duration: 24, westbound: true },
  { sprite: 5, route: "M 228 390 Q 260 419 238 455 Q 216 494 184 518 Q 202 544 246 552", duration: 26 },
  { sprite: 0, route: "M 249 194 Q 335 245 422 262 Q 496 265 526 292 Q 558 316 593 374", duration: 21 },
  { sprite: 1, route: "M 636 534 Q 708 521 769 503 Q 823 524 885 503 Q 938 477 955 455", duration: 16 },
  { sprite: 4, route: "M 664 911 Q 745 950 816 953 Q 887 947 964 932 Q 997 922 1016 876", duration: 25 },
];

const RESIDENTS = ["gob_grunt", "und_skeleton", "bst_direwolf", "dem_imp", "con_animarmor", "abr_gazer"];

const WORKERS = [
  { id: "gob_archer", site: "range", dx: -28, dy: 28, task: "archery", clip: "attack" },
  { id: "orc_shaman", site: "spire", dx: -52, dy: 73, task: "spell", clip: "ability" },
  { id: "con_stonegolem", site: "quarry", dx: 76, dy: 64, task: "hammer", clip: "attack" },
  { id: "dem_infernal", site: "demon", dx: 51, dy: 59, task: "hammer", clip: "attack" },
  { id: "con_irongolem", site: "construct", dx: -76, dy: 82, task: "gear", clip: "attack" },
  { id: "und_skel_archer", site: "undead", dx: -27, dy: 67, task: "idle", clip: "idle" },
  { id: "bst_direwolf", site: "beast", dx: -63, dy: 58, task: "idle", clip: "idle" },
] as const;

const CONTROLS: Record<string, readonly [number, number]> = {
  w: [0, -1], arrowup: [0, -1], a: [-1, 0], arrowleft: [-1, 0],
  s: [0, 1], arrowdown: [0, 1], d: [1, 0], arrowright: [1, 0],
};

export function StrongholdScene({ base, loading, buying, error, onUpgrade, modalOpen, launch }: {
  base: Stronghold; loading: boolean; buying: boolean; error: string; onUpgrade: (id: BuildingId) => void; modalOpen: boolean;
  launch?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const camera = useRef({ x: WIDTH / 2, y: HEIGHT / 2, scale: 1, width: 0, height: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const building = BUILDINGS.find((entry) => entry.id === selected);
  const level = building ? base.levels[building.id] ?? 0 : 0;
  const cost = buildingCost(level);

  function paint() {
    const c = camera.current;
    const halfX = c.width / (2 * c.scale);
    const halfY = c.height / (2 * c.scale);
    c.x = Math.max(halfX, Math.min(WIDTH - halfX, c.x));
    c.y = Math.max(halfY, Math.min(HEIGHT - halfY, c.y));
    world.current?.style.setProperty("transform", `translate3d(${c.width / 2 - c.x * c.scale}px,${c.height / 2 - c.y * c.scale}px,0) scale(${c.scale})`);
  }

  useEffect(() => {
    const area = viewport.current;
    if (!area) return;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const c = camera.current;
      c.width = width;
      c.height = height;
      c.scale = Math.max(0.72, width / (WIDTH * 0.84), height / (HEIGHT * 0.81));
      paint();
    });
    resize.observe(area);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    if (modalOpen) return;
    const keys = new Set<string>();
    let frame = 0;
    let previous: number | undefined;
    function move(time: number) {
      frame = 0;
      if (!keys.size) { previous = undefined; return; }
      let x = 0, y = 0;
      for (const key of keys) { x += CONTROLS[key][0]; y += CONTROLS[key][1]; }
      if (x || y) {
        const c = camera.current;
        const distance = Math.min(32, time - (previous ?? time)) * 0.47 / c.scale / Math.hypot(x, y);
        c.x += x * distance;
        c.y += y * distance;
        paint();
      }
      previous = time;
      frame = requestAnimationFrame(move);
    }
    function keydown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "escape") { setSelected(null); return; }
      if (!Object.hasOwn(CONTROLS, key) || event.altKey || event.ctrlKey || event.metaKey ||
        (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]"))) return;
      event.preventDefault();
      keys.add(key);
      if (!frame) frame = requestAnimationFrame(move);
    }
    function keyup(event: KeyboardEvent) { keys.delete(event.key.toLowerCase()); }
    function clear() { keys.clear(); }
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      cancelAnimationFrame(frame);
    };
  }, [modalOpen]);

  function center(id: BuildingId) {
    Object.assign(camera.current, { x: LANDMARKS[id].x, y: LANDMARKS[id].y });
    paint();
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pan(event: PointerEvent<HTMLDivElement>) {
    const last = drag.current;
    if (!last || last.id !== event.pointerId) return;
    const c = camera.current;
    c.x += (last.x - event.clientX) / c.scale;
    c.y += (last.y - event.clientY) / c.scale;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    paint();
  }

  return (
    <section className="stronghold-scene" aria-label="Stronghold settlement">
      <div className="stronghold-viewport" ref={viewport} onPointerDown={startDrag} onPointerMove={pan}
        onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <div className="stronghold-world" ref={world} style={{ width: WIDTH, height: HEIGHT }}>
          <img className="stronghold-art" src={strongholdArt} alt="A monster settlement spread across winding cavern streets" draggable={false} />
          <div className="stronghold-residents" aria-hidden="true">
            {WALKERS.map((actor, index) => <div key={actor.route} className="street-walker"
              style={{ offsetPath: `path("${actor.route}")`, "--route-time": `${actor.duration}s`, "--delay": `-${index * 3.1}s`,
                "--face-start": actor.westbound ? -1 : 1, "--face-return": actor.westbound ? 1 : -1 } as CSSProperties}>
              <div className="town-actor"><AnimatedCharacter id={RESIDENTS[actor.sprite]} clip="walk" /></div>
            </div>)}
            {WORKERS.map((worker, index) => {
              const { x, y } = LANDMARKS[worker.site];
              return <div key={worker.site} className={`town-worker task-${worker.task}`}
                style={{ left: x + worker.dx, top: y + worker.dy, "--delay": `-${index * 0.61}s` } as CSSProperties}>
                <div className="town-actor"><AnimatedCharacter id={worker.id} clip={worker.clip} period={2.4} delay={-index * 0.61} /></div><i />
              </div>;
            })}
          </div>
          {BUILDINGS.map(({ id, name }) => {
            const site = LANDMARKS[id];
            const rank = base.levels[id] ?? 0;
            return <button key={id} style={{ left: site.x, top: site.y, width: site.size, height: site.size * 0.69 }}
              className={`stronghold-landmark${selected === id ? " selected" : ""}`} aria-label={`${name}, level ${rank}`}
              aria-pressed={selected === id} onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) center(id); }}
              onClick={() => setSelected(id)}>
              <span><i aria-hidden="true" />{name}{rank > 0 && <b>{rank}</b>}</span>
            </button>;
          })}
        </div>
      </div>
      <div className="stronghold-hud">
        <div className="stronghold-heading"><h1>The Stronghold</h1><p>Pan with WASD, arrow keys, or drag.</p></div>
        <label className="stronghold-find">
          <span className="visually-hidden">Find a building</span>
          <select aria-label="Find a building" value={selected ?? ""} onChange={(event) => {
            const id = BUILDINGS.find((entry) => entry.id === event.target.value)?.id ?? null;
            setSelected(id);
            if (id) center(id);
          }}>
            <option value="">Find a building</option>
            {BUILDINGS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {error && <p className="kingdom-error stronghold-error" role="alert">{error}</p>}
      </div>
      {launch}
      {building && <aside className="stronghold-details" aria-label={building.name}>
        <button className="stronghold-close" aria-label="Close building details" onClick={() => setSelected(null)}>×</button>
        <h2>{building.name}</h2>
        <p>{LANDMARKS[building.id].note}</p>
        <div className="stronghold-level"><span>Level {level} / {MAX_BUILDING_LEVEL}</span><b>{building.effect} per level</b></div>
        <button className="primary" onClick={() => onUpgrade(building.id)}
          disabled={loading || buying || level >= MAX_BUILDING_LEVEL || base.shards < cost}>
          {level >= MAX_BUILDING_LEVEL ? "Fully upgraded" : buying ? "Upgrading…" : `Upgrade · ${cost} shards`}
        </button>
      </aside>}
    </section>
  );
}

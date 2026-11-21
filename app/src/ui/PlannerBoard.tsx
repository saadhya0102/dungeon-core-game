import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { TRAP_BY_ID, UNIT_BY_ID, key } from "../sim";
import type { RunState } from "../sim/types";
import { AnimatedCharacter } from "./AnimatedCharacter";

export function PlannerBoard({ run, onTile, onHover, active = true, label, centerKey = 0 }: {
  run: RunState; onTile?: (x: number, y: number) => void; onHover?: (x: number, y: number) => void; active?: boolean;
  label?: string; centerKey?: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(run.map.core);
  const [hover, setHover] = useState("");
  const coords = Object.keys(run.map.tiles).map((value) => value.split(",").map(Number));
  const minX = Math.max(0, Math.min(run.map.core.x, ...coords.map(([x]) => x)) - 4);
  const minY = Math.max(0, Math.min(run.map.core.y, ...coords.map(([, y]) => y)) - 4);
  const maxX = Math.min(run.map.width - 1, Math.max(run.map.core.x, ...coords.map(([x]) => x)) + 4);
  const maxY = Math.min(run.map.height - 1, Math.max(run.map.core.y, ...coords.map(([, y]) => y)) + 4);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const units = new Map(run.units.map((unit) => [unit.id, unit.defId]));
  const traps = new Map(run.traps.map((trap) => [trap.id, trap.defId]));
  const currentX = Math.max(minX, Math.min(maxX, focus.x));
  const currentY = Math.max(minY, Math.min(maxY, focus.y));

  useEffect(() => {
    const core = grid.current?.querySelector<HTMLElement>('[data-core="true"]');
    const view = viewport.current;
    if (core && view) {
      view.scrollTo(core.offsetLeft + (grid.current?.offsetLeft ?? 0) - view.clientWidth / 2 + core.offsetWidth / 2,
        core.offsetTop + (grid.current?.offsetTop ?? 0) - view.clientHeight / 2 + core.offsetHeight / 2);
    }
  }, [run.id, centerKey]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, x: number, y: number) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    grid.current?.querySelector<HTMLButtonElement>(`[data-cell="${key(x + direction[0], y + direction[1])}"]`)?.focus();
  }

  return (
    <div className="planner-viewport" ref={viewport} aria-label={label ?? "Dungeon planning board"}>
      <div className="planner-grid" ref={grid} style={{ "--planner-columns": width } as CSSProperties}>
        {Array.from({ length: width * height }, (_, index) => {
          const x = minX + index % width, y = minY + Math.floor(index / width);
          const id = key(x, y);
          const tile = run.map.tiles[id];
          const unit = tile?.unitId && units.get(tile.unitId);
          const trap = tile?.trapId && traps.get(tile.trapId);
          const state = tile?.state ?? "stone";
          const name = unit ? UNIT_BY_ID[unit]?.name : trap ? TRAP_BY_ID[trap]?.name
            : state === "core" ? "Core" : state === "entrance" ? "Entrance" : state === "floor" ? "Open floor" : "Stone";
          const appearance = unit || (state === "core" ? "core" : undefined);
          const content = appearance ? <AnimatedCharacter id={appearance} /> : trap ? <i aria-hidden="true" /> : null;
          const className = `planner-cell tile-${state}${hover === id ? " highlighted" : ""}`;
          if (!onTile || !active) return <div key={id} className={className} data-core={state === "core"} title={name || undefined}>{content}</div>;
          return <button key={id} className={className} data-core={state === "core"} data-cell={id}
            type="button" tabIndex={x === currentX && y === currentY ? 0 : -1}
            aria-label={`${name}, ${x}, ${y}`} onKeyDown={(event) => navigate(event, x, y)}
            onFocus={() => { setFocus({ x, y }); setHover(id); onHover?.(x, y); }}
            onPointerEnter={() => { setHover(id); onHover?.(x, y); }} onClick={() => onTile(x, y)}>{content}</button>;
        })}
      </div>
    </div>
  );
}

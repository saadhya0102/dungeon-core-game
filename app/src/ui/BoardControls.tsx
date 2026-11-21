import { useStore } from "../state/store";
import { buildOrder } from "./buildFeedback";
import { currencyLabel } from "../sim";

export function BoardControls({ onCenter, onZoom, onHelp, fallback }: {
  onCenter: () => void; onZoom: (factor: number) => void; onHelp: () => void; fallback: boolean;
}) {
  const run = useStore((state) => state.run);
  const tool = useStore((state) => state.tool);
  const defId = useStore((state) => state.buyDefId);
  const turret = useStore((state) => state.turretMode);
  const hover = useStore((state) => state.hover);
  const phase = useStore((state) => state.phase);
  const order = run && phase === "build" ? buildOrder(run, tool, defId, turret) : null;
  const denial = order && hover?.x != null && hover?.y != null ? order.check(hover.x, hover.y) : null;

  return (
    <div className="board-utility">
      {order && run && <div className={`placement-status${denial ? " blocked" : ""}`}>
        <b>{order.name}</b><span>{denial ?? `${order.price} ${currencyLabel(run)} · Choose a tile`}</span>
      </div>}
      <div className="board-camera" aria-label="Board controls">
        {!fallback && <><button title="Zoom out" aria-label="Zoom out" onClick={() => onZoom(1 / 1.2)}>−</button>
          <button title="Zoom in" aria-label="Zoom in" onClick={() => onZoom(1.2)}>+</button></>}
        <button onClick={onCenter} title="Center on the Core (F)">Center</button>
        <button onClick={onHelp} title="Keyboard controls (?)" aria-label="Show keyboard controls">?</button>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  ["1", "Inspect"], ["2", "Dig"], ["3", "Buy room"], ["4", "Recruit monsters"], ["5", "Place traps"], ["6", "Research"],
  ["B", "Repeat last unit or trap"], ["Ctrl+Z", "Undo build change"], ["Ctrl+Y", "Redo build change"],
  ["F", "Center on the Core"], ["Space", "Pause or resume a replay"], ["Esc", "Close a panel or cancel the active tool"],
  ["Right-click", "Cancel the active tool on the board"],
];

export function ControlHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel-modal" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel shortcut-panel" role="dialog" aria-modal="true" aria-labelledby="controls-title">
        <header><h2 id="controls-title">Controls</h2><button autoFocus onClick={onClose}>Close</button></header>
        <dl>{SHORTCUTS.map(([keys, description]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{description}</dd></div>)}</dl>
      </section>
    </div>
  );
}

import { useStore } from "../state/store";
import { clUpgradeCost, currencyLabel, dungeonPrice, roomCost } from "../sim";

export function BuildBar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const setPanel = useStore((s) => s.setPanel);
  const saveCurrentDungeon = useStore((s) => s.saveCurrentDungeon);
  const repeatOrder = useStore((s) => s.repeatOrder);
  const lastOrder = useStore((s) => s.lastOrder);
  const undo = useStore((s) => s.undoBuild);
  const redo = useStore((s) => s.redoBuild);
  const canUndo = useStore((s) => s.undoStack.length > 0);
  const canRedo = useStore((s) => s.redoStack.length > 0);
  const run = useStore((s) => s.run);
  if (!run) return null;
  const nextCost = run.core.level < 20 ? dungeonPrice(run, clUpgradeCost(run.core.level)) : null;

  return (
    <nav className="buildbar" aria-label="Dungeon build tools">
      <div className="buildbar-title">Dungeon tools</div>
      <button className={tool === "select" ? "active" : ""} aria-pressed={tool === "select"} onClick={() => setTool("select")}><kbd>1</kbd><span>Inspect</span></button>
      {run.swiftRule !== "oneRoom" && <>
        <button className={tool === "dig" ? "active" : ""} aria-pressed={tool === "dig"} onClick={() => setTool("dig")}><kbd>2</kbd><span>Dig tiles</span></button>
        <button className={tool === "room" ? "active" : ""} aria-pressed={tool === "room"} title="Excavate 25 tiles for the price of 15"
          onClick={() => setTool("room")}><kbd>3</kbd><span>5×5 room<small>{roomCost(run)} {currencyLabel(run)}</small></span></button>
      </>}
      {run.swiftRule !== "noUnits" && <button onClick={() => setPanel("units")}><kbd>4</kbd><span>Recruit</span></button>}
      {run.swiftRule !== "unitsOnly" && <button onClick={() => setPanel("traps")}><kbd>5</kbd><span>Traps</span></button>}
      <button onClick={() => setPanel("research")}><kbd>6</kbd><span>Research</span></button>
      <button onClick={() => setPanel("shop")} disabled={run.core.level < 3} title={run.core.level < 3 ? "Unlocks at Core Level 3" : undefined}>Gear shop</button>
      <button onClick={() => setPanel("core")} disabled={!nextCost}>
        <span>Upgrade Core{nextCost != null && <small>{nextCost} {currencyLabel(run)}</small>}</span>
      </button>
      {lastOrder && <button onClick={repeatOrder} title="Repeat last unit or trap"><kbd>B</kbd><span>Repeat order</span></button>}
      <div className="build-history" aria-label="Edit history">
        <button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      </div>
      {!run.idle && <button className="snapshot-button" onClick={saveCurrentDungeon} title="Save a copy for Snapshot H2H">Save snapshot</button>}
    </nav>
  );
}

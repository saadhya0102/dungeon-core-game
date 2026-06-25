import { useStore } from "../state/store";
import { clUpgradeCost } from "../sim";

export function BuildBar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const setPanel = useStore((s) => s.setPanel);
  const saveCurrentDungeon = useStore((s) => s.saveCurrentDungeon);
  const run = useStore((s) => s.run);
  if (!run) return null;
  const nextCost = run.core.level < 20 ? clUpgradeCost(run.core.level) : null;

  return (
    <div className="buildbar">
      <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}>Select</button>
      <button className={tool === "dig" ? "active" : ""} onClick={() => setTool("dig")}>Dig (pickaxe)</button>
      <button onClick={() => setPanel("units")}>Units</button>
      <button onClick={() => setPanel("traps")}>Traps</button>
      <button onClick={() => setPanel("research")}>Research</button>
      <button onClick={() => setPanel("shop")} disabled={run.core.level < 3}>Gear Shop</button>
      <button onClick={() => setPanel("core")} disabled={!nextCost}>
        Core Up{nextCost ? ` (${nextCost})` : ""}
      </button>
      <button onClick={() => saveCurrentDungeon()} title="Save this dungeon as a snapshot you can manage in Saved Dungeons">Save Dungeon</button>
    </div>
  );
}

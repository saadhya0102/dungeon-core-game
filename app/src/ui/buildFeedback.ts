import { buyRoom, digTile, dungeonPrice, placeTrap, placeUnit, recruitPrice, roomCost, tileCost, TRAP_BY_ID, UNIT_BY_ID } from "../sim";
import type { RunState } from "../sim/types";
import type { Tool } from "../state/store";

interface BuildOrder {
  name: string;
  price: number;
  check: (x: number, y: number) => string | null;
}

export function buildOrder(run: RunState, tool: Tool, defId: string | null, turret: boolean): BuildOrder | null {
  if (tool === "dig") return { name: "Excavate tile", price: tileCost(run), check: (x, y) => digTile(run, x, y, true) };
  if (tool === "room") return { name: "Excavate 5×5 room", price: roomCost(run), check: (x, y) => buyRoom(run, x, y, true) };
  if (tool === "placeUnit" && defId) {
    const def = UNIT_BY_ID[defId];
    if (def) return { name: def.name, price: recruitPrice(run, def, turret), check: (x, y) => placeUnit(run, defId, x, y, turret, true) };
  }
  if (tool === "placeTrap" && defId) {
    const def = TRAP_BY_ID[defId];
    if (def) return { name: def.name, price: dungeonPrice(run, def.cost), check: (x, y) => placeTrap(run, defId, x, y, true) };
  }
  return null;
}

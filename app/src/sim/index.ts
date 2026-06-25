// ============================================================================
// Sim public API (shared by client + future server). Pure, deterministic.
// ============================================================================
export * from "./types";
export * from "./config";
export * from "./rng";
export * from "./power";
export * from "./economy";
export * from "./maputil";
export * from "./wavegen";
export * from "./factory";
export * from "./content";
export { resolveWave } from "./resolve";
export {
  resolveH2HMatch, resolveH2HRound, buildSharedWave, frozenToRun,
} from "./h2h";
export type { H2HMatchResult, H2HRoundResult, H2HExtraBuy } from "./h2h";
export { applyWaveResult, capForRun } from "./progress";
export type { WaveApplyResult } from "./progress";
export {
  computeResearchMods, buildDungeonEntities, buildInvaderEntities, gearItemsFor,
} from "./combat";
export type { ResearchMods } from "./combat";
export {
  capacityMax, capacityUsed, unlockedUnits,
  digTile, collapseTile, placeUnit, moveUnit, sellUnit,
  placeTrap, sellTrap, moveTrap, moveCore, equipGear, unequipGear, salvageGear,
  buyGear, rerollGearShop, generateShopStock, buyResearch, upgradeCore, moveEntrance,
} from "./actions";
export type { ActionResult } from "./actions";

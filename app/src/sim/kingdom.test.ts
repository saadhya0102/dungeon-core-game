import { describe, expect, it } from "vitest";
import { buyRoom, collapseTile, digTile, placeUnit, roomCost } from "./actions";
import { monsterStats } from "./combat";
import { UNITS, UNIT_BY_ID } from "./content/units";
import { createNewRun } from "./factory";
import { CAMPAIGN, CAMPAIGN_REGIONS, cityUnlocked, clearCity, createCampaignRun, emptyStronghold, upgradeBuilding } from "./kingdom";
import { applyWaveResult } from "./progress";
import { resolveWave } from "./resolve";
import { lateWaveScale } from "./wavegen";
import { applyDuelAction, newDuelPlayer, sendDelayMs, settleDuelRound } from "./duel";
import type { DuelRoom } from "./duel";

describe("room excavation and Swift rules", () => {
  it("excavates a connected room for the price of 15 tiles without partial purchases", () => {
    const room = createNewRun("keeper", [], 1);
    room.dp = 250;
    const tiles = structuredClone(room);
    const price = roomCost(room);
    expect(buyRoom(room, 36, 30)).toMatch(/edge/);
    expect(room.map.openedCount).toBe(25);
    expect(room.dp).toBe(tiles.dp);
    tiles.dp = 1_000;
    for (let x = 33; x < 48; x++) {
      expect(digTile(tiles, x, 30)).toBeNull();
    }
    expect(tiles.stats.dpSpent).toBe(price);
    expect(buyRoom(room, 35, 30)).toBeNull();
    expect(room.map.openedCount).toBe(50);
    expect(room.dp).toBe(250 - price);
    expect(buyRoom(room, 40, 30)).toMatch(/core/);
  });

  it("locks a single faction after the first recruit and fixes the one-room floor plan", () => {
    const single = createNewRun("keeper", [], 1, "singleFaction");
    expect(placeUnit(single, "gob_grunt", 29, 30)).toBeNull();
    const undead = UNITS.find((unit) => unit.family === "undead" && unit.tier === 1)!;
    expect(placeUnit(single, undead.id, 29, 29)).toMatch(/banned/);
    const fixed = createNewRun("keeper", [], 1, "oneRoom");
    expect(fixed.map.openedCount).toBe(100);
    expect(digTile(fixed, 35, 30)).toMatch(/fixed/);
    expect(buyRoom(fixed, 37, 30)).toMatch(/fixed/);
    expect(collapseTile(fixed, 29, 29)).toMatch(/fixed/);
  });
});

describe("campaign and the Stronghold", () => {
  it("keeps each region at twelve stops, and honors existing city clears and saved runs", () => {
    expect(CAMPAIGN_REGIONS.map(({ start, end }) => CAMPAIGN.slice(start, end).length)).toEqual([12, 12]);
    const legacy = { ...emptyStronghold(), cleared: ["mossgate", "drowned-arch"] };
    expect(cityUnlocked(legacy, "drowned-arch")).toBe(true);
    expect(createCampaignRun("keeper", "drowned-arch", legacy)?.rngSeedRoot).toBe(3196);
    expect(cityUnlocked(legacy, "frost-citadel")).toBe(false);
    expect(clearCity(legacy, "ash-chapel", true).cleared).toContain("ash-chapel");
    expect(cityUnlocked({ ...legacy, cleared: ["frost-citadel"] }, "slate-gate")).toBe(true);
  });
  it("clears the two-wave first city, unlocks the next city, and pays once", () => {
    const base = emptyStronghold();
    expect(createCampaignRun("keeper", CAMPAIGN[1].id, base)).toBeNull();
    const city = CAMPAIGN[0];
    const run = createCampaignRun("keeper", city.id, base)!;
    expect(placeUnit(run, "gob_grunt", 30, 31)).toBeNull();
    expect(placeUnit(run, "gob_grunt", 31, 30)).toBeNull();
    for (let index = 0; index < city.waves; index++) {
      const timeline = resolveWave(run);
      expect(timeline.outcome.coreSurvived).toBe(true);
      applyWaveResult(run, timeline);
    }
    expect(run.stats.wavesCleared).toBe(2);
    const cleared = clearCity(base, city.id);
    expect(cleared.shards).toBe(city.shards);
    expect(clearCity(cleared, city.id)).toBe(cleared);
    const upgraded = upgradeBuilding(cleared, "goblinoid")!;
    const next = createCampaignRun("keeper", CAMPAIGN[1].id, upgraded)!;
    expect(monsterStats(next, UNIT_BY_ID.gob_grunt).hp).toBeGreaterThan(monsterStats(run, UNIT_BY_ID.gob_grunt).hp);
    expect(lateWaveScale(20)).toBe(1);
    expect(lateWaveScale(40) - lateWaveScale(30)).toBeGreaterThan(lateWaveScale(30) - lateWaveScale(20));
  });
});

describe("live duel combat", () => {
  it("queues a leveled up monster only after the send window, then spawns it on the rival board", () => {
    const seed = 50;
    const a = newDuelPlayer("a", seed, { goblinoid: 2, reliquary: 1 });
    const b = newDuelPlayer("b", seed);
    const unit = UNIT_BY_ID.gob_grunt;
    const send = { type: "send", id: unit.id } as const;
    expect(applyDuelAction(a, send, sendDelayMs(unit) - 1)).toMatch(/unlocked/);
    expect(applyDuelAction(a, { type: "rank", id: unit.id }, 0)).toBeNull();
    expect(applyDuelAction(a, send, sendDelayMs(unit))).toBeNull();
    expect(applyDuelAction(a, send, sendDelayMs(unit))).toBeNull();
    const upgraded = monsterStats(a.run, unit);
    const room: DuelRoom = { id: "1", seed, uids: ["a", "b"], players: { a, b },
      status: "playing", buildAt: 0, deadline: 10_000, wave: 1, lastRound: 0, winner: null };
    const round = settleDuelRound(room);
    const sends = round.waves.b.invaders.slice(-2);
    expect(round.waves.a.invaders).toHaveLength(1);
    expect(sends.map((send) => send.monster?.spawnTick)).toEqual([20, 40]);
    expect(sends[0].monster?.stats).toEqual(upgraded);
    const timeline = resolveWave(round.boards.b, round.waves.b);
    const spawn = timeline.events.find((event) => event.type === "spawn" && event.sourceId === sends[1].id);
    expect(spawn?.tick).toBe(40);
    expect(timeline.events.every((event, index, events) => index === 0 || event.tick >= events[index - 1].tick)).toBe(true);
    expect(room.players.a.sends).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buyRoom, collapseTile, digTile, moveUnit, placeTrap, placeUnit, roomCost, sellTrap, sellUnit } from "./actions";
import { dungeonPrice } from "./economy";
import { advanceIdle, createIdleRun, IDLE_INTERVAL_MS, idleWave, promoteIdle } from "./idle";

function readyPatrol() {
  const run = createIdleRun("keeper", 19);
  for (const [x, y] of [[31, 30], [30, 31], [30, 29], [29, 30]]) {
    expect(placeUnit(run, "gob_grunt", x, y)).toBeNull();
  }
  run.idle!.nextAt = IDLE_INTERVAL_MS;
  return run;
}

describe("idle patrols", () => {
  it("matches stepping every wave when crediting a long absence", () => {
    const offline = readyPatrol();
    const online = structuredClone(offline);
    const waves = 36;
    for (let index = 1; index <= waves; index++) {
      expect(advanceIdle(online, index * IDLE_INTERVAL_MS).report.waves).toBe(1);
    }
    const { report } = advanceIdle(offline, waves * IDLE_INTERVAL_MS);
    expect(report).toEqual({ waves, wins: waves, kills: waves, embers: 7 * waves });
    expect(offline).toEqual(online);
    expect(advanceIdle(offline, waves * IDLE_INTERVAL_MS + 500).report.waves).toBe(0);
  });

  it("banks all unattended waves even when no defense wins, and credits only when active", () => {
    const run = createIdleRun("keeper", 3);
    const waves = 86_400;
    expect(advanceIdle(run, waves * IDLE_INTERVAL_MS).report.waves).toBe(0);
    run.idle!.nextAt = IDLE_INTERVAL_MS;
    run.wave = 3;
    const { report } = advanceIdle(run, waves * IDLE_INTERVAL_MS);
    expect(report).toEqual({ waves, wins: 0, kills: 0, embers: waves * 2 });
    expect(run.idle!.nextAt).toBe((waves + 1) * IDLE_INTERVAL_MS);
    expect(run.wave).toBe(1);
    expect(run.idle!.streak).toBe(0);
  });

  it("requires three wins before a voluntary promotion and resets the streak afterward", () => {
    const run = readyPatrol();
    const first = advanceIdle(run, IDLE_INTERVAL_MS, true);
    expect(first.timeline?.frames.length).toBeGreaterThan(0);
    expect(first.report.wins).toBe(1);
    expect(promoteIdle(run)).toBe(false);
    advanceIdle(run, 3 * IDLE_INTERVAL_MS);
    expect(run.wave).toBe(1);
    expect(promoteIdle(run)).toBe(true);
    expect(run.wave).toBe(2);
    expect(run.idle!.streak).toBe(0);
    expect(promoteIdle(run)).toBe(false);
  });

  it("adds more attackers on 5, 10, 25, and 50 milestone difficulties", () => {
    const run = createIdleRun("keeper", 2);
    for (const difficulty of [5, 10, 25, 50]) {
      run.wave = difficulty - 1;
      const previous = idleWave(run).invaders.length;
      run.wave = difficulty;
      expect(idleWave(run).invaders.length).toBeGreaterThan(previous);
    }
  });
});

describe("idle construction", () => {
  it("tracks actual costs when removing earlier purchases", () => {
    const run = createIdleRun("keeper", 4);
    const start = run.dp;
    expect(placeUnit(run, "gob_grunt", 29, 30)).toBeNull();
    const afterRecruit = run.dp;
    expect(moveUnit(run, run.units[0].id, 29, 29)).toBeNull();
    expect(run.dp).toBe(afterRecruit);
    expect(sellUnit(run, run.units[0].id)).toBeNull();
    expect(placeTrap(run, "trap_dart", 28, 30)).toBeNull();
    expect(sellTrap(run, run.traps[0].id)).toBeNull();
    expect(digTile(run, 33, 30)).toBeNull();
    expect(collapseTile(run, 33, 30)).toBeNull();
    expect(run.dp).toBe(start);
    expect(collapseTile(run, 28, 28)).toBeNull();
    expect(run.dp).toBe(start);
  });

  it("gives every Ember back for a filled-in room and scales costs sublinearly", () => {
    const run = createIdleRun("keeper", 4);
    run.dp = 200;
    const price = roomCost(run);
    expect(buyRoom(run, 35, 30)).toBeNull();
    expect(run.dp).toBe(200 - price);
    for (let x = 37; x >= 33; x--) {
      for (let y = 28; y <= 32; y++) expect(collapseTile(run, x, y)).toBeNull();
    }
    expect(run.dp).toBe(200);
    expect(dungeonPrice(run, 400)).toBeLessThan(dungeonPrice(run, 40) * 10);
  });
});

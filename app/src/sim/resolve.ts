// ============================================================================
// Deterministic combat resolution (docs/10). Pure: (run, seed) -> Timeline.
// ============================================================================
import type {
  RunState, WaveDef, Timeline, SimEntity, SimEvent, StatusSpec, StatusEffect,
  GearItem, AffinityType, Tier, Frame, EntityMeta,
} from "./types";
import { FLAG_FROZEN, FLAG_BERSERK, FLAG_INVIS } from "./types";
import { CONFIG } from "./config";
import { makePRNG, hashSeed } from "./rng";
import type { PRNG } from "./rng";
import { generateWave } from "./wavegen";
import {
  buildDungeonEntities, buildInvaderEntities, computeResearchMods,
} from "./combat";
import { TRAP_BY_ID } from "./content/traps";
import { CLASS_BY_ID } from "./content/enemies";
import { rollDrop } from "./content/gear";
import { dpKill, dpWaveClear } from "./economy";
import { powerScore } from "./power";
import { key, neighbors, isPassable, manhattan, hasLineOfSight, findPath } from "./maputil";

interface TrapRuntime {
  id: string; defId: string; x: number; y: number;
  chargesLeft: number; cooldown: number; revealed: boolean; depleted: boolean;
}

interface Ctx {
  rng: PRNG;
  tick: number;
  events: SimEvent[];
  frames: Frame[];
  dungeon: SimEntity[];
  invaders: SimEntity[];
  core: SimEntity;
  traps: TrapRuntime[];
  flow: Map<string, number>;
  flowDirty: boolean;
  run: RunState;
  dpKillMult: number;
  reward: { dp: number; drops: GearItem[]; killCount: number };
  casualties: Set<string>;
}

const TICKS_PER_SEC = CONFIG.TICKS_PER_SEC;
const DT = 1 / TICKS_PER_SEC;

export function resolveWave(run: RunState, waveOverride?: WaveDef): Timeline {
  const wave = waveOverride ?? generateWave(run.wave, run.rngSeedRoot);
  const seed = hashSeed(run.rngSeedRoot, run.wave, 0x5151);
  const rng = makePRNG(seed);
  const mods = computeResearchMods(run);

  const dungeon = buildDungeonEntities(run, mods);
  const invaders = buildInvaderEntities(wave, run.map.entrance);

  // Core as a stationary target entity
  const core: SimEntity = {
    id: "core", side: "dungeon", defId: "core", name: "Dungeon Core", tier: 1,
    x: run.map.core.x, y: run.map.core.y, homeX: run.map.core.x, homeY: run.map.core.y,
    hp: run.core.hp + run.core.ward, maxHp: run.core.maxHp + run.core.wardMax, shield: 0,
    stats: { ...zeroStats(), hp: run.core.maxHp, def: 0, mres: 0 } as never,
    affinities: {}, abilities: [], primaryDamageType: "melee", state: "idle",
    attackCdTicks: 0, statuses: [], revealRadius: 0, threatValue: 0.1,
  };

  const traps: TrapRuntime[] = run.traps.map((t) => {
    const def = TRAP_BY_ID[t.defId];
    return {
      id: t.id, defId: t.defId, x: t.x, y: t.y,
      chargesLeft: def && def.charges !== "infinite" ? def.charges : Number.POSITIVE_INFINITY,
      cooldown: 0, revealed: false, depleted: false,
    };
  });

  const ctx: Ctx = {
    rng, tick: 0, events: [], frames: [], dungeon, invaders, core, traps,
    flow: new Map(), flowDirty: true, run,
    dpKillMult: 1 + mods.dpKillPct,
    reward: { dp: 0, drops: [], killCount: 0 },
    casualties: new Set(),
  };

  // Wave-start abilities (auras, summons, shields)
  applyWaveStart(ctx);

  ctx.events.push({ tick: 0, type: "waveStart", data: { invaders: invaders.length, group: wave.groupType } });
  for (const e of [...dungeon, ...invaders]) {
    ctx.events.push({ tick: 0, type: "spawn", sourceId: e.id, x: e.x, y: e.y, data: { side: e.side, defId: e.defId, tier: e.tier, isUnique: e.isUnique ?? false, name: e.name } });
  }

  const maxTicks = CONFIG.MAX_TICKS_BASE + invaders.length * 20;
  let coreSurvived = true;

  for (let tick = 1; tick <= maxTicks; tick++) {
    ctx.tick = tick;
    processStatuses(ctx);
    processRogueReveal(ctx);
    if (ctx.flowDirty) { ctx.flow = buildFlowField(run, traps); ctx.flowDirty = false; }

    // AI + movement + attacks, deterministic order by id
    const order = [...dungeon, ...invaders].filter((e) => e.state !== "dead").sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const e of order) {
      if (e.state === "dead") continue;
      if (isStunned(e)) continue;
      if (e.side === "invader") invaderAct(ctx, e);
      else dungeonAct(ctx, e);
    }
    processHealers(ctx);
    snapshotFrame(ctx);

    if (core.hp <= 0) { coreSurvived = false; break; }
    if (invaders.every((e) => e.state === "dead")) break;
  }

  // Wave clear reward
  if (coreSurvived) ctx.reward.dp += dpWaveClear(run.wave);

  ctx.events.push({ tick: ctx.tick, type: "waveEnd", data: { coreSurvived } });

  const meta: EntityMeta[] = [core, ...dungeon, ...invaders].map((e) => ({
    id: e.id, side: e.side, defId: e.defId, name: e.name, tier: e.tier,
    isUnique: e.isUnique ?? false, family: e.family, archetype: e.archetype,
  }));

  return {
    seed,
    wave: run.wave,
    durationTicks: ctx.tick,
    outcome: {
      coreSurvived,
      coreHpRemaining: Math.max(0, core.hp),
      waveCleared: coreSurvived,
    },
    events: ctx.events,
    frames: ctx.frames,
    meta,
    coreHpStart: run.core.hp + run.core.ward,
    reward: ctx.reward,
    casualties: [...ctx.casualties],
  };
}

function snapshotFrame(ctx: Ctx) {
  const ents = [];
  for (const e of [ctx.core, ...ctx.dungeon, ...ctx.invaders]) {
    if (e.state === "dead") continue;
    let fl = 0;
    if (isFrozen(e)) fl |= FLAG_FROZEN;
    if (e.berserk) fl |= FLAG_BERSERK;
    if (e.invisible) fl |= FLAG_INVIS;
    ents.push({ id: e.id, x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100, hp: Math.max(0, Math.round(e.hp)), maxHp: e.maxHp, fl });
  }
  ctx.frames.push({ tick: ctx.tick, ents });
}

// ---------------------------------------------------------------------------
function zeroStats() {
  return {
    hp: 0, def: 0, phys: 0, mag: 0, rng: 0, moveSpeed: 0, atkSpeed: 1, range: 1,
    acc: 1, dodge: 0, crit: 0, critMult: 1.5, mres: 0, armorPen: 0, magPen: 0,
    stealth: 0, detection: 0, block: 0, lifesteal: 0, regen: 0, aggroRadius: 0, threat: 0.1,
  };
}

function dist(a: SimEntity, b: SimEntity): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isStunned(e: SimEntity): boolean {
  return e.statuses.some((s) => (s.kind === "stun" || s.kind === "freeze") && s.remainingTicks > 0);
}

function isFrozen(e: SimEntity): boolean {
  return e.statuses.some((s) => s.kind === "freeze" && s.remainingTicks > 0);
}

function slowFactor(e: SimEntity): number {
  let f = 1;
  for (const s of e.statuses) {
    if (s.kind === "root" || s.kind === "freeze") return 0;
    if (s.kind === "slow") f = Math.min(f, 1 - s.magnitude);
  }
  return Math.max(0, f);
}

function effMoveSpeed(e: SimEntity): number {
  return e.stats.moveSpeed * slowFactor(e);
}

function attackInterval(e: SimEntity): number {
  const spd = e.stats.atkSpeed * (e.berserk ? 1.3 : 1);
  return Math.max(2, Math.round(TICKS_PER_SEC * CONFIG.BASE_ATTACK_INTERVAL / Math.max(0.2, spd)));
}

// --- Wave start: auras, summons, shields ---
function applyWaveStart(ctx: Ctx) {
  for (const e of [...ctx.dungeon, ...ctx.invaders]) {
    for (const ab of e.abilities) {
      if (ab.trigger !== "onWaveStart" && ab.trigger !== "passive") continue;
      if (ab.effect === "auraBuff" || ab.effect === "partyBuff") {
        const allies = e.side === "dungeon" ? ctx.dungeon : ctx.invaders;
        const radius = ab.radius ?? 4;
        for (const a of allies) {
          if (a.id === e.id) continue;
          if (dist(a, e) <= radius) {
            for (const [stat, pct] of Object.entries(ab.params ?? {})) {
              (a.stats as Record<string, number>)[stat] *= 1 + (pct as number);
            }
          }
        }
      } else if (ab.effect === "shieldOnWaveStart") {
        e.shield += Math.round(e.maxHp * (ab.params?.pct ?? 0.15));
      } else if (ab.effect === "summon" || ab.effect === "petSummon") {
        const count = Math.round(ab.params?.count ?? 1);
        for (let i = 0; i < count; i++) spawnAdd(ctx, e);
      }
    }
  }
}

function spawnAdd(ctx: Ctx, parent: SimEntity) {
  const add: SimEntity = {
    id: `${parent.id}_add_${ctx.invaders.length + ctx.dungeon.length}`,
    side: parent.side, defId: parent.side === "dungeon" ? "summon" : "summon",
    name: "Summoned", tier: 1, x: parent.x + ctx.rng.range(-0.5, 0.5), y: parent.y + ctx.rng.range(-0.5, 0.5),
    homeX: Math.round(parent.x), homeY: Math.round(parent.y),
    hp: Math.round(parent.maxHp * 0.25), maxHp: Math.round(parent.maxHp * 0.25), shield: 0,
    stats: { ...parent.stats, hp: parent.maxHp * 0.25, phys: parent.stats.phys * 0.4, mag: parent.stats.mag * 0.4, rng: parent.stats.rng * 0.4, moveSpeed: Math.max(1, parent.stats.moveSpeed) },
    affinities: parent.affinities, abilities: [], primaryDamageType: parent.primaryDamageType,
    state: "idle", attackCdTicks: 0, statuses: [], revealRadius: 0, threatValue: 0.5,
  };
  if (parent.side === "dungeon") ctx.dungeon.push(add); else ctx.invaders.push(add);
  ctx.events.push({ tick: ctx.tick, type: "summon", sourceId: parent.id, targetId: add.id, x: add.x, y: add.y, data: { side: add.side } });
}

// --- Statuses ---
function processStatuses(ctx: Ctx) {
  for (const e of [...ctx.dungeon, ...ctx.invaders]) {
    if (e.state === "dead") continue;
    if (e.statuses.length === 0) continue;
    for (const s of e.statuses) {
      if ((s.kind === "poison" || s.kind === "burn" || s.kind === "bleed") && s.remainingTicks > 0) {
        const dmg = s.magnitude * DT * 10 * DT; // magnitude is dps -> per tick
        const perTick = s.magnitude / TICKS_PER_SEC;
        applyDamageRaw(ctx, e, perTick, "true", s.sourceId);
        void dmg;
      }
      s.remainingTicks--;
    }
    e.statuses = e.statuses.filter((s) => s.remainingTicks > 0);
    if (e.hp <= 0 && (e.state as string) !== "dead") killEntity(ctx, e, undefined);
  }
}

function addStatus(target: SimEntity, spec: StatusSpec, sourceId: string) {
  const existing = target.statuses.find((s) => s.kind === spec.kind && s.sourceId === sourceId);
  const eff: StatusEffect = { ...spec, remainingTicks: spec.durationTicks, sourceId };
  if (existing) { existing.remainingTicks = Math.max(existing.remainingTicks, spec.durationTicks); existing.magnitude = Math.max(existing.magnitude, spec.magnitude); }
  else target.statuses.push(eff);
}

// --- Rogue reveal of traps (docs/08, 09) ---
function processRogueReveal(ctx: Ctx) {
  for (const inv of ctx.invaders) {
    if (inv.state === "dead" || inv.revealRadius <= 0) continue;
    for (const t of ctx.traps) {
      if (t.revealed || t.depleted) continue;
      if (Math.hypot(inv.x - t.x, inv.y - t.y) <= inv.revealRadius) {
        t.revealed = true;
        ctx.flowDirty = true;
        ctx.events.push({ tick: ctx.tick, type: "reveal", sourceId: inv.id, x: t.x, y: t.y, data: { trapId: t.id } });
      }
    }
  }
}

// --- Flow field (Dijkstra from core; revealed traps high cost) ---
function buildFlowField(run: RunState, traps: TrapRuntime[]): Map<string, number> {
  const revealed = new Set(traps.filter((t) => t.revealed && !t.depleted).map((t) => key(t.x, t.y)));
  const dist = new Map<string, number>();
  const core = run.map.core;
  dist.set(key(core.x, core.y), 0);
  // simple Dijkstra with small integer costs
  const pq: { x: number; y: number; d: number }[] = [{ x: core.x, y: core.y, d: 0 }];
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[bi].d) bi = i;
    const cur = pq.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.d > (dist.get(ck) ?? Infinity)) continue;
    for (const [nx, ny] of neighbors(cur.x, cur.y)) {
      if (!isPassable(run.map, nx, ny)) continue;
      const nk = key(nx, ny);
      const stepCost = 1 + (revealed.has(nk) ? 40 : 0);
      const nd = cur.d + stepCost;
      if (nd < (dist.get(nk) ?? Infinity)) { dist.set(nk, nd); pq.push({ x: nx, y: ny, d: nd }); }
    }
  }
  return dist;
}

function flowNextStep(ctx: Ctx, e: SimEntity): { x: number; y: number } | null {
  const cx = Math.round(e.x), cy = Math.round(e.y);
  let best: { x: number; y: number } | null = null;
  let bestD = ctx.flow.get(key(cx, cy)) ?? Infinity;
  for (const [nx, ny] of neighbors(cx, cy)) {
    const d = ctx.flow.get(key(nx, ny));
    if (d === undefined) continue;
    if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
  }
  return best;
}

function moveToward(e: SimEntity, tx: number, ty: number, perTick: number) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= perTick || d === 0) { e.x = tx; e.y = ty; return; }
  e.x += (dx / d) * perTick;
  e.y += (dy / d) * perTick;
}

/**
 * Move toward an arbitrary tile (tx,ty) following a passable BFS path so the
 * entity NEVER walks through stone/unexplored tiles. Caches the path on the
 * entity and re-plans when the goal moves or the path goes stale. Returns true
 * if it produced movement (i.e. a path exists).
 */
function moveAlongPath(ctx: Ctx, e: SimEntity, tx: number, ty: number, perTick: number): boolean {
  const fx = Math.round(e.x), fy = Math.round(e.y);
  if (fx === tx && fy === ty) { moveToward(e, tx, ty, perTick); return true; }
  const stale = !e.path || e.path.length === 0 || !e.pathGoal
    || e.pathGoal.x !== tx || e.pathGoal.y !== ty
    || (ctx.tick - (e.pathTick ?? -999)) > 12;
  if (stale) {
    const p = findPath(ctx.run.map, { x: fx, y: fy }, { x: tx, y: ty });
    e.path = p ?? [];
    e.pathGoal = { x: tx, y: ty };
    e.pathTick = ctx.tick;
  }
  // Drop any leading node we've already reached.
  while (e.path && e.path.length > 0 && Math.round(e.x) === e.path[0].x && Math.round(e.y) === e.path[0].y) {
    e.path.shift();
  }
  if (!e.path || e.path.length === 0) return false;
  const node = e.path[0];
  moveToward(e, node.x, node.y, perTick);
  return true;
}

const THREAT_TTL = TICKS_PER_SEC * 4; // forget an attacker after 4s without being hit by it

/** The living entity that last damaged `e` (drives retaliation), or null. */
function threatOf(ctx: Ctx, e: SimEntity): SimEntity | null {
  if (!e.threatId) return null;
  if (ctx.tick - (e.threatTick ?? -9999) > THREAT_TTL) { e.threatId = undefined; return null; }
  const pool = e.side === "dungeon" ? ctx.invaders : ctx.dungeon;
  const t = pool.find((o) => o.id === e.threatId);
  if (!t || t.state === "dead") { e.threatId = undefined; return null; }
  return t;
}

// --- AI ---
function isRanged(e: SimEntity): boolean {
  return e.stats.range > 1.6;
}

function losOK(ctx: Ctx, a: SimEntity, b: { x: number; y: number }): boolean {
  return hasLineOfSight(ctx.run.map, Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y));
}

function nearestEnemy(e: SimEntity, pool: SimEntity[], requireLOS: boolean, ctx: Ctx): SimEntity | null {
  let best: SimEntity | null = null;
  let bestD = Infinity;
  for (const o of pool) {
    if (o.state === "dead") continue;
    if (requireLOS && !losOK(ctx, e, o)) continue;
    const d = dist(e, o);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function attackRange(e: SimEntity): number {
  // melee (range 1) needs ~1.5 to reach diagonally-adjacent tiles
  return Math.max(1.5, e.stats.range);
}

function invaderAct(ctx: Ctx, e: SimEntity) {
  if (e.attackCdTicks > 0) e.attackCdTicks--;
  const rangeR = attackRange(e);
  const ranged = isRanged(e);
  const perTick = effMoveSpeed(e) * DT;

  // 1) attack a dungeon unit in range (nearestEnemy already enforces LOS for ranged)
  const target = nearestEnemy(e, ctx.dungeon, ranged, ctx);
  if (target && dist(e, target) <= rangeR) { tryAttack(ctx, e, target); return; }
  // 2) attack core if in range (ranged need line of sight)
  if (ctx.core.hp > 0 && dist(e, ctx.core) <= rangeR && (!ranged || losOK(ctx, e, ctx.core))) {
    tryAttack(ctx, e, ctx.core);
    return;
  }
  // 3) retaliate: hunt whoever last damaged me (pathing around walls)
  const threat = threatOf(ctx, e);
  if (threat && moveAlongPath(ctx, e, Math.round(threat.x), Math.round(threat.y), perTick)) {
    triggerTrapsAt(ctx, e); e.state = "moving"; return;
  }
  // 4) engage the nearest reachable defender within aggro range
  if (target && dist(e, target) <= e.stats.aggroRadius
    && moveAlongPath(ctx, e, Math.round(target.x), Math.round(target.y), perTick)) {
    triggerTrapsAt(ctx, e); e.state = "moving"; return;
  }
  // 5) flow toward core (flow field is wall-respecting)
  const step = flowNextStep(ctx, e);
  if (step) { moveToward(e, step.x, step.y, perTick); triggerTrapsAt(ctx, e); e.state = "moving"; return; }
  if (moveAlongPath(ctx, e, ctx.core.x, ctx.core.y, perTick)) { triggerTrapsAt(ctx, e); e.state = "moving"; return; }
  e.state = "idle";
}

function dungeonAct(ctx: Ctx, e: SimEntity) {
  if (e.id === "core") return;
  if (e.attackCdTicks > 0) e.attackCdTicks--;
  const rangeR = attackRange(e);
  const ranged = isRanged(e);
  const perTick = effMoveSpeed(e) * DT;

  const target = nearestEnemy(e, ctx.invaders, ranged, ctx);
  if (target && dist(e, target) <= rangeR) { tryAttack(ctx, e, target); return; }

  if (e.isTurret) { e.state = "idle"; return; } // turrets can't move (even to retaliate)

  // Retaliate: hunt whoever last damaged me, ignoring the home leash so ranged
  // attackers can't whittle a unit down without it fighting back.
  const threat = threatOf(ctx, e);
  if (threat && moveAlongPath(ctx, e, Math.round(threat.x), Math.round(threat.y), perTick)) {
    e.state = "moving"; return;
  }

  // Otherwise engage a nearby invader, but respect the leash from home.
  if (target && dist(e, target) <= e.stats.aggroRadius) {
    const homeDist = manhattan(Math.round(e.x), Math.round(e.y), e.homeX, e.homeY);
    if (homeDist < CONFIG.LEASH_TILES + 1
      && moveAlongPath(ctx, e, Math.round(target.x), Math.round(target.y), perTick)) {
      e.state = "moving"; return;
    }
  }

  // Return home.
  if (Math.hypot(e.x - e.homeX, e.y - e.homeY) > 0.1
    && moveAlongPath(ctx, e, e.homeX, e.homeY, perTick)) {
    e.state = "moving"; return;
  }
  e.state = "idle";
}

function processHealers(ctx: Ctx) {
  for (const e of ctx.invaders) {
    if (e.state === "dead") continue;
    const heal = e.abilities.find((a) => a.effect === "healAlly");
    if (!heal) continue;
    const interval = Math.round(heal.params?.intervalTicks ?? 12);
    if (ctx.tick % interval !== 0) continue;
    const radius = heal.radius ?? 5;
    let lowest: SimEntity | null = null;
    for (const a of ctx.invaders) {
      if (a.state === "dead" || a.hp >= a.maxHp) continue;
      if (dist(a, e) > radius) continue;
      if (!lowest || a.hp / a.maxHp < lowest.hp / lowest.maxHp) lowest = a;
    }
    if (lowest) {
      const amt = Math.round(lowest.maxHp * (heal.params?.amount ?? 0.12));
      lowest.hp = Math.min(lowest.maxHp, lowest.hp + amt);
      ctx.events.push({ tick: ctx.tick, type: "heal", sourceId: e.id, targetId: lowest.id, amount: amt });
    }
  }
}

// --- Attacks ---
function tryAttack(ctx: Ctx, att: SimEntity, tgt: SimEntity) {
  att.state = "attacking";
  att.targetId = tgt.id;
  if (att.attackCdTicks > 0) return;
  att.attackCdTicks = attackInterval(att);
  resolveAttack(ctx, att, tgt);
}

function mainAtkStat(e: SimEntity): number {
  switch (e.primaryDamageType) {
    case "ranged": return e.stats.rng;
    case "arcane": return e.stats.mag;
    default: return e.stats.phys;
  }
}

function resolveAttack(ctx: Ctx, att: SimEntity, tgt: SimEntity) {
  const cap = tgt.archetype === "rogue" ? CONFIG.HIT_CAP_ROGUE : CONFIG.HIT_CAP;
  const stealthPen = tgt.stats.stealth * 0.4;
  const pHit = clamp(att.stats.acc * CONFIG.BASE_HIT - tgt.stats.dodge - stealthPen, CONFIG.HIT_FLOOR, cap);
  if (ctx.rng.next() > pHit) {
    ctx.events.push({ tick: ctx.tick, type: "miss", sourceId: att.id, targetId: tgt.id });
    return;
  }
  const type = att.primaryDamageType;
  let dmg = mainAtkStat(att) * (att.affinities[type] ?? 1);
  let crit = false;
  if (ctx.rng.next() < att.stats.crit) { dmg *= att.stats.critMult; crit = true; }

  // berserk: once below half HP, fights harder (faster + stronger)
  if (!att.berserk && att.hp < att.maxHp * 0.5 && att.abilities.some((a) => a.effect === "berserk")) att.berserk = true;
  if (att.berserk) dmg *= 1.4;
  // first strike: a big bonus on this entity's very first hit
  if (!att.firstAttackDone && att.abilities.some((a) => a.effect === "firstStrike")) { dmg *= 1.7; att.firstAttackDone = true; }

  // execute bonus
  if (att.abilities.some((a) => a.effect === "executeLowHp") && tgt.hp / tgt.maxHp < 0.25) dmg *= 1.6;

  dmg = mitigate(dmg, type, att, tgt);
  if (ctx.rng.next() < tgt.stats.block) dmg *= 1 - CONFIG.BLOCK_REDUCTION;
  dmg = Math.max(CONFIG.MIN_DAMAGE, Math.round(dmg));

  applyDamageResolved(ctx, att, tgt, dmg, crit);

  // lifesteal
  if (att.stats.lifesteal > 0 && att.state !== "dead") {
    att.hp = Math.min(att.maxHp, att.hp + Math.round(dmg * att.stats.lifesteal));
  }
  // onHit abilities
  const bigAoe = att.abilities.some((a) => a.effect === "bigAoe");
  for (const ab of att.abilities) {
    if (ab.trigger !== "onHit") continue;
    if (ab.effect === "slowOnHit") addStatus(tgt, { kind: "slow", magnitude: ab.params?.pct ?? 0.3, durationTicks: 20 }, att.id);
    else if (ab.effect === "poisonDot") addStatus(tgt, { kind: "poison", magnitude: ab.params?.dps ?? 6, durationTicks: 30 }, att.id);
    else if (ab.effect === "burnOnHit") addStatus(tgt, { kind: "burn", magnitude: ab.params?.dps ?? 7, durationTicks: ab.params?.dur ?? 30 }, att.id);
    else if (ab.effect === "bleedOnHit") addStatus(tgt, { kind: "bleed", magnitude: ab.params?.dps ?? 7, durationTicks: ab.params?.dur ?? 30 }, att.id);
    else if (ab.effect === "freezeOnHit") addStatus(tgt, { kind: "freeze", magnitude: 1, durationTicks: ab.params?.dur ?? 12 }, att.id);
    else if (ab.effect === "confuse") addStatus(tgt, { kind: "confuse", magnitude: 1, durationTicks: 15 }, att.id);
    else if (ab.effect === "cleave") cleave(ctx, att, tgt, dmg * 0.5, bigAoe ? 2.4 : 1.6);
    else if (ab.effect === "splash") splash(ctx, att, tgt, dmg * (bigAoe ? 0.6 : 0.5), bigAoe ? 2.6 : 1.6);
  }
  // thorns on target
  const thorns = tgt.abilities.find((a) => a.effect === "thorns");
  if (thorns && att.state !== "dead") {
    applyDamageRaw(ctx, att, Math.round(dmg * (thorns.params?.pct ?? 0.2)), "true", tgt.id);
  }
}

function mitigate(dmg: number, type: AffinityType, att: SimEntity, tgt: SimEntity): number {
  if (type === "melee" || type === "ranged") {
    const def = Math.max(0, tgt.stats.def - att.stats.armorPen);
    return dmg * (CONFIG.MIT_K / (CONFIG.MIT_K + def));
  }
  // magic / elemental
  const mres = Math.max(0, tgt.stats.mres - att.stats.magPen);
  let mult = CONFIG.MIT_K / (CONFIG.MIT_K + mres);
  const resist = tgt.affinities[type];
  if (resist && resist > 1) mult *= 1 / resist; // resistant
  else if (resist && resist < 1) mult *= 2 - resist; // vulnerable
  return dmg * mult;
}

function cleave(ctx: Ctx, att: SimEntity, primary: SimEntity, dmg: number, radius = 1.6) {
  const pool = att.side === "dungeon" ? ctx.invaders : ctx.dungeon;
  for (const o of pool) {
    if (o.id === primary.id || o.state === "dead") continue;
    if (dist(att, o) <= radius) applyDamageRaw(ctx, o, Math.round(dmg), att.primaryDamageType, att.id);
  }
}

function splash(ctx: Ctx, att: SimEntity, center: SimEntity, dmg: number, radius = 1.6) {
  const pool = att.side === "dungeon" ? ctx.invaders : ctx.dungeon;
  for (const o of pool) {
    if (o.id === center.id || o.state === "dead") continue;
    if (dist(center, o) <= radius) applyDamageRaw(ctx, o, Math.round(dmg), att.primaryDamageType, att.id);
  }
}

/** Heal-at-half: the first time HP drops below 50%, heal a chunk (once). */
function checkHealAtHalf(ctx: Ctx, e: SimEntity) {
  if (e.healedAtHalf || e.state === "dead") return;
  if (e.hp <= 0 || e.hp >= e.maxHp * 0.5) return;
  const ab = e.abilities.find((a) => a.effect === "healAtHalf");
  if (!ab) return;
  e.healedAtHalf = true;
  const amt = Math.round(e.maxHp * (ab.params?.pct ?? 0.3));
  e.hp = Math.min(e.maxHp, e.hp + amt);
  ctx.events.push({ tick: ctx.tick, type: "heal", sourceId: e.id, targetId: e.id, amount: amt });
}

function applyDamageResolved(ctx: Ctx, att: SimEntity, tgt: SimEntity, dmg: number, crit: boolean) {
  absorb(tgt, dmg);
  if (tgt.id !== "core" && att.id !== tgt.id) { tgt.threatId = att.id; tgt.threatTick = ctx.tick; } // retaliate
  ctx.events.push({ tick: ctx.tick, type: crit ? "crit" : "hit", sourceId: att.id, targetId: tgt.id, amount: dmg, x: tgt.x, y: tgt.y });
  if (tgt.id === "core") ctx.events.push({ tick: ctx.tick, type: "coreHit", sourceId: att.id, amount: dmg });
  checkHealAtHalf(ctx, tgt);
  if (tgt.hp <= 0 && tgt.state !== "dead") killEntity(ctx, tgt, att);
}

function applyDamageRaw(ctx: Ctx, tgt: SimEntity, dmg: number, type: AffinityType | "true", sourceId: string) {
  if (tgt.state === "dead") return;
  let d = dmg;
  if (type !== "true") {
    // light mitigation for raw typed (dots already balanced; keep simple)
  }
  absorb(tgt, Math.max(1, Math.round(d)));
  if (tgt.id !== "core" && sourceId && sourceId !== tgt.id) { tgt.threatId = sourceId; tgt.threatTick = ctx.tick; } // retaliate
  ctx.events.push({ tick: ctx.tick, type: "hit", sourceId, targetId: tgt.id, amount: Math.round(d), x: tgt.x, y: tgt.y });
  if (tgt.id === "core") ctx.events.push({ tick: ctx.tick, type: "coreHit", sourceId, amount: Math.round(d) });
  checkHealAtHalf(ctx, tgt);
  if (tgt.hp <= 0 && (tgt.state as string) !== "dead") killEntity(ctx, tgt, undefined);
}

function absorb(tgt: SimEntity, dmg: number) {
  if (tgt.shield > 0) {
    const s = Math.min(tgt.shield, dmg);
    tgt.shield -= s;
    dmg -= s;
  }
  tgt.hp -= dmg;
}

function killEntity(ctx: Ctx, e: SimEntity, killer?: SimEntity) {
  e.state = "dead";
  e.hp = 0;
  ctx.events.push({ tick: ctx.tick, type: "death", sourceId: killer?.id, targetId: e.id, x: e.x, y: e.y, data: { side: e.side } });

  // explode-on-death: AoE damage to enemies around the corpse
  const boom = e.abilities.find((a) => a.effect === "explodeOnDeath");
  if (boom) {
    const pool = e.side === "dungeon" ? ctx.invaders : ctx.dungeon;
    const radius = boom.radius ?? 2;
    const dmg = Math.round(e.maxHp * (boom.params?.pct ?? 0.4));
    ctx.events.push({ tick: ctx.tick, type: "trapTrigger", x: e.x, y: e.y, data: { explode: true } });
    for (const o of pool) {
      if (o.state === "dead") continue;
      if (dist(e, o) <= radius) applyDamageRaw(ctx, o, dmg, "fire", e.id);
    }
  }
  if (e.side === "invader" && e.defId !== "summon") {
    // reward + drops (defeated adventurer)
    const cls = CLASS_BY_ID[e.defId];
    const ps = cls ? powerScore(cls.stats) * (e.isUnique ? 1.6 : 1) : 100;
    ctx.reward.dp += Math.round(dpKill(ps, e.isUnique ?? false) * ctx.dpKillMult);
    ctx.reward.killCount++;
    const drop = rollDrop(ctx.rng, e.tier as Tier, e.isUnique ?? false);
    if (drop) {
      ctx.reward.drops.push(drop);
      ctx.events.push({ tick: ctx.tick, type: "drop", targetId: e.id, data: { quality: drop.quality, tier: drop.tier } });
    }
  } else if (e.side === "dungeon" && e.id !== "core" && e.defId !== "summon") {
    ctx.casualties.add(e.id);
  }
}

// --- Traps ---
function triggerTrapsAt(ctx: Ctx, e: SimEntity) {
  const ex = Math.round(e.x), ey = Math.round(e.y);
  for (const t of ctx.traps) {
    if (t.depleted) continue;
    if (t.cooldown > 0) { t.cooldown--; continue; }
    const def = TRAP_BY_ID[t.defId];
    if (!def) continue;
    let fire = false;
    if (def.trigger === "step") {
      if (t.revealed) continue; // avoided when revealed
      if (ex === t.x && ey === t.y) fire = true;
    } else {
      const r = def.radius ?? 1;
      if (Math.hypot(e.x - t.x, e.y - t.y) <= r) {
        if (t.revealed && def.category !== "special") continue;
        fire = true;
      }
    }
    if (!fire) continue;
    fireTrap(ctx, t, def);
  }
}

function fireTrap(ctx: Ctx, t: TrapRuntime, def: typeof TRAP_BY_ID[string]) {
  ctx.events.push({ tick: ctx.tick, type: "trapTrigger", x: t.x, y: t.y, data: { defId: t.defId } });
  const r = def.radius ?? 0.6;
  const targets = ctx.invaders.filter((e) => e.state !== "dead" && Math.hypot(e.x - t.x, e.y - t.y) <= Math.max(0.7, r));
  for (const tgt of targets) {
    if (def.effect.damage) {
      const type = (def.effect.damageType ?? "true") as AffinityType | "true";
      applyTrapDamage(ctx, tgt, def.effect.damage, type, t.id);
    }
    if (def.effect.status) addStatus(tgt, def.effect.status, t.id);
    if (def.effect.stripDodge) { tgt.stats.dodge = 0; tgt.stats.stealth = 0; }
    if (def.effect.silence) addStatus(tgt, { kind: "silence", magnitude: 1, durationTicks: 30 }, t.id);
    if (def.effect.removeTarget && tgt.tier <= 4) killEntity(ctx, tgt, undefined);
    if (def.effect.teleportToEntrance) { tgt.x = ctx.run.map.entrance.x; tgt.y = ctx.run.map.entrance.y; }
  }
  if (t.chargesLeft !== Number.POSITIVE_INFINITY) {
    t.chargesLeft--;
    if (t.chargesLeft <= 0) t.depleted = true;
  }
  if (def.consumable) t.depleted = true;
  t.cooldown = def.cooldownTicks;
}

function applyTrapDamage(ctx: Ctx, tgt: SimEntity, dmg: number, type: AffinityType | "true", sourceId: string) {
  let d = dmg;
  if (type !== "true") {
    if (type === "melee" || type === "ranged") d = dmg * (CONFIG.MIT_K / (CONFIG.MIT_K + tgt.stats.def));
    else d = dmg * (CONFIG.MIT_K / (CONFIG.MIT_K + tgt.stats.mres));
  }
  absorb(tgt, Math.max(1, Math.round(d)));
  ctx.events.push({ tick: ctx.tick, type: "hit", sourceId, targetId: tgt.id, amount: Math.round(d), x: tgt.x, y: tgt.y, data: { trap: true } });
  checkHealAtHalf(ctx, tgt);
  if (tgt.hp <= 0 && (tgt.state as string) !== "dead") { killEntity(ctx, tgt, undefined); }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================================================
// PixiJS dungeon renderer (docs/14, 17).
// Renders the build scene and plays back wave timelines.
// ============================================================================
import { Application, Container, Graphics, Text } from "pixi.js";
import type { FederatedPointerEvent } from "pixi.js";
import type { RunState, Timeline, EntityMeta, Frame, Archetype } from "../../sim/types";
import { UNIT_BY_ID, UNIT_DMG } from "../../sim/content/units";
import { TRAP_BY_ID } from "../../sim/content/traps";
import { AnimSprite } from "./sprites";
import type { WeaponKind } from "./sprites";
import { abilityVisual, playsCastPose } from "../art/abilityVisuals";

export const TILE = 38;

export interface HoverInfo { x: number; y: number; }

type ClickHandler = (x: number, y: number) => void;
type HoverHandler = (info: HoverInfo | null) => void;
type DragDigHandler = (x0: number, y0: number, x1: number, y1: number) => void;

function weaponForArchetype(a?: Archetype): WeaponKind {
  if (a === "archer") return "ranged";
  if (a === "mage") return "arcane";
  return "melee";
}
function lerp2(a: number, b: number, t: number) { return a + (b - a) * t; }

export class DungeonView {
  app: Application;
  world = new Container();
  tileLayer = new Container();
  trapLayer = new Container();
  rangeLayer = new Container();
  entityLayer = new Container();
  fxLayer = new Container();
  overlayLayer = new Container();

  private inited = false;
  private destroyed = false;
  private centerTarget: { x: number; y: number } | null = null;
  private userMoved = false;
  private parent: HTMLElement;
  private ro: ResizeObserver | null = null;
  private manual = false; // when true, replay is driven externally via frameStep()
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private dragging = false;
  private dragStart = { x: 0, y: 0, camX: 0, camY: 0, moved: false };
  private digStart: { x: number; y: number } | null = null;
  private hoverTile: { x: number; y: number } | null = null;

  onClick: ClickHandler = () => {};
  onHover: HoverHandler = () => {};
  onDragDig: DragDigHandler = () => {};
  onCancel: () => void = () => {};
  onError: (error: unknown) => void = (error) => console.error(error);
  toolIsDig = false;
  toolIsRoom = false;
  checkPlacement: ((x: number, y: number) => string | null) | null = null;
  selectionId: string | null = null;

  // replay state
  private timeline: Timeline | null = null;
  private metaById = new Map<string, EntityMeta>();
  private spriteById = new Map<string, { anim: AnimSprite; hpbar: Graphics }>();
  private buildSprites: AnimSprite[] = [];
  private lastPos = new Map<string, { x: number; y: number }>();
  private projectiles: { g: Graphics; sx: number; sy: number; tx: number; ty: number; life: number; max: number; kind: WeaponKind }[] = [];
  private getSpeed: () => number = () => 1;
  private onReplayEnd: () => void = () => {};
  private cursor = 0;
  private endHold = 0;
  private lastEventIdx = 0;
  private replaying = false;
  private onCursor: (t: number) => void = () => {};

  constructor(parent: HTMLElement, opts?: { manual?: boolean }) {
    this.parent = parent;
    this.manual = opts?.manual ?? false;
    this.app = new Application();
  }

  async init() {
    if (this.inited) return;
    await this.app.init({
      preference: ["webgl", "canvas"],
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      sharedTicker: false, // each view drives its own ticker (needed for H2H split-screen)
      // H2H runs two canvases side-by-side; render at 1x there to avoid fill-rate lag.
      resolution: this.manual ? 1 : Math.min(2, window.devicePixelRatio || 1),
    });
    if (this.destroyed) { this.app.destroy(true, { children: true }); return; }
    this.parent.appendChild(this.app.canvas);
    this.app.canvas.addEventListener("webglcontextlost", () => this.onError(new Error("Graphics context lost")));
    this.world.addChild(this.tileLayer, this.rangeLayer, this.trapLayer, this.entityLayer, this.fxLayer, this.overlayLayer);
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.bindEvents();
    if (this.manual) {
      // Externally driven (e.g. H2H split-screen): owner calls frameStep() + render.
      this.app.ticker.stop();
    } else {
      this.app.ticker.add(() => {
        try { this.tick(); }
        catch (error) { this.app.ticker.stop(); this.onError(error); }
      });
      this.app.ticker.start();
    }
    this.inited = true;
    // Track the host element's size directly. resizeTo only re-measures on window
    // resize, which misses panels that finish laying out later (e.g. the H2H
    // split-screen), leaving one canvas stuck at 0x0 and rendering nothing.
    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(this.parent);
    this.handleResize();
    this.tryCenter();
  }

  private handleResize() {
    if (!this.inited || this.destroyed) return;
    const w = Math.floor(this.parent.clientWidth);
    const h = Math.floor(this.parent.clientHeight);
    if (w <= 0 || h <= 0) return;
    if (this.app.screen.width === w && this.app.screen.height === h) return;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = this.app.screen;
    this.tryCenter();
  }

  destroy() {
    this.destroyed = true;
    try { this.ro?.disconnect(); } catch { /* ignore */ }
    this.ro = null;
    if (this.inited) {
      try { this.app.destroy(true, { children: true }); } catch { /* not yet inited */ }
    }
  }

  private bindEvents() {
    const stage = this.app.stage;
    stage.on("pointerdown", (e: FederatedPointerEvent) => {
      if (e.button !== 0) return;
      const t = this.screenToTile(e.global.x, e.global.y);
      if (this.toolIsDig) { this.digStart = t; return; }
      this.dragging = true;
      this.dragStart = { x: e.global.x, y: e.global.y, camX: this.camX, camY: this.camY, moved: false };
    });
    stage.on("pointermove", (e: FederatedPointerEvent) => {
      const t = this.screenToTile(e.global.x, e.global.y);
      if (!this.hoverTile || this.hoverTile.x !== t.x || this.hoverTile.y !== t.y) {
        this.hoverTile = t;
        this.onHover({ x: t.x, y: t.y });
        if (!this.replaying) this.drawHoverOverlay();
      }
      if (this.dragging) {
        const dx = e.global.x - this.dragStart.x;
        const dy = e.global.y - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) { this.dragStart.moved = true; this.userMoved = true; }
        this.camX = this.dragStart.camX + dx;
        this.camY = this.dragStart.camY + dy;
        this.applyCam();
      }
    });
    const endDrag = (e: FederatedPointerEvent) => {
      const t = this.screenToTile(e.global.x, e.global.y);
      if (this.toolIsDig && this.digStart) {
        const start = this.digStart;
        this.digStart = null;
        this.drawHoverOverlay();
        if (start.x === t.x && start.y === t.y) this.onClick(t.x, t.y);
        else this.onDragDig(start.x, start.y, t.x, t.y);
        return;
      }
      if (this.dragging && !this.dragStart.moved) this.onClick(t.x, t.y);
      this.dragging = false;
    };
    stage.on("pointerup", endDrag);
    stage.on("pointerupoutside", () => { this.dragging = false; this.digStart = null; });
    stage.on("pointerleave", () => {
      if (this.dragging || this.digStart) return;
      this.hoverTile = null;
      this.onHover(null);
      this.drawHoverOverlay();
    });
    this.app.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.onCancel();
    });
    this.app.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.userMoved = true; // user interacted; stop auto-centering
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      // zoom toward pointer
      const rect = this.app.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      this.zoomBy(factor, px, py);
    }, { passive: false });
  }

  zoomBy(factor: number, px = this.parent.clientWidth / 2, py = this.parent.clientHeight / 2) {
    this.userMoved = true;
    const wx = (px - this.camX) / this.zoom, wy = (py - this.camY) / this.zoom;
    this.zoom = Math.max(0.35, Math.min(2.5, this.zoom * factor));
    this.camX = px - wx * this.zoom;
    this.camY = py - wy * this.zoom;
    this.applyCam();
  }

  private applyCam() {
    this.world.position.set(this.camX, this.camY);
    this.world.scale.set(this.zoom);
  }

  private screenToTile(gx: number, gy: number): { x: number; y: number } {
    const wx = (gx - this.camX) / this.zoom;
    const wy = (gy - this.camY) / this.zoom;
    return { x: Math.round(wx / TILE), y: Math.round(wy / TILE) };
  }

  centerOn(tx: number, ty: number) {
    this.centerTarget = { x: tx, y: ty };
    this.userMoved = false; // re-enable auto-centering until the user pans/zooms
    this.tryCenter();
  }

  fitDungeon(run: RunState) {
    const { x, y } = run.map.core;
    let radius = 2;
    for (const tile of Object.keys(run.map.tiles)) {
      const [tx, ty] = tile.split(",").map(Number);
      radius = Math.max(radius, Math.abs(tx - x), Math.abs(ty - y));
    }
    const view = Math.min(this.parent.clientWidth * 0.78, this.parent.clientHeight * 0.69);
    this.zoom = Math.max(0.45, Math.min(1.65, view / ((radius * 2 + 1) * TILE)));
    this.centerOn(x, y);
  }

  /** Keep the target centered (until the user pans/zooms) once the canvas has a real size. */
  private tryCenter() {
    if (this.userMoved || !this.centerTarget || !this.inited) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (!w || !h) return; // canvas not laid out yet; retry on next tick
    this.camX = w / 2 - this.centerTarget.x * TILE * this.zoom;
    this.camY = h / 2 - this.centerTarget.y * TILE * this.zoom;
    this.applyCam();
  }

  // ---- Build scene ----
  renderBuild(run: RunState) {
    this.replaying = false;
    this.timeline = null;
    // Clear any leftover combat visuals/state from a previous wave.
    for (const child of this.fxLayer.removeChildren()) child.destroy({ children: true });
    this.fxItems = [];
    this.projectiles = [];
    this.spriteById.clear();
    this.lastPos.clear();
    this.drawTiles(run);
    this.drawTraps(run);
    this.drawBuildUnits(run);
    this.drawHoverOverlay();
  }

  private drawTiles(run: RunState) {
    for (const child of this.tileLayer.removeChildren()) child.destroy({ children: true });
    const g = new Graphics();
    for (const [k, t] of Object.entries(run.map.tiles)) {
      const [x, y] = k.split(",").map(Number);
      const px = x * TILE - TILE / 2, py = y * TILE - TILE / 2;
      const variant = Math.abs((x * 31) ^ (y * 23)) % 4;
      let color = 0x171c24;
      if (t.state === "floor") color = [0x303942, 0x343d46, 0x353d43, 0x303c3d][variant];
      else if (t.state === "entrance") color = 0x34526a;
      else if (t.state === "core") color = 0x534962;
      g.rect(px + 1, py + 1, TILE - 2, TILE - 2).fill(color);
      g.rect(px + 2, py + TILE - 6, TILE - 4, 4).fill({ color: 0x141b24, alpha: 0.7 });
      g.rect(px + 3, py + 3, TILE - 6, 2).fill({ color: 0x96a9a2, alpha: 0.22 });
      if (t.state === "floor") {
        g.rect(px + 7 + variant * 5, py + 10, 7, 2).fill({ color: 0x93aa80, alpha: 0.2 });
        g.rect(px + 11, py + 23 + variant * 2, 12, 2).fill({ color: 0x171c24, alpha: 0.42 });
      }
    }
    this.tileLayer.addChild(g);
    // core & entrance markers
    const cm = new Graphics();
    const e = run.map.entrance;
    cm.circle(e.x * TILE, e.y * TILE, 13).stroke({ width: 3, color: 0x7fd0ff });
    this.tileLayer.addChild(cm);
  }

  private drawTraps(run: RunState) {
    for (const child of this.trapLayer.removeChildren()) child.destroy({ children: true });
    for (const tr of run.traps) {
      const def = TRAP_BY_ID[tr.defId];
      const cont = new Container();
      cont.position.set(tr.x * TILE, tr.y * TILE);
      const g = new Graphics();
      g.poly([0, -8, 8, 0, 0, 8, -8, 0]).fill(0xcc5544).stroke({ width: 1, color: 0xffaa88 });
      cont.addChild(g);
      const label = new Text({ text: def ? `T${def.tier}` : "?", style: { fontSize: 8, fill: 0xffd5c0 } });
      label.anchor.set(0.5); label.position.set(0, 13);
      cont.addChild(label);
      this.trapLayer.addChild(cont);
    }
  }

  private drawBuildUnits(run: RunState) {
    for (const child of this.entityLayer.removeChildren()) child.destroy({ children: true });
    this.buildSprites = [];
    const core = new AnimSprite({ id: "core", tier: 1, weapon: "melee" });
    core.root.position.set(run.map.core.x * TILE, run.map.core.y * TILE);
    this.entityLayer.addChild(core.root);
    this.buildSprites.push(core);
    for (const u of run.units) {
      const def = UNIT_BY_ID[u.defId];
      if (!def) continue;
      const anim = new AnimSprite({
        id: u.defId,
        tier: def.tier,
        weapon: (UNIT_DMG[u.defId] ?? "melee") as WeaponKind,
      });
      anim.root.position.set(u.x * TILE, u.y * TILE);
      if (u.id === this.selectionId) {
        const ring = new Graphics();
        ring.circle(0, -2, 18).stroke({ width: 2, color: 0xffffff });
        anim.root.addChild(ring);
      }
      this.entityLayer.addChild(anim.root);
      this.buildSprites.push(anim);
    }
  }

  private drawHoverOverlay() {
    for (const child of this.overlayLayer.removeChildren()) child.destroy({ children: true });
    if (!this.hoverTile || this.replaying) return;
    const g = new Graphics();
    const { x, y } = this.hoverTile;
    const range = this.toolIsRoom ? 2 : 0;
    const minX = this.digStart ? Math.min(this.digStart.x, x) : x - range;
    const minY = this.digStart ? Math.min(this.digStart.y, y) : y - range;
    const maxX = this.digStart ? Math.max(this.digStart.x, x) : x + range;
    const maxY = this.digStart ? Math.max(this.digStart.y, y) : y + range;
    const brush = this.digStart && (x !== this.digStart.x || y !== this.digStart.y);
    const color = this.checkPlacement ? !brush && this.checkPlacement(x, y) ? 0xeb8b79 : 0xa6d29b : 0xf2d6a1;
    const outline = g.rect((minX - 0.5) * TILE, (minY - 0.5) * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
    if (this.checkPlacement) outline.fill({ color, alpha: 0.23 });
    outline.stroke({ width: 2, color, alpha: 0.9 });
    this.overlayLayer.addChild(g);
  }

  // ---- Replay ----
  startReplay(tl: Timeline, getSpeed: () => number, onEnd: () => void, onCursor: (t: number) => void) {
    this.timeline = tl;
    this.replaying = true;
    this.cursor = 0;
    this.endHold = 0;
    this.lastEventIdx = 0;
    this.getSpeed = getSpeed;
    this.onReplayEnd = onEnd;
    this.onCursor = onCursor;
    this.metaById.clear();
    for (const m of tl.meta) this.metaById.set(m.id, m);
    for (const child of this.entityLayer.removeChildren()) child.destroy({ children: true });
    for (const child of this.fxLayer.removeChildren()) child.destroy({ children: true });
    for (const child of this.overlayLayer.removeChildren()) child.destroy({ children: true });
    this.spriteById.clear();
    this.buildSprites = [];
    this.lastPos.clear();
    this.projectiles = [];
  }

  stopReplay() { this.replaying = false; }

  /**
   * Advance + render one frame using an externally supplied delta (ms). Used by
   * the H2H split-screen so both dungeons are driven by ONE clock and always
   * stay in lockstep regardless of per-canvas ticker timing.
   */
  frameStep(dtMs: number) {
    if (!this.inited || this.destroyed) return;
    try { this.tick(dtMs); this.app.renderer.render(this.app.stage); }
    catch (error) { this.onError(error); }
  }

  private tick(dtMsArg?: number) {
    const dtMs = dtMsArg ?? this.app.ticker.deltaMS;
    const dtReal = dtMs / 1000;
    if (!this.userMoved) this.tryCenter();
    if (!this.replaying || !this.timeline) {
      for (const s of this.buildSprites) s.update(dtReal);
      return;
    }
    const tl = this.timeline;
    const speed = this.getSpeed();
    this.cursor += (dtMs / 100) * speed;
    const ended = this.cursor >= tl.durationTicks;
    if (ended) this.cursor = tl.durationTicks;

    this.renderFrameAt(this.cursor);
    while (this.lastEventIdx < tl.events.length && tl.events[this.lastEventIdx].tick <= this.cursor) {
      this.handleFxEvent(tl.events[this.lastEventIdx]);
      this.lastEventIdx++;
    }
    this.onCursor(this.cursor);

    const dtAnim = dtReal * Math.max(0.0001, speed);
    for (const [id, e] of this.spriteById) {
      e.anim.update(dtAnim);
      if (e.anim.dead) { e.anim.root.destroy({ children: true }); this.spriteById.delete(id); this.lastPos.delete(id); }
    }
    this.updateFx((dtMs / 16.6667) * Math.max(1, speed));

    if (ended && speed > 0) {
      this.endHold += dtReal;
      if (this.endHold >= Math.max(0.22, 0.55 / speed)) { this.replaying = false; this.onReplayEnd(); }
    }
  }

  private renderFrameAt(cursor: number) {
    const tl = this.timeline!;
    const idx = Math.min(tl.frames.length - 1, Math.floor(cursor) - 1);
    const f0: Frame | undefined = tl.frames[Math.max(0, idx)];
    const f1: Frame | undefined = tl.frames[Math.min(tl.frames.length - 1, Math.max(0, idx) + 1)];
    if (!f0) return;
    const frac = cursor - Math.floor(cursor);
    const present = new Set<string>();
    const pos1 = new Map<string, { x: number; y: number; hp: number; maxHp: number }>();
    if (f1) for (const e of f1.ents) pos1.set(e.id, e);
    for (const e of f0.ents) {
      present.add(e.id);
      let entry = this.spriteById.get(e.id);
      if (!entry) {
        const anim = this.buildReplaySprite(e.id);
        anim.spawn();
        const hpbar = new Graphics();
        anim.root.addChild(hpbar);
        entry = { anim, hpbar };
        this.spriteById.set(e.id, entry);
        this.entityLayer.addChild(anim.root);
      }
      const n = pos1.get(e.id);
      const x = n ? e.x + (n.x - e.x) * frac : e.x;
      const y = n ? e.y + (n.y - e.y) * frac : e.y;
      const prev = this.lastPos.get(e.id);
      const moved = prev ? (Math.abs(x - prev.x) + Math.abs(y - prev.y)) > 0.004 : false;
      entry.anim.setMoving(moved);
      if (prev && Math.abs(x - prev.x) > 0.002) entry.anim.setFacing(x - prev.x);
      this.lastPos.set(e.id, { x, y });
      entry.anim.root.position.set(x * TILE, y * TILE);
      entry.anim.setFlags(e.fl ?? 0);
      this.updateHpBar(entry.hpbar, e.hp / Math.max(1, e.maxHp));
    }
    // entities that vanished from frames: trigger their death animation
    for (const [id, entry] of this.spriteById) {
      if (!present.has(id)) entry.anim.die();
    }
  }

  private buildReplaySprite(id: string): AnimSprite {
    const meta = this.metaById.get(id);
    const defId = meta?.defId ?? (id === "core" ? "core" : "summon");
    return new AnimSprite({
      id: meta?.uniqueId ?? defId,
      tier: meta?.tier ?? 1,
      weapon: UNIT_DMG[defId] ?? weaponForArchetype(meta?.archetype),
      unique: meta?.isUnique,
      hostileMonster: meta?.side === "invader" && !!meta.family,
    });
  }

  private updateHpBar(bar: Graphics, frac: number) {
    bar.clear();
    if (frac >= 1) return;
    const w = 22;
    bar.rect(-w / 2, -22, w, 3).fill(0x222222);
    bar.rect(-w / 2, -22, w * Math.max(0, frac), 3).fill(frac > 0.5 ? 0x66dd66 : frac > 0.25 ? 0xddcc44 : 0xdd4444);
  }

  private fxItems: { g: Graphics | Text; life: number; max: number; vx: number; vy: number; sr: number }[] = [];

  private static FX_CAP = 160;
  private addFx(g: Graphics | Text, life: number, vx: number, vy: number, sr = 0) {
    // Cap concurrent FX so big siege fights don't drown the renderer in
    // throwaway Graphics/Text (the main source of replay lag).
    if (this.fxItems.length >= DungeonView.FX_CAP) {
      const old = this.fxItems.shift();
      if (old) old.g.destroy();
    }
    this.fxLayer.addChild(g);
    this.fxItems.push({ g, life, max: life, vx, vy, sr });
  }

  /** Expanding ring burst. */
  private burst(x: number, y: number, color: number, r: number, life: number) {
    const g = new Graphics();
    g.circle(0, 0, r).stroke({ width: 2.5, color });
    g.position.set(x, y);
    this.addFx(g, life, 0, 0, 0.14);
  }

  /** A spray of small particles. */
  private spark(x: number, y: number, color: number, n: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const g = new Graphics();
      g.rect(-1.5, -1.5, 3, 3).fill(color);
      g.position.set(x, y);
      this.addFx(g, 14, Math.cos(a) * spread, Math.sin(a) * spread, 0);
    }
  }

  private handleFxEvent(ev: { type: string; x?: number; y?: number; amount?: number; sourceId?: string; targetId?: string; data?: Record<string, unknown> }) {
    // resolve a screen position from the event or from a tracked entity
    let px: number | undefined;
    let py: number | undefined;
    if (ev.x !== undefined && ev.y !== undefined) { px = ev.x * TILE; py = ev.y * TILE; }
    else {
      const p = (ev.targetId && this.lastPos.get(ev.targetId)) || (ev.sourceId && this.lastPos.get(ev.sourceId));
      if (p) { px = p.x * TILE; py = p.y * TILE; }
    }

    if (ev.type === "hit" || ev.type === "crit") {
      if (px === undefined || py === undefined) return;
      const crit = ev.type === "crit";
      if (ev.targetId && (ev.data?.direct || ev.data?.trap)) this.spriteById.get(ev.targetId)?.anim.hurt();
      // Damage-number Text is the most expensive FX; skip it when saturated.
      if (crit || this.fxItems.length < 90) {
        const t = new Text({ text: String(ev.amount ?? 0), style: { fontSize: crit ? 16 : 11, fill: crit ? 0xffe066 : 0xffffff, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
        t.anchor.set(0.5); t.position.set(px + (Math.random() * 10 - 5), py - 14);
        this.addFx(t, crit ? 50 : 40, 0, -0.6, 0);
      }
      this.spark(px, py, crit ? 0xffe066 : 0xffffff, crit ? 4 : 2, crit ? 1.7 : 1.1);
      // Only a direct, LOS-checked attack draws a projectile / attacker lunge.
      // AoE splash, DoT ticks and thorns are not aimed shots and must not fling
      // arrows through walls.
      if (ev.sourceId && ev.data?.direct) {
        const entry = this.spriteById.get(ev.sourceId);
        const ap = this.lastPos.get(ev.sourceId);
        if (entry && ap && ev.x !== undefined && ev.y !== undefined) {
          entry.anim.attack(ev.x - ap.x);
          if (entry.anim.weaponKind !== "melee") this.spawnProjectile(ap.x, ap.y, ev.x, ev.y, entry.anim.weaponKind);
        }
      }
    } else if (ev.type === "miss" && ev.sourceId && ev.targetId) {
      const source = this.lastPos.get(ev.sourceId);
      const target = this.lastPos.get(ev.targetId);
      if (source && target) this.spriteById.get(ev.sourceId)?.anim.attack(target.x - source.x);
    } else if (ev.type === "ability" && px !== undefined && py !== undefined) {
      const effect = ev.data?.effect;
      if (ev.sourceId && playsCastPose(effect)) {
        const source = this.lastPos.get(ev.sourceId);
        this.spriteById.get(ev.sourceId)?.anim.cast(source ? px / TILE - source.x : 0);
      }
      this.drawAbility(px, py - 9, effect, ev.data?.radius);
    } else if (ev.type === "trapTrigger" && px !== undefined && py !== undefined) {
      const explode = !!ev.data?.explode;
      this.burst(px, py, explode ? 0xff7733 : 0xffaa33, explode ? 8 : 5, explode ? 26 : 18);
      this.spark(px, py, 0xffcc66, explode ? 10 : 5, explode ? 2.4 : 1.4);
    } else if (ev.type === "death" && px !== undefined && py !== undefined) {
      this.burst(px, py, 0xff5555, 8, 18);
      this.spark(px, py, 0x999999, 5, 1.3);
    } else if (ev.type === "heal" && px !== undefined && py !== undefined) {
      const t = new Text({ text: "+", style: { fontSize: 16, fill: 0x66dd88, fontWeight: "bold" } });
      t.anchor.set(0.5); t.position.set(px, py - 10);
      this.addFx(t, 36, 0, -0.5, 0);
    } else if (ev.type === "summon" && px !== undefined && py !== undefined) {
      this.burst(px, py, 0xb98cff, 5, 16);
    } else if (ev.type === "reveal" && px !== undefined && py !== undefined) {
      this.burst(px, py, 0x7fd0ff, 6, 16);
    }
  }

  private drawAbility(x: number, y: number, effect: unknown, radius: unknown) {
    const visual = abilityVisual(effect);
    if (!visual || this.fxItems.length > 128) return;
    const { color, pattern } = visual;
    const g = new Graphics();
    if (pattern === "slash") {
      g.poly([-17, 5, -6, -8, 15, -11, 6, -6, -10, 9]).fill(color);
      g.poly([-11, 6, 1, -6, 11, -8, -2, 1]).fill(0xfff5de);
    } else if (pattern === "cross") {
      g.rect(-3, -10, 6, 20).rect(-10, -3, 20, 6).fill({ color, alpha: 0.88 });
    } else if (pattern === "shards") {
      for (let i = 0; i < 5; i++) {
        const dx = (i - 2) * 6, height = i % 2 ? 8 : 14;
        g.poly([dx - 3, 6, dx - 1, -height, dx + 4, 2, dx + 2, 8]).fill({ color, alpha: 0.85 });
      }
    } else if (pattern === "spiral") {
      for (let i = 0; i < 12; i++) {
        const angle = i * 0.8, r = 3 + i;
        g.rect(Math.cos(angle) * r, Math.sin(angle) * r * 0.65, 3, 3).fill(color);
      }
    } else if (pattern === "embers") {
      this.spark(x, y, color, 6, 1.4);
      this.burst(x, y, color, 6, 16);
      return;
    } else {
      const r = typeof radius === "number" ? Math.min(32, 9 + radius * 5) : 13;
      g.ellipse(0, 0, r, r * 0.63).stroke({ width: 2, color, alpha: 0.83 });
      g.ellipse(0, 0, r * 0.74, r * 0.46).stroke({ width: 1, color, alpha: 0.52 });
    }
    g.position.set(x, y);
    this.addFx(g, 19, 0, pattern === "cross" ? -0.5 : 0, pattern === "ring" ? 0.045 : 0.01);
  }

  private spawnProjectile(sx: number, sy: number, tx: number, ty: number, kind: WeaponKind) {
    const g = new Graphics();
    const color = kind === "arcane" ? 0x9a7cff : 0xffe08a;
    if (kind === "arcane") {
      g.circle(0, 0, 4.5).fill({ color, alpha: 0.3 });
      g.circle(0, 0, 2.6).fill(color);
    } else {
      // arrow pointing toward the target
      g.poly([7, 0, -4, 2.5, -4, -2.5]).fill(color).stroke({ width: 0.5, color: 0x6a4a2a });
      g.rotation = Math.atan2(ty - sy, tx - sx);
    }
    g.position.set(sx * TILE, sy * TILE - 6);
    this.fxLayer.addChild(g);
    this.projectiles.push({ g, sx: sx * TILE, sy: sy * TILE - 6, tx: tx * TILE, ty: ty * TILE - 6, life: 0, max: 8, kind });
  }

  private updateFx(step: number) {
    for (const item of this.fxItems) {
      item.life -= step;
      item.g.x += item.vx * step;
      item.g.y += item.vy * step;
      if (item.sr) item.g.scale.set(Math.max(0.05, item.g.scale.x + item.sr * step));
      item.g.alpha = Math.max(0, item.life / item.max);
    }
    this.fxItems = this.fxItems.filter((i) => {
      if (i.life <= 0) { i.g.destroy(); return false; }
      return true;
    });
    for (const p of this.projectiles) {
      p.life += step;
      const t = Math.min(1, p.life / p.max);
      p.g.position.set(lerp2(p.sx, p.tx, t), lerp2(p.sy, p.ty, t));
      // arcane trail: only when FX isn't already saturated (avoids flooding)
      if (p.kind === "arcane" && this.fxItems.length < 120) {
        const tr = new Graphics();
        tr.circle(0, 0, 2).fill({ color: 0x9a7cff, alpha: 0.5 });
        tr.position.set(p.g.x, p.g.y);
        this.addFx(tr, 8, 0, 0, -0.06);
      }
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.life >= p.max) {
        this.spark(p.g.x, p.g.y, p.kind === "arcane" ? 0x9a7cff : 0xffe08a, 4, 1.4);
        p.g.destroy();
        return false;
      }
      return true;
    });
  }

  seekTo(cursor: number) {
    if (!this.timeline) return;
    this.cursor = Math.max(0, Math.min(this.timeline.durationTicks, cursor));
    this.endHold = 0;
    this.lastEventIdx = 0;
    for (const child of this.fxLayer.removeChildren()) child.destroy({ children: true });
    this.fxItems = [];
    this.projectiles = [];
    while (this.lastEventIdx < this.timeline.events.length && this.timeline.events[this.lastEventIdx].tick <= this.cursor) this.lastEventIdx++;
    this.renderFrameAt(this.cursor);
  }
}

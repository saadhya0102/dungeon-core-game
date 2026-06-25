// ============================================================================
// Procedural animated sprites (docs/18). Layered characters drawn with Graphics
// so they cost ~no asset space, with simple idle/move/attack/die animations.
// Detail scales with tier; uniques get an aura, crown, and banner.
// ============================================================================
import { Container, Graphics } from "pixi.js";
import { TIER_COLORS, FLAG_BERSERK, FLAG_FROZEN, FLAG_INVIS } from "../../sim/types";

export type WeaponKind = "melee" | "ranged" | "arcane";

export interface SpriteOpts {
  kind: "unit" | "enemy" | "core" | "summon";
  primaryColor: number;
  tier: number;
  unique?: boolean;
  weapon: WeaponKind;
  side: "dungeon" | "invader";
}

const ATTACK_DUR = 0.3;
const DIE_DUR = 0.55;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export class AnimSprite {
  root = new Container();
  private inner = new Container();
  private weapon = new Container();
  private aura?: Graphics;
  private t = Math.random() * 10;
  private moving = false;
  private facing = 1;
  private attackT = 0;
  private attackDir = 1;
  private dying = false;
  private dieT = 0;
  private dieDir = Math.random() < 0.5 ? -1 : 1;
  private idleSpeed = 2.2 + Math.random() * 0.6;
  private berserkRing?: Graphics;
  private frostOverlay?: Graphics;
  private flags = 0;
  dead = false;
  weaponKind: WeaponKind;

  constructor(opts: SpriteOpts) {
    this.weaponKind = opts.weapon;
    this.root.addChild(this.inner);
    if (opts.kind === "core") this.buildCore(opts);
    else this.buildCreature(opts);
    this.makeStatusFx();
  }

  private makeStatusFx() {
    const ring = new Graphics();
    ring.circle(0, -2, 16).stroke({ width: 2.5, color: 0xff3030 });
    ring.visible = false;
    this.root.addChild(ring);
    this.berserkRing = ring;
    const frost = new Graphics();
    frost.circle(0, -2, 14).fill({ color: 0x9fd8ff, alpha: 0.5 });
    frost.visible = false;
    this.root.addChild(frost);
    this.frostOverlay = frost;
  }

  setFlags(fl: number) { this.flags = fl; }

  private buildCore(opts: SpriteOpts) {
    const g = new Graphics();
    g.poly([0, -16, 16, 0, 0, 16, -16, 0]).fill(0xb98cff).stroke({ width: 2, color: 0xe0c9ff });
    g.poly([0, -8, 8, 0, 0, 8, -8, 0]).fill(0xe9dcff);
    this.inner.addChild(g);
    const a = new Graphics();
    a.circle(0, 0, 22).fill({ color: 0xb98cff, alpha: 0.22 });
    this.aura = a;
    this.root.addChildAt(a, 0);
    void opts;
  }

  private buildCreature(opts: SpriteOpts) {
    const scale = Math.min(1.7, 0.85 + (opts.tier - 1) * 0.06) * (opts.unique ? 1.15 : 1);
    const col = opts.primaryColor;
    const outline = TIER_COLORS[(opts.tier as 1)] ?? 0x999999;
    const dark = shade(col, 0.6);
    const light = shade(col, 1.3);

    // Unique aura (behind everything)
    if (opts.unique) {
      const a = new Graphics();
      a.circle(0, -2, 17).fill({ color: 0xffd24a, alpha: 0.28 });
      this.aura = a;
      this.root.addChildAt(a, 0);
    }

    const body = new Graphics();
    // legs
    body.roundRect(-5, 4, 4, 7, 1).fill(dark);
    body.roundRect(1, 4, 4, 7, 1).fill(dark);
    // torso
    body.roundRect(-6, -6, 12, 12, 3).fill(col).stroke({ width: 1.5, color: outline });
    // chest emblem (higher tiers)
    if (opts.tier >= 3) body.poly([0, -4, 3, 0, 0, 4, -3, 0]).fill(light);
    // shoulder pads (mid+)
    if (opts.tier >= 5) {
      body.roundRect(-9, -6, 4, 5, 1).fill(light).stroke({ width: 1, color: outline });
      body.roundRect(5, -6, 4, 5, 1).fill(light).stroke({ width: 1, color: outline });
    }
    // head
    body.circle(0, -11, 5).fill(light).stroke({ width: 1.5, color: outline });
    // visor / eyes
    body.rect(-3, -12, 6, 2).fill(dark);
    // crown for uniques
    if (opts.unique) {
      body.poly([-5, -15, -3, -19, -1, -15, 1, -19, 3, -15, 5, -19, 5, -15]).fill(0xffd24a).stroke({ width: 0.5, color: 0x5a4a10 });
    }
    this.inner.addChild(body);

    // Shield on left for melee bruisers (mid+)
    if (opts.weapon === "melee" && opts.tier >= 3) {
      const sh = new Graphics();
      sh.roundRect(-12, -3, 5, 9, 2).fill(shade(outline, 1.1)).stroke({ width: 1, color: dark });
      this.inner.addChild(sh);
    }

    // Weapon (right hand) in its own pivoted container for swinging
    this.weapon.position.set(7, 0);
    this.drawWeapon(opts, outline, light);
    this.inner.addChild(this.weapon);

    // Banner for uniques
    if (opts.unique) {
      const ban = new Graphics();
      ban.rect(-11, -18, 1.5, 16).fill(0x8a6a20);
      ban.poly([-10, -18, -3, -16, -10, -12]).fill(0xd23d3d).stroke({ width: 0.5, color: 0xffd24a });
      this.inner.addChild(ban);
    }

    this.inner.scale.set(scale);
    this.baseScale = scale;
  }

  private baseScale = 1;

  private drawWeapon(opts: SpriteOpts, outline: number, light: number) {
    const g = new Graphics();
    if (opts.weapon === "ranged") {
      // bow
      g.moveTo(0, -7).quadraticCurveTo(7, 0, 0, 7).stroke({ width: 1.5, color: 0x9a6a3a });
      g.moveTo(0, -7).lineTo(0, 7).stroke({ width: 0.8, color: 0xddddee });
    } else if (opts.weapon === "arcane") {
      // staff + orb
      g.rect(-0.8, -10, 1.6, 18).fill(0x6a4a2a);
      g.circle(0, -11, 3.2).fill({ color: light, alpha: 0.95 }).stroke({ width: 1, color: outline });
    } else {
      // sword
      g.rect(-1, -12, 2, 13).fill(0xdfe3ee).stroke({ width: 0.5, color: outline });
      g.rect(-3, 0, 6, 1.6).fill(0x8a6a20); // guard
      g.rect(-1, 1.6, 2, 3).fill(0x5a4a30); // hilt
    }
    this.weapon.addChild(g);
  }

  setMoving(m: boolean) { this.moving = m; }
  setFacing(dx: number) { if (dx > 0.01) this.facing = 1; else if (dx < -0.01) this.facing = -1; }
  attack(dx: number, _dy: number) { this.attackT = ATTACK_DUR; this.attackDir = dx >= 0 ? 1 : -1; this.setFacing(dx); }
  die() { if (!this.dying) { this.dying = true; this.dieT = 0; } }

  update(dt: number) {
    if (this.dead) return;
    this.t += dt;
    const t = this.t;

    if (this.dying) {
      this.dieT += dt;
      const q = Math.min(1, this.dieT / DIE_DUR);
      this.root.alpha = 1 - q;
      this.inner.rotation = q * 0.8 * this.dieDir;
      this.inner.position.y = q * 6;
      this.inner.scale.set(this.baseScale * (1 - q * 0.4));
      if (q >= 1) this.dead = true;
      return;
    }

    // idle breathing + bob
    const amp = this.moving ? 1.8 : 0.8;
    const speed = this.moving ? this.idleSpeed * 2 : this.idleSpeed;
    let bob = Math.sin(t * speed) * amp;
    this.inner.scale.x = this.baseScale * this.facing;
    this.inner.scale.y = this.baseScale * (1 + Math.sin(t * this.idleSpeed) * 0.04);

    // attack lunge + weapon swing
    let lunge = 0;
    let swing = 0;
    if (this.attackT > 0) {
      this.attackT -= dt;
      const p = 1 - Math.max(0, this.attackT) / ATTACK_DUR; // 0..1
      const pulse = Math.sin(p * Math.PI);
      lunge = pulse * 4 * this.attackDir;
      swing = this.weaponKind === "melee" ? -pulse * 1.4 : pulse * 0.5;
    }
    this.inner.position.x = lunge;
    this.inner.position.y = bob;
    this.inner.rotation = this.moving ? Math.sin(t * speed) * 0.05 : lerp(this.inner.rotation, 0, 0.2);
    this.weapon.rotation = swing * this.attackDir;

    if (this.aura) {
      this.aura.scale.set(1 + Math.sin(t * 2) * 0.08);
      this.aura.alpha = 0.22 + Math.sin(t * 2) * 0.08;
    }

    // status visuals
    if (this.berserkRing) this.berserkRing.visible = (this.flags & FLAG_BERSERK) !== 0;
    if (this.frostOverlay) this.frostOverlay.visible = (this.flags & FLAG_FROZEN) !== 0;
    this.root.alpha = (this.flags & FLAG_INVIS) ? 0.45 : 1;
  }
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

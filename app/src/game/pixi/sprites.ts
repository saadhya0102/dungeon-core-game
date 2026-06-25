// ============================================================================
// Procedural animated sprites (docs/18). Layered characters drawn with Graphics
// so they cost ~no asset space, with simple idle/move/attack/die animations.
// Each family (dungeon) and archetype (invader) gets a distinct silhouette so
// creatures read as unique at a glance. Detail scales with tier; uniques get an
// aura, crown, and banner.
// ============================================================================
import { Container, Graphics } from "pixi.js";
import { TIER_COLORS, FLAG_BERSERK, FLAG_FROZEN, FLAG_INVIS } from "../../sim/types";
import type { Family, Archetype } from "../../sim/types";

export type WeaponKind = "melee" | "ranged" | "arcane";

export interface SpriteOpts {
  kind: "unit" | "enemy" | "core" | "summon";
  primaryColor: number;
  tier: number;
  unique?: boolean;
  weapon: WeaponKind;
  side: "dungeon" | "invader";
  family?: Family;
  archetype?: Archetype;
}

const ATTACK_DUR = 0.3;
const DIE_DUR = 0.55;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Derived palette passed to every silhouette builder.
interface Pal { col: number; dark: number; light: number; outline: number; }

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
    else if (opts.kind === "summon") this.buildSummon(opts);
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

  // Small, simple minion blob for summoned creatures.
  private buildSummon(opts: SpriteOpts) {
    const pal = this.palette(opts);
    const body = new Graphics();
    body.ellipse(0, 1, 6.5, 5.5).fill(pal.col).stroke({ width: 1.2, color: pal.outline });
    body.ellipse(0, -2, 4.5, 3).fill(pal.light);
    body.circle(-2, -1, 1).fill(0x161616);
    body.circle(2, -1, 1).fill(0x161616);
    body.circle(-3.5, 5.5, 1.6).fill(pal.dark);
    body.circle(3.5, 5.5, 1.6).fill(pal.dark);
    this.inner.addChild(body);
    this.inner.addChild(this.weapon);
    const scale = 0.7 + (opts.tier - 1) * 0.02;
    this.inner.scale.set(scale);
    this.baseScale = scale;
  }

  private palette(opts: SpriteOpts): Pal {
    return {
      col: opts.primaryColor,
      dark: shade(opts.primaryColor, 0.6),
      light: shade(opts.primaryColor, 1.3),
      outline: TIER_COLORS[(opts.tier as 1)] ?? 0x999999,
    };
  }

  private buildCreature(opts: SpriteOpts) {
    const scale = Math.min(1.7, 0.85 + (opts.tier - 1) * 0.06) * (opts.unique ? 1.15 : 1);
    const pal = this.palette(opts);

    // Unique aura (behind everything)
    if (opts.unique) {
      const a = new Graphics();
      a.circle(0, -2, 17).fill({ color: 0xffd24a, alpha: 0.28 });
      this.aura = a;
      this.root.addChildAt(a, 0);
    }

    const body = new Graphics();
    this.weapon.position.set(7, 0);

    // Distinct silhouette by side + family/archetype. Each builder draws into
    // `body` (and the swinging `weapon` container) and returns the [x, y] of the
    // head top, used to place the unique crown.
    const head = opts.side === "invader"
      ? this.buildAdventurer(opts, pal, body)
      : this.buildMonster(opts, pal, body);

    this.inner.addChild(body);
    this.inner.addChild(this.weapon);

    if (opts.unique) {
      this.addCrown(body, head[0], head[1]);
      this.addBanner();
    }

    this.inner.scale.set(scale);
    this.baseScale = scale;
  }

  private baseScale = 1;

  // ---- Dungeon monsters (by family) --------------------------------------
  private buildMonster(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    switch (opts.family) {
      case "undead": return this.drawUndead(opts, pal, body);
      case "beast": return this.drawBeast(opts, pal, body);
      case "demon": return this.drawDemon(opts, pal, body);
      case "construct": return this.drawConstruct(opts, pal, body);
      case "aberration": return this.drawAberration(opts, pal, body);
      case "goblinoid":
      default: return this.drawGoblinoid(opts, pal, body);
    }
  }

  // ---- Invader adventurers (by archetype) --------------------------------
  private buildAdventurer(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    switch (opts.archetype) {
      case "archer": return this.drawArcher(opts, pal, body);
      case "mage": return this.drawMage(opts, pal, body);
      case "rogue": return this.drawRogue(opts, pal, body);
      case "warrior":
      default: return this.drawWarrior(opts, pal, body);
    }
  }

  // ---- Family silhouettes ------------------------------------------------
  private drawGoblinoid(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // legs
    body.roundRect(-5, 5, 4, 6, 1).fill(pal.dark);
    body.roundRect(1, 5, 4, 6, 1).fill(pal.dark);
    // arm
    body.roundRect(-8, -3, 3, 6, 1.5).fill(pal.dark);
    // hunched, slightly forward torso
    body.roundRect(-5, -4, 11, 10, 4).fill(pal.col).stroke({ width: 1.5, color: pal.outline });
    if (opts.tier >= 4) body.poly([1, -2, 3, 1, 1, 4, -1, 1]).fill(pal.light); // emblem
    const hx = 1, hy = -9;
    // head (shifted forward)
    body.circle(hx, hy, 4.5).fill(pal.light).stroke({ width: 1.5, color: pal.outline });
    // big pointy ears
    body.poly([hx + 3, hy - 2, hx + 9, hy - 4, hx + 3, hy + 2]).fill(pal.light).stroke({ width: 1, color: pal.outline });
    body.poly([hx - 4, hy - 2, hx - 10, hy - 4, hx - 4, hy + 2]).fill(pal.light).stroke({ width: 1, color: pal.outline });
    // eyes
    body.circle(hx - 1.4, hy - 0.5, 0.9).fill(0xffe14d);
    body.circle(hx + 1.6, hy - 0.5, 0.9).fill(0xffe14d);
    // snaggle tooth
    body.poly([hx - 0.4, hy + 3, hx + 0.8, hy + 3, hx + 0.2, hy + 5.6]).fill(0xfff4d0);
    // crude weapon
    this.weapon.position.set(7, 0);
    this.drawWeapon(opts, pal);
    return [hx, hy - 4.5];
  }

  private drawUndead(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    const bone = 0xe9e9e2;
    const boneShade = 0x9a9a90;
    // thin legs
    body.rect(-2.8, 4, 1.6, 7).fill(bone);
    body.rect(1.2, 4, 1.6, 7).fill(bone);
    // pelvis + spine
    body.roundRect(-3.5, 3.5, 7, 2, 1).fill(bone).stroke({ width: 0.6, color: boneShade });
    body.rect(-0.8, -6, 1.6, 10).fill(boneShade);
    // ribcage lines (tint with tier outline so rank still reads)
    for (let i = 0; i < 4; i++) {
      const y = -5 + i * 2.1;
      body.moveTo(-3.6, y).quadraticCurveTo(0, y + 1.4, 3.6, y).stroke({ width: 1, color: i % 2 ? pal.outline : boneShade });
    }
    // thin arms
    body.rect(-6, -5, 1.5, 8).fill(bone);
    body.rect(4.5, -5, 1.5, 8).fill(bone);
    const hy = -11;
    // skull (whitish/grey)
    body.circle(0, hy, 4.6).fill(bone).stroke({ width: 1.2, color: pal.outline });
    body.poly([-2.4, hy + 3, 2.4, hy + 3, 1.8, hy + 5, -1.8, hy + 5]).fill(bone).stroke({ width: 0.6, color: boneShade }); // jaw
    // eye sockets
    body.circle(-1.9, hy - 0.4, 1.3).fill(0x111111);
    body.circle(1.9, hy - 0.4, 1.3).fill(0x111111);
    body.rect(-0.5, hy + 1.4, 1, 1.4).fill(0x111111); // nasal
    this.weapon.position.set(7, 0);
    this.drawWeapon(opts, pal);
    return [0, hy - 4.6];
  }

  private drawBeast(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // four legs (back pair + front pair)
    for (const lx of [-6, -3, 3, 6]) body.roundRect(lx, 3, 1.8, 7, 0.6).fill(pal.dark);
    // tail
    body.moveTo(-8, -1).quadraticCurveTo(-13, -3, -12, -8).stroke({ width: 2, color: pal.dark });
    body.poly([-12.6, -7, -10, -10, -11, -6]).fill(pal.light);
    // low horizontal body (no humanoid torso)
    body.ellipse(0, 0, 9, 5).fill(pal.col).stroke({ width: 1.5, color: pal.outline });
    if (opts.tier >= 3) body.ellipse(-2, -1, 3, 2).fill(pal.light); // back marking
    // wings for high-tier flyers
    if (opts.tier >= 6) {
      body.poly([-1, -4, -9, -13, 2, -6]).fill({ color: pal.light, alpha: 0.9 }).stroke({ width: 1, color: pal.outline });
      body.poly([1, -4, 8, -14, 4, -6]).fill({ color: pal.light, alpha: 0.9 }).stroke({ width: 1, color: pal.outline });
    }
    // fanged head at front
    const hx = 9, hy = -3;
    body.circle(hx, hy, 4).fill(pal.light).stroke({ width: 1.5, color: pal.outline });
    body.poly([hx - 1, hy - 2.5, hx + 1, hy - 7, hx + 2.6, hy - 2.5]).fill(pal.light).stroke({ width: 0.8, color: pal.outline }); // ear
    body.circle(hx + 1, hy - 0.6, 0.9).fill(0xffe14d); // eye
    body.poly([hx + 1.8, hy + 2.8, hx + 2.8, hy + 2.8, hx + 2.3, hy + 5]).fill(0xfff4d0); // fang
    body.poly([hx + 3.2, hy + 2.8, hx + 4.2, hy + 2.8, hx + 3.7, hy + 4.8]).fill(0xfff4d0);
    // claw "weapon" at the head so the swing reads as a bite/swipe
    this.weapon.position.set(hx, hy + 3);
    const claw = new Graphics();
    claw.poly([0, 0, 3.5, 1, 0, 2]).fill(0xfff4d0).stroke({ width: 0.5, color: pal.outline });
    this.weapon.addChild(claw);
    return [hx, hy - 4];
  }

  private drawDemon(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    const fire = 0xff5a3c;
    // legs
    body.roundRect(-5, 6, 4, 7, 1).fill(pal.dark);
    body.roundRect(1, 6, 4, 7, 1).fill(pal.dark);
    // tail with arrow tip
    body.moveTo(5, 9).quadraticCurveTo(12, 9, 11, 2).stroke({ width: 2, color: pal.dark });
    body.poly([10.5, 3, 14, 0, 11, -0.5]).fill(fire);
    // tall torso with fiery rim
    body.roundRect(-6, -8, 12, 14, 3).fill(pal.col).stroke({ width: 1.6, color: fire });
    if (opts.tier >= 4) body.poly([0, -5, 3, -1, 0, 3, -3, -1]).fill(fire); // chest sigil
    // spiked shoulders
    body.poly([-6, -8, -11, -12, -6, -3]).fill(pal.dark).stroke({ width: 1, color: fire });
    body.poly([6, -8, 11, -12, 6, -3]).fill(pal.dark).stroke({ width: 1, color: fire });
    const hy = -13;
    // head
    body.circle(0, hy, 4.5).fill(pal.light).stroke({ width: 1.5, color: fire });
    // two horns
    body.poly([-3, hy - 3, -6.5, hy - 10, -1, hy - 4]).fill(pal.dark).stroke({ width: 0.5, color: fire });
    body.poly([3, hy - 3, 6.5, hy - 10, 1, hy - 4]).fill(pal.dark).stroke({ width: 0.5, color: fire });
    // glowing eyes
    body.circle(-1.8, hy, 1).fill(fire);
    body.circle(1.8, hy, 1).fill(fire);
    this.weapon.position.set(7, 0);
    this.drawWeapon(opts, pal);
    return [0, hy - 4.5];
  }

  private drawConstruct(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    const glow = 0xfff2a0;
    // blocky legs
    body.rect(-5, 6, 4, 7).fill(pal.dark).stroke({ width: 1, color: pal.outline });
    body.rect(1, 6, 4, 7).fill(pal.dark).stroke({ width: 1, color: pal.outline });
    // angular armored torso
    body.rect(-7, -6, 14, 12).fill(pal.col).stroke({ width: 1.6, color: pal.outline });
    body.rect(-7, -6, 14, 3).fill(pal.light); // shoulder plate
    // mechanical plate seams
    body.moveTo(-7, -1).lineTo(7, -1).stroke({ width: 1, color: pal.dark });
    body.moveTo(0, -1).lineTo(0, 6).stroke({ width: 1, color: pal.dark });
    if (opts.tier >= 5) body.rect(-7, 3, 14, 1.4).fill(pal.dark); // extra plate
    // blocky arms
    body.rect(-10, -5, 3, 8).fill(pal.dark).stroke({ width: 1, color: pal.outline });
    // chest core glow
    body.circle(0, 1, 1.8).fill(glow);
    const hy = -11;
    // blocky head + single glowing eye
    body.rect(-4, hy - 4, 8, 8).fill(pal.light).stroke({ width: 1.5, color: pal.outline });
    body.circle(0, hy, 2.2).fill(glow);
    body.circle(0, hy, 1).fill(0xffffff);
    this.weapon.position.set(8, 0);
    this.drawWeapon(opts, pal);
    return [0, hy - 4];
  }

  private drawAberration(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // amorphous blob (no normal limbs)
    body.ellipse(0, -2, 8, 9).fill(pal.col).stroke({ width: 1.5, color: pal.outline });
    body.circle(-6, -4, 3).fill(pal.col).stroke({ width: 1, color: pal.outline });
    body.circle(6, -5, 2.6).fill(pal.col).stroke({ width: 1, color: pal.outline });
    // tentacles
    body.moveTo(-4, 5).quadraticCurveTo(-8, 11, -3, 13).stroke({ width: 2.6, color: pal.dark });
    body.moveTo(0, 6).quadraticCurveTo(2, 12, -0.5, 14).stroke({ width: 2.6, color: pal.dark });
    body.moveTo(4, 5).quadraticCurveTo(8, 11, 3, 13).stroke({ width: 2.6, color: pal.dark });
    // large central eye
    body.circle(0, -3, 4).fill(0xf5f5ff).stroke({ width: 1, color: pal.outline });
    body.circle(0, -3, 2).fill(0x222b44);
    body.circle(0.9, -3.9, 0.8).fill(0xffffff);
    // extra eyes for higher tiers
    if (opts.tier >= 5) {
      body.circle(-5, -4, 1.4).fill(0xf5f5ff).stroke({ width: 0.6, color: pal.outline });
      body.circle(-5, -4, 0.7).fill(0x222b44);
      body.circle(5, -5, 1.2).fill(0xf5f5ff).stroke({ width: 0.6, color: pal.outline });
      body.circle(5, -5, 0.6).fill(0x222b44);
    }
    // lashing tentacle as the "weapon" so attacks swing
    this.weapon.position.set(6, 0);
    const lash = new Graphics();
    lash.moveTo(0, 0).quadraticCurveTo(5, 2, 8, -3).stroke({ width: 2.2, color: pal.dark });
    this.weapon.addChild(lash);
    return [0, -11];
  }

  // ---- Adventurer silhouettes -------------------------------------------
  private drawWarrior(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // legs
    body.roundRect(-5, 5, 4, 7, 1).fill(pal.dark);
    body.roundRect(1, 5, 4, 7, 1).fill(pal.dark);
    // bulky armored torso
    body.roundRect(-7, -6, 14, 12, 3).fill(pal.col).stroke({ width: 1.6, color: pal.outline });
    body.rect(-7, -6, 14, 3).fill(pal.light); // chest plate
    body.rect(-7, 3, 14, 2).fill(pal.dark); // belt
    if (opts.tier >= 4) body.poly([0, -4, 2.5, -1, 0, 2, -2.5, -1]).fill(pal.light); // crest
    // pauldrons
    body.roundRect(-10, -7, 5, 5, 2).fill(pal.light).stroke({ width: 1, color: pal.outline });
    body.roundRect(5, -7, 5, 5, 2).fill(pal.light).stroke({ width: 1, color: pal.outline });
    const hy = -11;
    // helmeted head
    body.circle(0, hy, 4.5).fill(pal.light).stroke({ width: 1.5, color: pal.outline });
    body.rect(-3, hy - 1, 6, 2).fill(pal.dark); // visor
    // shield on left arm
    const sh = new Graphics();
    sh.roundRect(-13, -4, 6, 11, 2).fill(shade(pal.outline, 1.05)).stroke({ width: 1.2, color: pal.dark });
    sh.moveTo(-10, -3).lineTo(-10, 5).stroke({ width: 0.8, color: pal.dark });
    this.inner.addChild(sh);
    // sword
    this.weapon.position.set(8, 0);
    this.addSword(pal);
    return [0, hy - 4.5];
  }

  private drawArcher(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // slim legs
    body.roundRect(-3.5, 5, 3, 7, 1).fill(pal.dark);
    body.roundRect(0.5, 5, 3, 7, 1).fill(pal.dark);
    // slim torso / leather
    body.roundRect(-4, -6, 8, 12, 3).fill(pal.col).stroke({ width: 1.4, color: pal.outline });
    body.moveTo(-3, -5).lineTo(3, 4).stroke({ width: 1, color: pal.dark }); // strap
    // quiver on back
    body.rect(-7.5, -8, 3, 9).fill(pal.dark).stroke({ width: 1, color: pal.outline });
    const arrows = opts.tier >= 4 ? 4 : 3;
    for (let i = 0; i < arrows; i++) body.rect(-7.2 + i * 0.9, -10, 0.6, 3).fill(0xddddee);
    const hy = -11;
    // head
    body.circle(0, hy, 4).fill(pal.light).stroke({ width: 1.4, color: pal.outline });
    body.circle(-1.2, hy - 0.4, 0.8).fill(0x222222);
    body.circle(1.2, hy - 0.4, 0.8).fill(0x222222);
    // bow
    this.weapon.position.set(7, 0);
    this.addBow();
    return [0, hy - 4];
  }

  private drawMage(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    const hy = -12;
    // triangular robe
    body.poly([0, -4, 8, 12, -8, 12]).fill(pal.col).stroke({ width: 1.5, color: pal.outline });
    body.moveTo(-8, 12).lineTo(8, 12).stroke({ width: 1, color: pal.light });
    if (opts.tier >= 4) body.poly([0, 0, 2, 4, 0, 8, -2, 4]).fill(pal.light); // robe sigil
    // head
    body.circle(0, hy, 3.8).fill(pal.light).stroke({ width: 1, color: pal.outline });
    // pointed wizard hat
    body.poly([-5, hy - 1, 5, hy - 1, 0, hy - 12]).fill(pal.dark).stroke({ width: 1, color: pal.outline });
    body.rect(-6, hy - 1, 12, 1.6).fill(pal.dark); // brim
    body.poly([0, hy - 5, 1.2, hy - 7, 0, hy - 9, -1.2, hy - 7]).fill(0xffe680); // hat star
    // beard
    body.poly([-2, hy + 3, 2, hy + 3, 0, hy + 7]).fill(0xeeeeee);
    // staff with glowing orb
    this.weapon.position.set(7, 2);
    this.addStaff(pal);
    return [0, hy - 12];
  }

  private drawRogue(opts: SpriteOpts, pal: Pal, body: Graphics): number[] {
    // crouched slim legs
    body.roundRect(-4, 5, 3.5, 6, 1).fill(pal.dark);
    body.roundRect(0.5, 5, 3.5, 6, 1).fill(pal.dark);
    // cloak body
    body.poly([-6, -6, 6, -6, 8, 8, -8, 8]).fill(pal.col).stroke({ width: 1.5, color: pal.outline });
    if (opts.tier >= 4) body.moveTo(0, -5).lineTo(0, 7).stroke({ width: 0.8, color: pal.dark }); // cloak seam
    const hy = -10;
    // hood (point over head)
    body.poly([-5, hy + 3, 0, hy - 6, 5, hy + 3]).fill(pal.dark).stroke({ width: 1.2, color: pal.outline });
    body.circle(0, hy + 1, 2.6).fill(0x141414); // face shadow
    body.circle(-1, hy + 0.6, 0.6).fill(0xffe680); // glinting eyes
    body.circle(1, hy + 0.6, 0.6).fill(0xffe680);
    // twin daggers: one swings, one held in the off hand
    this.weapon.position.set(6, 2);
    this.addDagger(pal);
    const off = new Graphics();
    off.rect(-9, -1, 2, 6).fill(0xdfe3ee).stroke({ width: 0.4, color: pal.outline });
    off.rect(-9.8, -2, 3.6, 1.4).fill(pal.dark);
    this.inner.addChild(off);
    return [0, hy - 6];
  }

  // ---- Crown / banner for uniques ---------------------------------------
  private addCrown(body: Graphics, x: number, y: number) {
    body.poly([x - 5, y, x - 3, y - 4, x - 1, y, x + 1, y - 4, x + 3, y, x + 5, y - 4, x + 5, y])
      .fill(0xffd24a).stroke({ width: 0.5, color: 0x5a4a10 });
  }

  private addBanner() {
    const ban = new Graphics();
    ban.rect(-12, -19, 1.5, 17).fill(0x8a6a20);
    ban.poly([-11, -19, -4, -17, -11, -13]).fill(0xd23d3d).stroke({ width: 0.5, color: 0xffd24a });
    this.inner.addChild(ban);
  }

  // ---- Weapons (added to the swinging `weapon` container) ----------------
  private drawWeapon(opts: SpriteOpts, pal: Pal) {
    if (opts.weapon === "ranged") this.addBow();
    else if (opts.weapon === "arcane") this.addStaff(pal);
    else this.addSword(pal);
  }

  private addSword(pal: Pal) {
    const g = new Graphics();
    g.rect(-1, -12, 2, 13).fill(0xdfe3ee).stroke({ width: 0.5, color: pal.outline });
    g.rect(-3, 0, 6, 1.6).fill(0x8a6a20); // guard
    g.rect(-1, 1.6, 2, 3).fill(0x5a4a30); // hilt
    this.weapon.addChild(g);
  }

  private addBow() {
    const g = new Graphics();
    g.moveTo(0, -8).quadraticCurveTo(8, 0, 0, 8).stroke({ width: 1.6, color: 0x9a6a3a });
    g.moveTo(0, -8).lineTo(0, 8).stroke({ width: 0.8, color: 0xddddee });
    this.weapon.addChild(g);
  }

  private addStaff(pal: Pal) {
    const g = new Graphics();
    g.rect(-0.8, -10, 1.6, 19).fill(0x6a4a2a);
    g.circle(0, -11, 3.4).fill({ color: pal.light, alpha: 0.95 }).stroke({ width: 1, color: pal.outline });
    g.circle(0, -11, 1.5).fill(0xffffff);
    this.weapon.addChild(g);
  }

  private addDagger(pal: Pal) {
    const g = new Graphics();
    g.rect(-1, -9, 2, 8).fill(0xdfe3ee).stroke({ width: 0.4, color: pal.outline });
    g.rect(-2.4, -1, 4.8, 1.4).fill(pal.dark);
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

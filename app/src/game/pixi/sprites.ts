import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { FLAG_BERSERK, FLAG_FROZEN, FLAG_INVIS } from "../../sim/types";
import { characterSheet, FRAME_COUNT, FRAME_SIZE, FRAMES } from "../art/pixels";
import type { CharacterClip } from "../art/pixels";

export type WeaponKind = "melee" | "ranged" | "arcane";

interface SpriteOptions {
  id: string;
  tier: number;
  weapon: WeaponKind;
  unique?: boolean;
  hostileMonster?: boolean;
}

const textures = new Map<string, Texture[]>();

function characterTextures(id: string): Texture[] {
  const existing = textures.get(id);
  if (existing) return existing;
  const sheet = characterSheet(id);
  if (!sheet) return [];
  const base = Texture.from(sheet.canvas);
  base.source.scaleMode = "nearest";
  const frames = Array.from({ length: FRAME_COUNT }, (_, index) =>
    new Texture({ source: base.source, frame: new Rectangle(FRAME_SIZE * index, 0, FRAME_SIZE, FRAME_SIZE) }));
  textures.set(id, frames);
  return frames;
}

export class AnimSprite {
  readonly root = new Container();
  readonly weaponKind: WeaponKind;
  private readonly sprite: Sprite;
  private readonly frames: Texture[];
  private readonly size: number;
  private readonly shadow: Graphics;
  private readonly marker: Graphics;
  private facing = 1;
  private moving = false;
  private action: CharacterClip = "idle";
  private elapsed = Math.random() * 1.1;
  private birth = 0;
  private flags = 0;
  private flash = 0;
  dead = false;

  constructor(opts: SpriteOptions) {
    this.weaponKind = opts.weapon;
    this.frames = characterTextures(opts.id);
    this.size = (opts.id === "summon" ? 0.76 : 0.98 + (opts.tier - 1) * 0.028) * (opts.unique ? 1.07 : 1);
    this.shadow = new Graphics().ellipse(0, 5, 11 * this.size, 3).fill({ color: 0x080a12, alpha: 0.52 });
    this.marker = new Graphics();
    this.sprite = new Sprite(this.frames[0] ?? Texture.EMPTY);
    this.sprite.anchor.set(0.5, 36 / FRAME_SIZE);
    this.sprite.scale.set(this.size);
    this.sprite.roundPixels = true;
    if (opts.id === "core" || opts.unique || opts.hostileMonster) {
      const color = opts.id === "core" ? 0xa377e0 : opts.unique ? 0xf9cc70 : 0xe97d6a;
      this.root.addChild(new Graphics().ellipse(0, 4, 14, 5).stroke({ width: 1, color, alpha: 0.8 }));
    }
    this.root.addChild(this.shadow, this.marker, this.sprite);
  }

  setFlags(flags: number) {
    if (this.flags === flags) return;
    this.flags = flags;
    this.marker.clear();
    if (flags & FLAG_BERSERK) this.marker.ellipse(0, 5, 14, 7).stroke({ width: 1.5, color: 0xfd574b });
    if (flags & FLAG_FROZEN) this.marker.ellipse(0, -6, 14, 16).fill({ color: 0x9bdbff, alpha: 0.35 });
  }

  setMoving(value: boolean) { this.moving = value; }
  setFacing(dx: number) { if (Math.abs(dx) > 0.005) this.facing = Math.sign(dx); }
  spawn() { this.birth = 0.14; this.root.alpha = 0; }
  attack(dx: number) { this.setFacing(dx); this.play("attack"); }
  cast(dx = 0) { this.setFacing(dx); this.play("ability"); }
  hurt() {
    this.flash = 0.12;
    if (this.action === "idle" || this.action === "walk") this.play("hit");
  }

  die() { if (this.action !== "defeat") this.play("defeat"); }

  private play(clip: CharacterClip) {
    if (this.dead || this.action === "defeat" || (this.action === "ability" && clip === "attack")) return;
    this.action = clip;
    this.elapsed = 0;
  }

  update(dt: number) {
    if (this.dead) return;
    this.elapsed += dt;
    this.birth = Math.max(0, this.birth - dt);
    this.flash = Math.max(0, this.flash - dt);

    const locomotion: CharacterClip = this.moving ? "walk" : "idle";
    const previous = FRAMES[this.action];
    if (this.action === "defeat" && this.elapsed >= previous.count / previous.fps) {
      this.dead = true;
      this.root.visible = false;
      return;
    }
    if (this.action !== locomotion && (this.action === "idle" || this.action === "walk" || this.elapsed >= previous.count / previous.fps)) {
      this.action = locomotion;
      this.elapsed = 0;
    }
    const clip = FRAMES[this.action];
    const frame = Math.floor(this.elapsed * clip.fps) % clip.count;
    const texture = this.frames[clip.start + frame];
    if (texture && this.sprite.texture !== texture) this.sprite.texture = texture;
    this.sprite.scale.x = this.facing * this.size;
    this.sprite.tint = this.flash > 0 ? 0xffb9aa : this.flags & FLAG_FROZEN ? 0xaaddff : 0xffffff;
    this.root.alpha = (1 - this.birth / 0.14) * (this.flags & FLAG_INVIS ? 0.46 : 1);
    if (this.action === "defeat") this.shadow.alpha = Math.max(0, 1 - this.elapsed * 1.7);
  }
}

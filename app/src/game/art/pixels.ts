import type { CharacterDesign } from "./characters";
import { characterDesign } from "./characters";

export const FRAME_SIZE = 48;
export const FRAMES = {
  idle: { start: 0, count: 4, fps: 3 },
  walk: { start: 4, count: 6, fps: 12 },
  attack: { start: 10, count: 5, fps: 15 },
  ability: { start: 15, count: 6, fps: 13 },
  hit: { start: 21, count: 3, fps: 14 },
  defeat: { start: 24, count: 6, fps: 11 },
} as const;
export type CharacterClip = keyof typeof FRAMES;
export const FRAME_COUNT = 30;

const INK = 0x202031;
const PALE = 0xffeed9;
const IRON = 0xa9b8c5;
type Point = readonly [number, number];

class PixelFrame {
  readonly rgba = new Uint8ClampedArray(FRAME_SIZE * FRAME_SIZE * 4);

  pixel(x: number, y: number, color: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= FRAME_SIZE || y < 0 || y >= FRAME_SIZE) return;
    const i = 4 * (y * FRAME_SIZE + x);
    this.rgba[i] = color >> 16 & 255;
    this.rgba[i + 1] = color >> 8 & 255;
    this.rgba[i + 2] = color & 255;
    this.rgba[i + 3] = 255;
  }

  box(x: number, y: number, w: number, h: number, color: number) {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) this.pixel(x + col, y + row, color);
    }
  }

  line(a: Point, b: Point, color: number, width = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= steps; i++) {
      const half = Math.floor(width / 2);
      this.box(a[0] + dx * i / steps - half, a[1] + dy * i / steps - half, width, width, color);
    }
  }

  polygon(points: readonly Point[], color: number, outline = true) {
    const minX = Math.floor(Math.min(...points.map(([x]) => x)));
    const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
    const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
    const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i], [bx, by] = points[j];
        if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
      }
      if (inside) this.pixel(x, y, color);
    }
    if (outline) points.forEach((point, i) => this.line(point, points[(i + 1) % points.length], INK));
  }

  oval(x: number, y: number, rx: number, ry: number, color: number) {
    for (let dy = -Math.ceil(ry); dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d <= 1) this.pixel(x + dx, y + dy, d > 0.71 ? INK : color);
    }
  }
}

function rgb(hex: string) { return Number.parseInt(hex.slice(1), 16); }
function blend(a: number, b: number, part: number) {
  const channel = (shift: number) => Math.round((a >> shift & 255) * (1 - part) + (b >> shift & 255) * part);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

function palette(design: CharacterDesign) {
  const skin = rgb(design.skin), cloth = rgb(design.cloth), accent = rgb(design.accent);
  return {
    skin, cloth, accent,
    light: blend(skin, PALE, 0.34), dark: blend(skin, INK, 0.48),
    clothLight: blend(cloth, PALE, 0.28), clothDark: blend(cloth, INK, 0.43),
  };
}
type Palette = ReturnType<typeof palette>;

function pose(clip: CharacterClip, index: number) {
  const phase = clip === "walk" ? index % 6 : 0;
  const attack = clip === "attack";
  const ability = clip === "ability";
  const fall = clip === "defeat" ? index : 0;
  return {
    phase, fall, ability, index, attack,
    pace: clip === "walk" ? [0, 4, 3, 0, -4, -3][phase] : 0,
    lift: clip === "walk" ? [0, 0, 2, 1, 0, 2][phase] : 0,
    lean: attack ? [0, -2, 3, 3, 1][index] : clip === "hit" ? [-3, -2, 0][index] : -fall * 2,
    low: fall ? [0, 2, 5, 9, 13, 15][fall] : attack && index === 1 ? 1 : 0,
    blink: clip === "idle" && index === 2,
    flutter: clip === "walk" ? [0, 2, 4, 0, -2, -4][phase] : [-2, 0, 2, 0][index % 4],
  };
}
type Pose = ReturnType<typeof pose>;

function limb(p: PixelFrame, shoulder: Point, elbow: Point, hand: Point, color: number, size: number) {
  p.line(shoulder, elbow, INK, size + 2);
  p.line(elbow, hand, INK, size + 2);
  p.line(shoulder, elbow, color, size);
  p.line(elbow, hand, color, size);
}

function equipment(p: PixelFrame, design: CharacterDesign, hand: Point, action: Pose, pal: Palette) {
  const [x, y] = hand;
  const release = action.attack && action.index === 2;
  const raised = action.ability || action.attack && action.index === 1;
  const end: Point = release ? [x + 9, y - 2] : raised ? [x - 2, y - 9] : [x + 3, y - 8];
  switch (design.gear) {
    case "sword":
    case "daggers":
    case "spear": {
      const length = design.gear === "spear" ? 4 : design.gear === "daggers" ? -3 : 0;
      const tip: Point = [end[0] + (release ? length : 0), end[1] - (release ? 0 : length)];
      limb(p, [x - 2, y + 2], hand, tip, IRON, 2);
      p.pixel(tip[0], tip[1], PALE);
      p.line([x - 2, y - 2], [x + 2, y + 1], pal.accent, 2);
      if (design.gear === "daggers") p.line([x - 7, y + 4], [x - 10, y], PALE, 2);
      return;
    }
    case "axe": case "maul": case "club": case "flail":
      limb(p, [x - 2, y + 4], hand, end, 0x98684f, 2);
      if (design.gear === "flail") {
        const chain: Point = [end[0] + (release ? 5 : -3), end[1] + (release ? 0 : 4)];
        p.line(end, chain, IRON);
        p.oval(chain[0], chain[1], 4, 4, pal.accent);
      } else if (design.gear === "axe") {
        p.polygon([[end[0] - 3, end[1] - 4], [end[0] + 4, end[1] - 3], [end[0] + 6, end[1] + 2], [end[0] + 1, end[1] + 3], end], IRON);
        p.line([end[0] + 3, end[1] - 3], [end[0] + 5, end[1] + 1], PALE);
      } else {
        p.polygon([[end[0] - 4, end[1] - 3], [end[0] + 4, end[1] - 3], [end[0] + 5, end[1] + 2], [end[0] - 3, end[1] + 3]],
          design.gear === "maul" ? IRON : 0x9b6850);
        p.line([end[0] - 2, end[1] - 2], [end[0] + 3, end[1] - 2], pal.accent);
      }
      return;
    case "bow": case "sling": case "crossbow": {
      const axis = design.gear === "crossbow" ? 1 : 0;
      const upper: Point = [x - 1 + axis * 6, y - 7 + axis * 4];
      const center: Point = [x + 5, y - 1];
      const lower: Point = [x, y + 6 - axis * 3];
      limb(p, upper, center, lower, 0xc68d59, design.gear === "sling" ? 1 : 2);
      const draw: Point = [x - (action.attack && action.index <= 1 ? 5 : 1), y - 1];
      p.line(upper, draw, PALE);
      p.line(draw, lower, PALE);
      if (action.attack) p.line(draw, [x + (release ? 10 : 6), y - 1], pal.accent);
      return;
    }
    case "banner": case "staff":
      limb(p, [x - 2, y + 9], hand, [x + 1, y - 12], 0xa5805f, 2);
      if (design.gear === "staff") {
        p.oval(x + 1, y - 12, 4, 4, pal.accent);
        p.pixel(x + 1, y - 13, PALE);
      } else {
        p.polygon([[x + 1, y - 13], [x + 10, y - 12 + action.flutter / 2], [x + 8, y - 7], [x + 10, y - 5], [x, y - 6]], pal.cloth);
        p.box(x + 3, y - 11, 2, 3, pal.accent);
      }
      return;
    case "orb":
      p.oval(x + 3, y - (action.ability ? 5 : 3), 4, 4, pal.accent);
      p.pixel(x + 2, y - (action.ability ? 6 : 4), PALE);
      return;
    case "shield":
      p.polygon([[x - 3, y - 5], [x + 5, y - 6], [x + 7, y - 3], [x + 6, y + 4], [x + 1, y + 8], [x - 3, y + 4]], pal.clothLight);
      p.line([x + 1, y - 4], [x + 1, y + 4], pal.accent, 2);
      p.line([x - 1, y], [x + 4, y], pal.accent);
      return;
    case "claws":
      for (let i = 0; i < 3; i++) p.line([x, y + i - 2], [x + (release ? 5 : 3), y + i - 3], pal.light);
  }
}

function crown(p: PixelFrame, design: CharacterDesign, pal: Palette, x: number, y: number, size: number) {
  switch (design.crest) {
    case "bare": return;
    case "hood":
      p.polygon([[x - size - 2, y + 4], [x - size, y - 4], [x - 2, y - 8], [x + size - 1, y - 4], [x + size + 2, y - 1], [x - 1, y - 2], [x - 2, y + 6]], pal.cloth);
      p.line([x - size + 1, y - 3], [x - 2, y - 6], pal.clothLight, 2);
      return;
    case "visor": case "mask":
      p.polygon([[x - size - 1, y - 2], [x - size + 2, y - 6], [x + size - 1, y - 5], [x + size + 2, y - 2], [x + size + 1, y + 3], [x - size - 1, y + 4]],
        design.crest === "visor" ? pal.clothLight : pal.clothDark);
      p.line([x + 1, y], [x + size + 1, y], INK, 2);
      p.pixel(x + size, y, pal.accent);
      return;
    case "horns": case "spikes":
      for (const side of [-1, 1]) {
        p.polygon([[x + side * 2, y - 3], [x + side * (size + 5), y - (design.crest === "horns" ? 9 : 5)], [x + side * size, y - 2], [x + side * 2, y]], pal.light);
      }
      return;
    case "crown":
      p.polygon([[x - size, y - 2], [x - size, y - 7], [x - 1, y - 5], [x + 1, y - 9], [x + 3, y - 5], [x + size, y - 7], [x + size, y - 2]], pal.accent);
      p.pixel(x + 1, y - 5, PALE);
      return;
    case "halo":
      p.line([x - size, y - 7], [x + size, y - 7], pal.accent, 2);
      p.pixel(x - size - 1, y - 6, PALE);
      p.pixel(x + size + 1, y - 8, PALE);
      return;
    case "plume": case "crest":
      p.polygon([[x - 4, y - 3], [x - 8, y - 8], [x - 4, y - 7], [x + 1, y - 10], [x + size, y - 4], [x + 1, y - 4]], pal.accent);
      return;
    case "band":
      p.line([x - size, y - 3], [x + size, y - 3], pal.accent, 2);
      p.line([x - size, y - 2], [x - size - 4, y + 1], pal.clothLight, 2);
  }
}

function humanoid(p: PixelFrame, design: CharacterDesign, a: Pose, c: Palette) {
  const large = design.form === "brute" || design.form === "golem";
  const small = design.form === "goblin" || design.form === "imp";
  const robed = design.form === "hood" || design.form === "wraith";
  const skeleton = design.form === "skeleton";
  const stone = design.form === "golem";
  const x = 23 + a.lean, y = (small ? 20 : large ? 16 : 17) + a.low;
  const broad = large ? 8 : 5;
  const head = small ? 6 : 5;
  const lower = Math.min(33, y + 11);
  const thigh = Math.min(35, lower + 4);
  const reach = a.pace;
  const front: Point = [23 + 3 + reach, 36 - (reach < 0 ? a.lift : 0)];
  const back: Point = [23 - 4 - reach, 36 - (reach > 0 ? a.lift : 0)];

  if (design.form === "imp" || design.form === "devil") {
    p.polygon([[x - 4, y + 7], [x - 11, y + 2 + a.flutter], [x - 16, y + 3], [x - 14, y + 12 + a.flutter], [x - 6, y + 11]], c.clothDark);
    p.line([x - 4, y + 10], [x - 13, y + 5 + a.flutter], c.accent);
    p.line([x - 4, lower], [x - 12, lower + 6], c.dark, 2);
    p.line([x - 12, lower + 6], [x - 15, lower + 2 + a.flutter], c.skin, 2);
  }
  if (design.tier >= 5 || robed || design.champion) {
    p.polygon([[x - broad + 1, y + 4], [x - 2, y + 2], [x + 1, lower], [x - broad + a.flutter, 36], [x - broad - 5 + a.flutter, 34]], c.clothDark);
    p.line([x - broad - 1, lower], [x - broad - 3 + a.flutter, 33], c.clothLight);
  }
  if (!robed) {
    const leg = skeleton ? 2 : large ? 5 : 3;
    limb(p, [x - 3, lower], [back[0] + 2, thigh], back, skeleton ? c.dark : c.clothDark, leg);
    p.box(back[0] - 2, back[1], 5, 2, INK);
    limb(p, [x + 2, lower], [front[0] - 1, thigh], front, skeleton ? c.light : c.cloth, leg);
    p.box(front[0] - 1, front[1], large ? 6 : 5, 2, INK);
    p.box(front[0] + 1, front[1], 3, 1, c.light);
  }
  const farHand: Point = [x - broad - 2 - reach / 2, lower - (a.ability ? 6 : 0)];
  limb(p, [x - broad + 1, y + 4], [x - broad - 2, y + 8], farHand, c.dark, large ? 4 : 2);
  p.polygon([[x - broad, y + 4], [x + broad - 1, y + 3], [x + broad, y + 7], [x + 4, lower + 1],
    [x - 4, lower + 1], [x - broad, y + 8]], stone ? c.skin : c.cloth);
  p.line([x - broad + 2, y + 5], [x + 3, y + 5], stone ? c.light : c.clothLight, 2);
  if (robed) {
    p.polygon([[x - 4, lower - 2], [x + 4, lower - 2], [x + 7 + a.flutter, 36 - a.lift], [x + 1, 38],
      [x - 6 - a.flutter, 36]], c.cloth);
    p.line([x - 1, lower], [x + a.flutter, 36], c.clothLight, 2);
  }
  if (skeleton) {
    for (let i = 0; i < 3; i++) p.line([x - 3, y + 5 + i * 2], [x + 2, y + 5 + i * 2], c.skin);
  } else {
    p.line([x - 4, lower - 1], [x + 4, lower - 1], c.clothDark, 2);
    p.box(x + 1, lower - 1, 2, 2, c.accent);
  }
  if (stone || design.tier >= 6 || design.champion) {
    p.oval(x - broad + 1, y + 4, 4, 3, c.clothLight);
    p.box(x - broad - 1, y + 3, 3, 1, c.accent);
  }
  const hy = y - 1;
  if (design.form === "goblin") {
    p.polygon([[x - 3, hy - 2], [x - 11, hy - 5], [x - 7, hy + 1], [x - 4, hy + 2]], c.skin);
    p.polygon([[x + 4, hy - 3], [x + 11, hy - 5], [x + 7, hy + 2], [x + 5, hy + 2]], c.light);
  }
  if (stone) {
    p.polygon([[x - 5, hy - 4], [x + 5, hy - 4], [x + 7, hy + 2], [x + 4, hy + 5], [x - 4, hy + 4]], c.skin);
    p.line([x, hy], [x + 5, hy], c.accent, 2);
  } else {
    p.polygon([[x - head, hy - 1], [x - head + 1, hy - 5], [x + 4, hy - 5], [x + head + 1, hy - 2],
      [x + head + 2, hy + 1], [x + 3, hy + 4], [x - 3, hy + 4]], c.skin);
    p.box(x - 2, hy - 4, 6, 2, c.light);
    p.box(x + 2, hy + 1, 5, 2, c.dark);
    if (!a.blink) p.box(x + 2, hy - 1, skeleton ? 4 : 3, skeleton ? 2 : 1, skeleton ? INK : c.accent);
    if (large || skeleton || design.form === "goblin") p.box(x + 3, hy + 2, 2, 2, c.light);
  }
  if (design.form === "mind") {
    for (let i = 0; i < 3; i++) p.line([x + i * 2, hy + 2], [x + 1 + i * 3 + a.flutter / 2, hy + 8], i === 1 ? c.light : c.dark, 2);
  }
  crown(p, design, c, x, hy, head);
  const attackReach = a.attack ? [0, -3, 6, 5, 1][a.index] : reach / 2;
  const hand: Point = [Math.min(a.attack ? 35 : 39, x + broad + 2 + attackReach), Math.min(33, lower - (a.ability ? 10 : a.attack ? 4 : 0))];
  if (a.fall < 3) {
    limb(p, [x + broad - 1, y + 5], [x + broad + 1, Math.min(33, y + 9)], hand, large ? c.light : c.skin, large ? 4 : 3);
    p.box(hand[0] - 1, hand[1] - 1, 3, 3, c.light);
    equipment(p, design, hand, a, c);
  }
}

function beast(p: PixelFrame, design: CharacterDesign, a: Pose, c: Palette) {
  const x = 23 + a.lean, y = 25 + a.low / 2;
  const flying = design.form === "bird";
  const spider = design.form === "spider";
  const lizard = design.form === "lizard";
  const hop = flying ? Math.abs(a.flutter) : 0;
  const headX = x + (spider ? 8 : 10), headY = y - (flying ? 8 + hop : lizard ? 1 : 4);
  const legs = spider ? 8 : flying ? 2 : 4;
  for (let i = 0; i < legs; i++) {
    const rear = i < legs / 2;
    const offset = (i % (legs / 2)) * (spider ? 4 : 11);
    const from: Point = [x - (spider ? 7 : 5) + offset, y + (rear ? 1 : 4) - hop];
    const step = i % 2 === 0 ? a.pace : -a.pace;
    const foot: Point = [from[0] + step + (spider ? (i % 4 - 1.5) * 5 : rear ? -4 : 2), flying ? 30 : 36 - (step < 0 ? a.lift : 0)];
    const joint: Point = [foot[0] + (rear ? -2 : 2), spider ? y - 2 + i % 3 : (from[1] + foot[1]) / 2];
    limb(p, from, joint, foot, rear ? c.dark : c.skin, spider ? 2 : 3);
    p.box(foot[0], foot[1], 2, 1, c.light);
  }
  if (!spider) {
    limb(p, [x - 6, y], [x - 12, y + 1 + a.flutter], [x - 18, y - 5 + a.flutter], c.dark, lizard ? 2 : 3);
    if (design.crest === "horns") p.box(x - 19, y - 6 + a.flutter, 3, 2, c.accent);
  }
  p.oval(x - (spider ? 5 : 1), y - hop, spider ? 9 : 12, spider ? 7 : 6, c.skin);
  p.line([x - 7, y - 3 - hop], [x + 3, y - 3 - hop], c.light, 2);
  p.line([x - 7, y + 2 - hop], [x + 4, y + 3 - hop], c.dark, 2);
  if (spider) {
    p.line([x - 10, y - 4], [x - 8, y + 1], c.clothLight);
    p.line([x - 5, y - 4], [x - 3, y + 1], c.clothLight);
  } else if (!flying) {
    for (let i = 0; i < 4; i++) {
      const px = x - 7 + i * 4;
      p.line([px, y - 2], [px - 1, y + (i % 2 ? 1 : 2)], i % 2 ? c.light : c.dark);
    }
  }
  if (lizard || design.crest === "spikes") {
    for (let i = 0; i < 5; i++) p.polygon([[x - 11 + i * 4, y - 4], [x - 9 + i * 4, y - 10 - i % 2], [x - 6 + i * 4, y - 4]], c.cloth);
  }
  if (flying) {
    const tip = y - hop + a.flutter * 2 - 8;
    p.polygon([[x + 5, y - hop], [x - 4, tip - 4], [x - 16, tip - 6], [x - 14, tip + 1], [x - 12, tip], [x - 10, tip + 5],
      [x - 6, tip + 4], [x - 5, y + 5 - hop]], c.cloth);
    p.line([x - 13, tip - 4], [x - 5, tip - 2], c.accent, 2);
  }
  const bite = a.attack && (a.index === 2 || a.index === 3) ? 4 : 0;
  p.polygon([[headX - 5, headY - 2], [headX - 1, headY - 6], [headX + 3, headY - 3], [headX + 7 + bite, headY],
    [headX + 6 + bite, headY + 3], [headX - 3, headY + 4]], c.skin);
  p.box(headX + 1, headY - 2, 2, 2, c.accent);
  p.box(headX + 4 + bite, headY + 1, 2, 1, c.light);
  if (spider) {
    p.box(headX - 1, headY - 1, 1, 1, c.accent);
    p.line([headX + 4, headY + 3], [headX + 6 + bite, headY + 6], c.light, 2);
  }
  crown(p, design, c, headX - 2, headY - 1, 4);
  if (design.gear === "bow" || design.gear === "orb") equipment(p, design, [headX, Math.min(31, headY + 10)], a, c);
}

function strange(p: PixelFrame, design: CharacterDesign, a: Pose, c: Palette) {
  const x = 23 + a.lean, y = 24 + a.low / 2;
  const stretch = a.pace;
  if (design.form === "core") {
    p.polygon([[13, 32], [20, 29], [29, 30], [35, 33], [33, 38], [16, 38]], c.cloth);
    p.polygon([[23, 7], [29, 14], [31, 27], [24, 33], [16, 25], [17, 15]], c.skin);
    p.polygon([[23, 8], [22, 25], [17, 24], [18, 16]], c.accent, false);
    p.line([23, 8], [24, 20], a.blink ? c.light : PALE, 2);
    return;
  }
  if (design.form === "turret") {
    const recoil = a.attack ? [0, -2, 1, -1, 0][a.index] : 0;
    for (let i = -1; i <= 1; i += 2) {
      p.oval(x + i * (9 + stretch / 3), 33, 5, 4, c.clothDark);
      p.line([x + i * 9, 30], [x + i * 9 + a.flutter / 2, 35], c.light, 2);
    }
    p.polygon([[x - 10, 27], [x + 9, 27], [x + 10, 33], [x - 10, 33]], c.cloth);
    p.oval(x, 24, 6, 6, c.skin);
    p.line([x - 5, 24], [x + 7 + recoil, 21], c.light, 2);
    equipment(p, design, [x + 7 + recoil, 23], a, c);
    if (design.crest !== "bare") crown(p, design, c, x - 2, 19, 4);
    return;
  }
  if (design.form === "serpent") {
    const tail: Point = [x - 16, 31 - a.flutter];
    limb(p, [x + 7, y - 4], [x + 7 + stretch / 2, 32], [x - 6, 34], c.skin, 6);
    limb(p, [x + 2, 33], [x - 8, 35 + stretch / 3], tail, c.cloth, 4);
    p.oval(x + 6, y - 6, 8, 6, c.skin);
    p.box(x + 9, y - 8, 2, 2, c.accent);
    p.line([x + 9, y - 5], [x + 16 + (a.attack && a.index === 2 ? 3 : 0), y - 4], c.light, 2);
    crown(p, design, c, x + 5, y - 7, 5);
    return;
  }
  if (design.form === "ooze") {
    const wide = Math.abs(stretch);
    const height = a.attack && a.index === 2 ? 13 : 8 - wide / 2;
    p.polygon([[x - 12 - wide, 36], [x - 10 + stretch / 2, 34 - height / 2], [x - 5, 34 - height],
      [x + 3, 33 - height + a.flutter / 2], [x + 9 + stretch / 2, 34 - height / 2], [x + 13 + wide, 36]], c.skin);
    p.line([x - 5, 35 - height], [x + 1, 34 - height + a.flutter / 2], c.light, 2);
    p.box(x + 3, 34 - height / 2, 2, 2, c.accent);
    if (!a.blink) p.box(x + 7, 34 - height / 2, 2, 2, c.accent);
    if (design.crest !== "bare") crown(p, design, c, x, 32 - height, 5);
    return;
  }
  const plant = design.form === "plant";
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const spread = 6 + (i % 3) * 3;
    const curl = (i % 2 ? a.flutter : -a.flutter);
    const tip: Point = [x + side * (spread + 2) + curl / 2, (plant ? 35 : 26) + (i % 3) * 4 - curl];
    limb(p, [x + side * (5 + i % 3), y + 2], [x + side * spread, y + 6 + curl / 2], tip, i % 2 ? c.cloth : c.dark, 2);
    p.pixel(tip[0], tip[1], c.accent);
  }
  p.oval(x, y, plant ? 9 : 11, plant ? 10 : 8, c.skin);
  p.line([x - 5, y - 4], [x + 3, y - 5], c.light, 2);
  if (plant) {
    p.polygon([[x - 5, y - 1], [x + 8, y - 2], [x + 5, y + 5], [x - 4, y + 3]], c.clothDark);
    p.box(x, y + 1, 5, 2, c.accent);
  } else if (!a.blink) {
    p.oval(x + 2, y, a.ability ? 8 : 6, a.ability ? 6 : 5, PALE);
    p.oval(x + 3, y, a.attack ? 2 : 3, 4, c.accent);
    p.box(x + 3, y - 1, 1, 3, INK);
  } else {
    p.line([x - 4, y], [x + 8, y], c.clothDark);
  }
  crown(p, design, c, x, y - 5, 6);
}

function debris(p: PixelFrame, design: CharacterDesign, a: Pose, c: Palette) {
  const x = 22 - a.fall;
  const y = 34 + Math.min(a.fall, 3);
  if (a.fall < 5) {
    p.polygon([[x - 9, y + 2], [x - 5, y - 3], [x + 4, y - 4], [x + 9, y - 1], [x + 12, y + 3], [x - 9, y + 3]],
      design.form === "ooze" ? c.skin : c.cloth);
    p.oval(x - 5, y - 2, 5, 4, c.skin);
    p.line([x + 3, y], [x + 14, y + 1], c.accent, 2);
  }
  for (let i = 0; i < (a.fall === 5 ? 5 : 8); i++) {
    const rise = (i % 4) * (6 - a.fall);
    p.box(11 + i * 4 + (a.fall - 3) * (i % 2), y - rise, a.fall === 5 ? 1 : 2, 1 + i % 2, i % 3 ? c.dark : c.accent);
  }
}

function powerPixels(p: PixelFrame, a: Pose, c: Palette) {
  if (!a.ability || a.index === 0) return;
  const r = 4 + a.index * 3;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + a.index / 4;
    const x = 24 + Math.cos(angle) * r, y = 24 + Math.sin(angle) * r * 0.7;
    p.box(x, y, i % 2 ? 2 : 1, 2, i % 3 ? c.accent : PALE);
  }
}

export function renderCharacterFrame(design: CharacterDesign, clip: CharacterClip, index: number): Uint8ClampedArray {
  const frame = new PixelFrame();
  const a = pose(clip, index);
  const c = palette(design);
  if (a.fall >= 3) debris(frame, design, a, c);
  else if (["wolf", "spider", "bird", "lizard"].includes(design.form)) beast(frame, design, a, c);
  else if (["serpent", "turret", "ooze", "eye", "plant", "core"].includes(design.form)) strange(frame, design, a, c);
  else humanoid(frame, design, a, c);
  powerPixels(frame, a, c);
  if (clip === "hit" && index < 2) {
    frame.line([33 + index * 3, 14], [37 + index * 3, 19], index ? c.accent : PALE, 2);
    frame.pixel(39, 15 + index * 2, PALE);
  }
  return frame.rgba;
}

interface Sheet { canvas: HTMLCanvasElement; url?: string }
const sheets = new Map<string, Sheet>();

export function characterSheet(id: string): Sheet | undefined {
  const cached = sheets.get(id);
  if (cached) return cached;
  const design = characterDesign(id);
  if (!design || typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE * FRAME_COUNT;
  canvas.height = FRAME_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  for (const clip of Object.keys(FRAMES) as CharacterClip[]) {
    const { start, count } = FRAMES[clip];
    for (let index = 0; index < count; index++) {
      const image = context.createImageData(FRAME_SIZE, FRAME_SIZE);
      image.data.set(renderCharacterFrame(design, clip, index));
      context.putImageData(image, (start + index) * FRAME_SIZE, 0);
    }
  }
  const sheet = { canvas };
  sheets.set(id, sheet);
  return sheet;
}

export function characterSheetUrl(id: string): string | undefined {
  const sheet = characterSheet(id);
  if (!sheet) return undefined;
  return sheet.url ??= sheet.canvas.toDataURL();
}

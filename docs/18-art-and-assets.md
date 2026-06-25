# 18 — Art & Assets

The asset list, the **placeholder-first** strategy (so the game is fully playable before final art), sourcing options for free sprites, sizing/atlas plan, audio, and the content→art mapping. Spec: "Make or find sprites for everything"; "if the storage or hosting stuff doesn't work just do the rest and scaffold that part."

---

## 1. Strategy: placeholder-first, art-last

`[R-ART-001]` The game must be **fully playable with placeholder art**. Every content id (`05`–`09`) maps to an art entry via a **manifest**; if a texture is missing, the renderer falls back to a **tinted shape + label** (family color + role icon + tier badge). This means build subagents never block on art.
`[R-ART-002]` Placeholder set (ship first):
- Tiles: flat colored squares (stone = dark grey w/ noise, floor = lighter, core = glowing diamond, entrance = portal ring).
- Units/enemies: family/archetype-colored circles or simple silhouettes with a role glyph (sword/bow/staff/dagger) and a tier-numbered badge.
- Traps: small iconographic markers (pit, flame, net, glyph) with a hidden-ring.
- FX: simple particles/tweens.
`[R-ART-003]` Real art is swapped in **per id** without code changes (manifest update + atlas), incrementally.

---

## 2. Visual language (canonical)

### 2.1 Tier color palette (used on badges, borders, gear rarity-adjacent)
| Tier | Name | Color (hex, indicative) |
|------|------|--------|
| T1 | Bronze | `#b08d57` |
| T2 | Silver | `#c0c0c8` |
| T3 | Gold | `#e3c34e` |
| T4 | Platinum | `#d9e3ea` |
| T5 | Mithril | `#7fd6d1` |
| T6 | Adamant | `#5fa8d3` |
| T7 | Orichalcum | `#b06fd6` |
| T8 | Dragon | `#e0533d` |
| T9 | Celestial | `#f2e9a0` |
| T10 | Mythic | `#ff5db1` (iridescent treatment) |

### 2.2 Family motifs (color + icon)
| Family | Color | Motif |
|--------|-------|-------|
| Goblinoid | muddy green | jagged tooth / crude blade |
| Undead | bone white / violet | skull |
| Beast | russet / brown | claw/paw |
| Demon | crimson / black | horns/flame |
| Construct | steel grey | gear/anvil |
| Aberration | sickly teal / purple | eye/tentacle |

### 2.3 Enemy archetype silhouettes (readability, P1)
Warrior = bulky + shield; Archer = slim + bow; Mage = robed + staff/hat; Rogue = hooded + daggers. Uniques get a banner/crown overlay + tint.

### 2.4 Gear rarity colors (quality)
common grey, uncommon green, rare blue, epic purple, legendary orange, mythic pink/iridescent (mirrors tier-10 treatment).

---

## 3. Asset inventory (what to make/find)

### 3.1 Tiles & environment
- stone (unexplored) variants ×3, floor variants ×3, wall edge auto-tiles, core (animated glow, 3 damage states), entrance portal (animated), decals (rubble, bones).

### 3.2 Units (player monsters) — ~66 (`05`)
One sprite per unit id, ideally with idle + attack + hit + death frames. Grouped by family. Placeholder: family-color circle + role glyph + tier badge.

### 3.3 Enemies (adventurers) — ~40 classes (`09`)
One per class id across the four archetypes + branches; idle/attack/hit/death. Uniques reuse class sprite + banner/crown + tint.

### 3.4 Traps — ~19 (`08`)
Armed (hidden indicator) + triggered animation per trap.

### 3.5 Projectiles & FX
arrows, bolts, magic bolts (per school: arcane/fire/frost/holy/shadow/nature), melee swing arc, explosion/AoE rings, status icons (poison/burn/slow/root/stun/shield/fear/buff/debuff), damage-number styles (normal/crit/true/heal).

### 3.6 UI art
icons for stats, affinities (letter chips can be CSS), slots (weapon/armor/accessory), currency (DP, H2H points), family/branch icons, tier badges, buttons, panel frames, tooltips, achievement icons (can be generated/templated), cursor states (pickaxe, move, place).

### 3.7 Audio
- SFX: dig, place, sell, buy, error, button, attack-by-type, hit, death, trap-trigger-by-type, core-hit, core-damage warning, wave-start, victory, defeat, achievement, level-up.
- Music: hub theme, build theme (calm), wave theme (tense), milestone/crusade theme (epic), defeat sting, H2H theme.
`[R-ART-010]` Audio is also behind a manifest + graceful no-op fallback; ship silent-safe.

---

## 4. Sizing & atlas plan
`[R-ART-020]` Base tile size **64×64 px** (logical); sprites authored at 64×64 (units) / 64×64 or 96×96 (large units/bosses occupy 1 tile visually but may overflow). Pixel-art or clean vector-ish; pick one consistent style.
`[R-ART-021]` Pack into **texture atlases** by category (tiles, goblinoid, undead, …, enemies, traps, fx, ui) to minimize draw calls; load via Pixi `Assets`. Mipmaps off for crisp pixels (if pixel-art) / on for smooth.
`[R-ART-022]` A **manifest JSON** maps `contentId → { atlas, frame(s), anchor, scale }`; the renderer resolves art by id; missing → placeholder (`R-ART-001`).
`[R-ART-023]` Animations: spritesheet frame sequences (preferred) or single-frame + tween (placeholder/cheap units). Keep frame counts modest for atlas size.

---

## 5. Sourcing free assets (options for the find-or-make path)
`[R-ART-030]` Acceptable sources (verify license per asset, prefer CC0/public-domain or CC-BY with attribution file):
- **OpenGameArt.org** (CC0/CC-BY) — fantasy creatures, tiles, FX.
- **Kenney.nl** (CC0) — clean UI, tiles, particle/FX, some characters.
- **itch.io** free asset packs (check license) — top-down dungeon/fantasy sprite packs.
- **Game-icons.net** (CC-BY) — huge icon set ideal for stats/abilities/traps/UI.
- **Generated placeholders** — programmatic shapes/sigils for immediate use.
`[R-ART-031]` Maintain `app/public/assets/ATTRIBUTIONS.md` listing each third-party asset, author, license, and link. Don't ship unlicensed art.
`[R-ART-032]` Keep a consistent style; if mixing packs, apply a unifying palette/outline treatment. When in doubt, prefer one cohesive CC0 pack + game-icons for iconography.

---

## 6. Content → art mapping rules
`[R-ART-040]` Every `unit`, `class`, `trap`, `gear type`, `ability`, `affinity`, `family`, `achievement` has an `artId` (defaults to its content id). The manifest is the only place art is bound; content docs never hardcode file paths.
`[R-ART-041]` Gear is rendered primarily via **slot+type icon + rarity color** (not unique art per item instance), since items are procedurally generated (`07`). Weapon types and armor types each get one icon.
`[R-ART-042]` A small tool/script validates that every content id has either real art or a defined placeholder (no silent blanks).

---

## 7. Performance & memory
`[R-ART-050]` Total atlas memory budget kept reasonable for web (target < ~128 MB GPU textures). Lazy-load late-tier/boss atlases. Unload H2H opponent-only art when leaving H2H.
`[R-ART-051]` Use a single particle system with pooled sprites for FX (`17` R-ARCH-040).

---

## 8. Build-phase guidance
`[R-ART-060]` **Phase 1**: ship 100% placeholders (shapes/icons) — game fully playable. **Phase 2**: replace tiles + core + the 4 enemy archetypes + common units with real sprites (biggest readability win). **Phase 3**: fill remaining units/bosses/traps/FX. **Phase 4**: audio. Art never gates logic (`R-ART-001`).

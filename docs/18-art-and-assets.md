# 18 — Art & Assets

The asset list, the **placeholder-first** strategy (so the game is fully playable before final art), sourcing options for free sprites, sizing/atlas plan, audio, and the content→art mapping. Spec: "Make or find sprites for everything"; "if the storage or hosting stuff doesn't work just do the rest and scaffold that part."

---

## Current pixel art

The playable Stronghold uses [the monster settlement](../app/src/assets/monster-stronghold.webp). Building hotspots, wandering routes, and workers are positioned against the illustrated streets and landmarks. [The Frozen Frontier](../app/src/assets/frozen-frontier.webp) continues the campaign past the original Borderlands map. Both assets were generated with the built-in ImageGen tool and encoded as WebP.

**Monster Stronghold prompt**

> Create an original panoramic pixel-art exploration scene for a monster-built underground city, landscape 3:2. This is a genuinely inhabited fantasy settlement that grew around the cavern, not a game tile map. Top-down three-quarter view like a detailed 16-bit adventure overworld, hard-edged chunky pixels, layered silhouettes, smoky teal caves, deep olive, red banners, small amber light. Wind a broad irregular cobblestone street from the lower left around a central open market, forking uphill and over bridges, with side alleys, diagonal stairs, lava and fungal caves dictating where houses fit. The population is monsters, so habitats use horn arches, bones, sentient mushrooms, scrap and carved teeth. Compose in organic neighborhoods with strongly varied elevations, irregular building spacing and scale, and visually varied negative space. Important landmarks should be distinct and findable while panning: NW Bone Gate barracks, a small archery yard near it, crystal mage spire in upper middle, dark bastion above the upper-right ridge, eye shrine with sea-green tentacles on a crooked left terrace, mushroom warren below it, a violet reliquary near the center plaza, a skeletal ribcage crypt on an eastern plateau, a blue brass golem workshop below the crypt, an orange lava forge to the southwest, a crane above a stone quarry near the lower middle, and a beast den with antlers and furs on the lower-right. Scatter many ordinary monster-scale huts, homes, kiosks, mushroom gardens, bridges, watchfires, market lean-tos and tiny back alleys among the landmarks, with ordinary buildings accounting for most of the settlement. The city's visual flow should lead along winding streets, with some structures partly obscured by cavern cliffs. No rectangular grid, no rows of equal-sized attractions, no repeated square plots, no orthogonal street grid, no symmetry, no lettering, no UI, no signage text, no people or creatures baked into the illustration. All edges are painted to be part of the navigable world.

**Frozen Frontier prompt**

> Original 3:2 landscape 16-bit pixel art overworld map for a retro fantasy dungeon defense campaign. Overhead elevated richly illustrated terrain, a frozen frontier beyond an alpine fortress, with distinct landmarks and interconnected warm copper roads. Lower left slate mountain gate and pine woods, lower mid obsidian quarry, lower right an icebound port. Central wind-scoured valley with frozen lake, ruined town, bridge and frosted orchard. Far north a violet aurora over a distant fortified dark capital, glaciers and northern spires. Twelve open locations spaced across the map for interface pins to be added later. Cohesive limited palette of indigo shadow, pale glacial cyan, dark evergreen, small warm amber windows and ochre roads. Clear chunky hard-edged pixel clusters and irregular dark vignette at edges. No UI, no text, no markers, no recognizable assets or watermarks.

Combat and Stronghold residents share [the pixel frame renderer](../app/src/game/art/pixels.ts). Each recruit, adventurer, and named champion has a recipe in [the character catalog](../app/src/game/art/characters.ts) for their body, equipment, headgear, and palette. The renderer draws idle, walk, attack, ability, hit, and defeat frames at 48 × 48 pixels. Pixi uses those frames in combat, while the Stronghold and Bestiary play the same sheets in the interface. Add recipe entries when expanding the roster, and review the poses in the Bestiary. The original generated combat atlas below is archived concept art.

The four images were made with the built-in ImageGen tool, then encoded as WebP for the game. The character atlas retains its alpha channel. Keep scene art free of text and markers so names, controls, and accessibility labels live in the interface. Keep the center of combat environments quiet so tiles and units remain legible.

### Generation prompts

**[Campaign map](../app/src/assets/campaign-map.webp)**

> Original retro pixel-art environment for a dungeon strategy game's campaign and menu. Wide 3:2 overhead illustrated fantasy region map, winding amber dirt road traversing dark pine forest, terraced moss cliffs, ruined stone settlements, canyon bridge, glacial peaks and fortress at far right. Indigo shadows, moss and slate terrain, copper warm window light. Crisp intentionally grouped chunky pixels, visible hard nearest-neighbor pixel edges, authentic 16-bit console overworld tiles, limited palette, textured dark border blending into near-black ink. Readable paths and broad empty terrain areas for interactive node labels overlaid later. Distinct original geography and buildings. No characters, text, map pins, UI, borders, or watermarks.

**[Stronghold](../app/src/assets/stronghold.webp)**

> Original 16-bit pixel art for a dungeon strategy game's Stronghold. A single continuous wide 3:2 elevated view into an inhabited underground fortress village, built on mossy slate platforms. Distinct small forge glowing copper, squat barracks, archery range, violet wizard tower, reliquary, quarry and decorated faction halls arranged along paths around one central courtyard. Dark ink and navy stone, moss green, brass highlights, isolated torchlight, no luminous gradients. Hard deliberate chunky pixel clusters, authentic retro console tilework, readable silhouettes. No lettering, interface, icons, logos or recognizable game assets.

**[Dungeon cavern](../app/src/assets/dungeon-cavern.webp)**

> Original pixel art environmental background for a top-down dungeon tactics game combat board. Wide landscape 3:2. Deep underground obsidian and charcoal slate cavern, a quiet flat dark empty center taking 70 percent of the frame so a square tile board and sprites will read clearly. Around the outer edges only, chunky jagged moss-stained pillars, small old copper braziers and an occasional sliver of blue subterranean water. Low value contrast, dark desaturated ink-and-green palette, crisp intentionally grouped 16-bit console pixel clusters, no gradients. No characters, paths, grids, interface, text or watermarks.

**[Combat atlas](../app/src/assets/combat-atlas.webp)**

> Production game sprite atlas on transparent background, exact 4 columns by 3 rows, 4:3 canvas, equal-size square cells, each figure centered strictly inside its own cell with large transparent padding, no frames, no overlap, no text, no headings, no swatches. A set of TWELVE distinct original retro dungeon game sprites, ordered left to right in each row. Row 1: green long-eared goblin in leather; ivory skeleton knight; cocoa-brown wolf beast; crimson horned imp. Row 2: slate stone golem with brass details; turquoise tentacled aberration with a cyclopean eye; steel armored human warrior; moss-hooded human archer with bow. Row 3: violet human mage with staff; wine-red masked human rogue; small turquoise slime familiar; faceted violet dungeon crystal on a stone base. Three-quarter top-down slightly facing right, consistent low resolution hand-clustered 32-bit fantasy game pixel art appropriate for display at 28 to 36 pixels each, chiseled silhouettes and physically hard square pixel contours, original characters. No gradient lighting or noisy fine detail. Each character is a standalone static idle sprite and never crosses a cell boundary. TRUE transparent alpha in the entire background.

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

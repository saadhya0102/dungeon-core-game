import { CLASSES, CLASS_BY_ID, UNIQUES } from "../../sim/content/enemies";
import { UNITS } from "../../sim/content/units";
import type { Archetype } from "../../sim/types";

export type Form = "goblin" | "brute" | "skeleton" | "hood" | "wraith" | "human" | "wolf" | "spider" | "bird"
  | "lizard" | "serpent" | "imp" | "devil" | "golem" | "turret" | "ooze" | "eye" | "mind" | "plant" | "core";
export type Gear = "sword" | "daggers" | "axe" | "club" | "maul" | "spear" | "sling" | "bow" | "crossbow"
  | "staff" | "orb" | "claws" | "shield" | "flail" | "banner";
export type Crest = "bare" | "band" | "hood" | "visor" | "crown" | "horns" | "plume" | "mask" | "spikes" | "halo" | "crest";
type Costume = readonly [Form, Gear, Crest, string, string, string?];

// Form, equipment, head silhouette, cloth/armor, accent, optional body color.
const monsters: Record<string, Costume> = {
  gob_grunt: ["goblin", "sword", "band", "#855137", "#dfaf61"],
  gob_archer: ["goblin", "sling", "hood", "#49634c", "#e2b76b"],
  gob_cutter: ["goblin", "daggers", "mask", "#602f4d", "#e59c6a"],
  orc_warrior: ["brute", "axe", "visor", "#59666a", "#da9961", "#759364"],
  orc_shaman: ["brute", "staff", "hood", "#4d3869", "#c6a2ff", "#789c63"],
  gob_ogre: ["brute", "club", "bare", "#6e5539", "#c7a177", "#a39064"],
  orc_warlord: ["brute", "banner", "horns", "#76383d", "#f1b85f", "#748e5c"],
  gob_troll: ["brute", "maul", "spikes", "#51476b", "#aebfef", "#73919a"],
  gob_battlemother: ["goblin", "spear", "crown", "#883c5f", "#f6ca78", "#9bab58"],
  gob_warbringer: ["brute", "axe", "plume", "#6f3b3d", "#ffa95f", "#aa8354"],
  gob_titan: ["brute", "club", "visor", "#485e73", "#9ad7e0", "#8e9fa9"],
  gob_godslayer: ["brute", "sword", "crown", "#6d346e", "#ffdb8c", "#879a50"],
  und_skeleton: ["skeleton", "sword", "bare", "#64505a", "#d3ad86"],
  und_skel_archer: ["skeleton", "bow", "hood", "#364a4f", "#ddbe79"],
  und_ghoul: ["skeleton", "claws", "spikes", "#49343c", "#b6d064", "#9fa67f"],
  und_necromancer: ["hood", "staff", "hood", "#443253", "#b5df78", "#c4be9d"],
  und_wight: ["wraith", "orb", "visor", "#4d6479", "#96eee0"],
  und_wraith: ["wraith", "claws", "hood", "#504365", "#c2aaf7"],
  und_bonegolem: ["golem", "shield", "horns", "#8c735f", "#afdcc4", "#dac7ab"],
  und_lich: ["hood", "staff", "crown", "#67365e", "#ed92e8", "#d7c9a5"],
  und_deathknight: ["skeleton", "axe", "visor", "#33394f", "#9ef4ed"],
  und_archlich: ["wraith", "staff", "halo", "#353b78", "#a2c6ff"],
  und_deathlord: ["skeleton", "orb", "crown", "#713c54", "#f4c475"],
  bst_direwolf: ["wolf", "claws", "bare", "#705443", "#efd272", "#a17d64"],
  bst_giantspider: ["spider", "claws", "spikes", "#49354e", "#a8e566", "#63496c"],
  bst_harpy: ["bird", "bow", "plume", "#805376", "#e6bf70", "#a97078"],
  bst_basilisk: ["lizard", "claws", "crest", "#4c6753", "#f5c46b", "#799060"],
  bst_manticore: ["wolf", "claws", "horns", "#b46646", "#ffcd70", "#ae6551"],
  bst_wyvern: ["bird", "claws", "horns", "#843e49", "#ffab63", "#bc6259"],
  bst_chimera: ["lizard", "claws", "horns", "#815a45", "#f9d36d", "#ae785a"],
  bst_behemoth: ["lizard", "claws", "spikes", "#694769", "#f2ad6f", "#926f82"],
  bst_rocdragon: ["bird", "claws", "plume", "#456181", "#fff1a6", "#738dbd"],
  bst_worldserpent: ["serpent", "claws", "crown", "#354c74", "#a5e7ff", "#5888af"],
  dem_imp: ["imp", "orb", "horns", "#794045", "#ffc173"],
  dem_hellhound: ["wolf", "claws", "spikes", "#7b3539", "#ffab57", "#993b45"],
  dem_cambion: ["devil", "staff", "horns", "#713b56", "#eb95e5"],
  dem_succubus: ["devil", "orb", "mask", "#653562", "#ff9fc8", "#b56583"],
  dem_barbed: ["devil", "spear", "spikes", "#523b4b", "#f68c63"],
  dem_infernal: ["golem", "maul", "spikes", "#713843", "#ff994a", "#ac5550"],
  dem_pitfiend: ["devil", "axe", "horns", "#583b52", "#ffc272"],
  dem_balor: ["brute", "flail", "horns", "#523053", "#ffb166", "#b65350"],
  dem_archdevil: ["devil", "staff", "halo", "#673665", "#ff9c66"],
  dem_demonprince: ["devil", "sword", "crown", "#812f50", "#ffe0a1", "#a55a73"],
  con_animarmor: ["golem", "sword", "visor", "#596b7a", "#93d0c5"],
  con_sentry: ["turret", "crossbow", "bare", "#836b55", "#8ff0dd"],
  con_ironguard: ["golem", "shield", "visor", "#4e586b", "#d8ab66"],
  con_ballista: ["turret", "bow", "spikes", "#765241", "#e6b66d"],
  con_stonegolem: ["golem", "claws", "spikes", "#565967", "#a3cb8f", "#8f938e"],
  con_arcaneturret: ["turret", "orb", "halo", "#5b4979", "#c0a4ff"],
  con_irongolem: ["golem", "maul", "visor", "#634657", "#f79467", "#8b7b83"],
  con_colossus: ["golem", "maul", "horns", "#8d6a45", "#f6c878", "#9c9aad"],
  con_sentinel: ["golem", "shield", "spikes", "#43746e", "#83f0cf"],
  con_titanforge: ["golem", "axe", "plume", "#934f43", "#ffae57", "#8c8587"],
  con_worldengine: ["turret", "maul", "crown", "#635577", "#ffda84", "#9692aa"],
  abr_ooze: ["ooze", "claws", "bare", "#476067", "#b3e7ce", "#7b999f"],
  abr_gazer: ["eye", "orb", "bare", "#514f74", "#f6cf7e"],
  abr_mindling: ["mind", "claws", "mask", "#563b63", "#dd91db"],
  abr_chokethorn: ["plant", "claws", "spikes", "#4e6540", "#c9e56d", "#83965e"],
  abr_beholder: ["eye", "orb", "spikes", "#603c72", "#ffadce", "#9a6887"],
  abr_hivemind: ["plant", "orb", "halo", "#516087", "#99e8c5", "#7e778f"],
  abr_mindflayer: ["mind", "staff", "hood", "#474170", "#b0e0ee"],
  abr_nightgaunt: ["bird", "orb", "mask", "#3d395b", "#e798de", "#797095"],
  abr_elderbrain: ["ooze", "orb", "halo", "#67416e", "#ecb4f9", "#aa709b"],
  abr_outergod: ["eye", "staff", "crown", "#44336a", "#8cece7", "#5a838d"],
  summon: ["ooze", "claws", "bare", "#356e63", "#e8ef88", "#43b4a1"],
  core: ["core", "orb", "bare", "#69517d", "#efc6ff", "#9b5ede"],
};

const weapons: Record<Archetype, readonly Gear[]> = {
  warrior: ["club", "spear", "sword", "maul", "shield", "axe", "banner", "flail", "maul", "sword"],
  archer: ["sling", "bow", "bow", "crossbow", "bow", "crossbow", "bow", "crossbow", "bow", "bow"],
  mage: ["staff", "orb", "staff", "orb", "staff", "staff", "orb", "staff", "orb", "staff"],
  rogue: ["daggers", "sling", "daggers", "claws", "daggers", "orb", "sword", "daggers", "claws", "flail"],
};

const outfits: Record<Archetype, readonly string[]> = {
  warrior: ["#80694e", "#57758b", "#576b88", "#893e4b", "#7b7254", "#756788", "#8e5443", "#417072", "#a08856", "#524971"],
  archer: ["#786449", "#566a49", "#426d5e", "#858455", "#435d73", "#91674b", "#486c7d", "#887043", "#616a9e", "#4a8580"],
  mage: ["#715985", "#60588d", "#405e90", "#805584", "#823d66", "#8c4d55", "#4d497b", "#625098", "#78618f", "#3f5e86"],
  rogue: ["#715657", "#685b54", "#52586e", "#4a6563", "#823a51", "#624775", "#393f64", "#5b465d", "#363e56", "#5d4771"],
};
const helmets: Record<Archetype, readonly Crest[]> = {
  warrior: ["bare", "band", "visor", "plume", "visor", "horns", "band", "spikes", "halo", "crown"],
  archer: ["band", "hood", "plume", "mask", "hood", "visor", "plume", "mask", "halo", "crown"],
  mage: ["hood", "band", "hood", "mask", "hood", "horns", "halo", "plume", "crown", "halo"],
  rogue: ["band", "bare", "hood", "mask", "hood", "plume", "mask", "hood", "spikes", "crown"],
};
const accents = ["#e4b775", "#b0d4dc", "#e9cb96", "#d1a3d9", "#d9e7a0", "#ffc79a", "#9ee6d8", "#f1a6b4", "#fae0a5", "#c1b4f1"];
const branchCostumes: Record<string, Costume> = {
  adv_w_berserker: ["brute", "axe", "bare", "#794143", "#ffb07a", "#b27a5b"],
  adv_w_guardian: ["human", "shield", "visor", "#405476", "#a0d2e1"],
  adv_a_beastmaster: ["human", "bow", "horns", "#5f6c42", "#edc882"],
  adv_m_cleric: ["hood", "staff", "halo", "#95866b", "#fff0b0", "#ca8f6b"],
  adv_m_elementalist: ["hood", "orb", "plume", "#844364", "#a9eafd", "#c98a64"],
  adv_r_scout: ["human", "spear", "hood", "#586d55", "#e3c78f"],
  adv_r_trickster: ["human", "orb", "mask", "#734771", "#fab3f4"],
};

const champions: Record<string, Costume> = {
  uniq_aldric: ["human", "sword", "plume", "#84374b", "#ffe5a1", "#da9b73"],
  uniq_iron_warden: ["human", "shield", "horns", "#414b60", "#9de9ed", "#b98d72"],
  uniq_lyra: ["human", "bow", "crest", "#325c65", "#cbf18d", "#b8785d"],
  uniq_veylin: ["hood", "staff", "crown", "#523b79", "#e5a2fd", "#c0947e"],
  uniq_cassian: ["hood", "staff", "halo", "#947653", "#fff1b9", "#885b48"],
  uniq_vex: ["human", "daggers", "mask", "#374e65", "#a9ffe2", "#785b60"],
  uniq_grimjaw: ["brute", "axe", "spikes", "#7e433e", "#ffc47b", "#a66b55"],
  uniq_morwenna: ["hood", "orb", "halo", "#73365b", "#ffc0de", "#ac7d81"],
  uniq_roderic: ["human", "banner", "crown", "#374f81", "#ffe1a5", "#a57259"],
  uniq_nightingale: ["human", "claws", "hood", "#43395d", "#b9bbff", "#a66c70"],
};

const bodyColors: Record<Form, string> = {
  goblin: "#82aa59", brute: "#8d9e59", skeleton: "#dac8a7", hood: "#bb9f88", wraith: "#829bb1",
  human: "#c48f71", wolf: "#956f5a", spider: "#695877", bird: "#9a756e", lizard: "#82966a",
  serpent: "#779cb6", imp: "#b85d60", devil: "#ac535f", golem: "#8d9aa0", turret: "#a38b66",
  ooze: "#679e99", eye: "#779093", mind: "#9d7faa", plant: "#81975e", core: "#a471de",
};

export interface CharacterDesign {
  id: string;
  form: Form;
  gear: Gear;
  crest: Crest;
  cloth: string;
  accent: string;
  skin: string;
  tier: number;
  champion: boolean;
}

const designs = new Map<string, CharacterDesign>();
function add(id: string, recipe: Costume, tier: number, champion = false) {
  const [form, gear, crest, cloth, accent, skin = bodyColors[form]] = recipe;
  designs.set(id, { id, form, gear, crest, cloth, accent, skin, tier, champion });
}
for (const unit of UNITS) {
  const recipe = monsters[unit.id];
  if (!recipe) throw new Error(`Missing monster sprite for ${unit.id}`);
  add(unit.id, recipe, unit.tier);
}
for (const hero of CLASSES) {
  const i = hero.tier - 1;
  const arch = hero.archetype;
  add(hero.id, branchCostumes[hero.id] ?? [
    arch === "mage" ? "hood" : "human", weapons[arch][i], helmets[arch][i], outfits[arch][i], accents[i],
    ["#cc9875", "#ae7a5f", "#bb856b", "#90614f"][i % 4],
  ], hero.tier);
}
for (const hero of UNIQUES) {
  const recipe = champions[hero.id];
  if (!recipe) throw new Error(`Missing champion sprite for ${hero.id}`);
  add(hero.id, recipe, CLASS_BY_ID[hero.baseClassId]?.tier ?? 1, true);
}
add("summon", monsters.summon, 1);
add("core", monsters.core, 1);

export const characterDesign = (id: string) => designs.get(id);

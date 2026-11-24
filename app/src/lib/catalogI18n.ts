import { CATALOG } from './catalog';

/**
 * Nomes e descrições dos itens da loja em inglês, pelo id do item.
 * O catálogo (catalog.ts) continua em português e igual ao do servidor.
 */
export const CATALOG_EN: Record<string, { name: string; description: string }> = {
  board_classic: { name: 'Classic Wood', description: 'The traditional wooden board.' },
  board_tournament: { name: 'Tournament Green', description: 'The colors of chess clubs and tournaments.' },
  board_walnut: { name: 'Carved Walnut', description: 'Fine wood with grain and a frame.' },
  board_ocean: { name: 'Deep Ocean', description: 'Calm blue tones like the sea.' },
  board_marble: { name: 'Carrara Marble', description: 'Polished stone with elegant veins.' },
  board_neon: { name: 'Cyberpunk Neon', description: 'A glowing grid from a future city.' },
  board_ice: { name: 'Arctic Ice', description: 'Ice crystals with a polar shine.' },
  board_lava: { name: 'Volcanic Lava', description: 'Black rock with glowing rivers of lava.' },
  board_candy: { name: 'Candy Shop', description: 'Round squares of bubblegum and mint.' },
  board_arcade: { name: 'Arcade', description: 'Raised blocks from an old-school video game.' },
  board_castle: {
    name: "Knights' Fortress",
    description: 'Castle stones surrounded by battlements, towers and a drawbridge.',
  },
  board_royal: { name: 'Royal Gold', description: 'Ivory and gold fit for a king.' },
  board_galaxy: { name: 'Galaxy', description: 'Play among the stars.' },
  pieces_classic: { name: 'Classic', description: 'Traditional white and black.' },
  pieces_ivory: { name: 'Ivory and Ebony', description: 'A fine, understated finish.' },
  pieces_crystal: { name: 'Crystal', description: 'See-through crystal pieces.' },
  pieces_gems: { name: 'Ruby and Emerald', description: 'Cut precious stones.' },
  pieces_candy: { name: 'Sweets', description: 'Strawberry and mint, mouth-watering!' },
  pieces_pixel: { name: '8-bit Pixel', description: 'Blocky pieces from a retro video game.' },
  pieces_robot: { name: 'Robots', description: 'A metal army with LED eyes.' },
  pieces_neon: { name: 'Neon', description: 'Pieces that glow in the dark.' },
  pieces_shadow: { name: 'Shadows', description: 'Dark pieces with a violet glow.' },
  pieces_knights: {
    name: 'Medieval Knights',
    description: 'Shield soldiers, warhorses, monks, and a queen and king in armor.',
  },
  pieces_gold: { name: 'Gold and Silver', description: 'Polished precious metals.' },
  pieces_elements: { name: 'Fire and Ice', description: 'The clash of the elements.' },
  avatar_letter: { name: 'Initial', description: '' },
  avatar_knight: { name: 'Knight', description: '' },
  avatar_fox: { name: 'Fox', description: '' },
  avatar_panda: { name: 'Panda', description: '' },
  avatar_rocket: { name: 'Rocket', description: '' },
  avatar_gamer: { name: 'Gamer', description: '' },
  avatar_robot: { name: 'Robot', description: '' },
  avatar_lion: { name: 'Lion', description: '' },
  avatar_wizard: { name: 'Wizard', description: '' },
  avatar_unicorn: { name: 'Unicorn', description: '' },
  avatar_dragon: { name: 'Dragon', description: '' },
  avatar_crown: { name: 'Crown', description: '' },
  avatar_diamond: { name: 'Diamond', description: '' },
  char_rookie: { name: 'Rookie', description: 'The default character: a quiff, a knight T-shirt and lots of will to play.' },
  char_streetwear: { name: 'Streetwear', description: 'Spiky hair, a red headband, a hoodie and ripped jeans.' },
  char_cool: { name: 'Cool Kid', description: 'Sunglasses, a backwards cap and an open jacket.' },
  char_athlete: { name: 'Fighter', description: 'Martial arts gi, black belt and stone bracers.' },
  char_ninja: { name: 'Ninja', description: 'Silent and deadly on the board, with a sword on the back.' },
  char_wizard: { name: 'Sorcerer', description: 'Pointy hat, white beard and a starry robe.' },
  char_king: { name: 'King of the Board', description: 'A golden crown, a royal cape and a fur collar.' },
  char_golden_robot: { name: 'Golden Robot', description: 'Golden armor and a futuristic visor.' },
  evo_rookie: { name: 'Rookie Champion', description: "Varsity jacket, gold medal and the Champion's Backpack with a trophy that pops confetti." },
  evo_streetwear: { name: 'Neon DJ', description: 'A hoodie with color-changing neon lines and the Neon Headphones with sound waves and music notes.' },
  evo_cool: { name: 'Millionaire Cool Kid', description: 'Velvet jacket with gold, golden sneakers and the Bling Kit: chain, diamond medallion and watch.' },
  evo_athlete: { name: 'Fire Master', description: 'Black gi with flames, a lava shoulder guard and the Fire Gloves that leave a trail on every punch.' },
  evo_ninja: { name: 'Electric Shadow Ninja', description: 'Armor with electric lines, a flowing scarf and the Energy Kunai with sparks and a blue trail.' },
  evo_wizard: { name: 'Archmage', description: 'A rune robe, a magic halo and the Arcane Staff with a magic circle on the floor.' },
  evo_king: { name: 'Emperor King', description: 'Golden armor, an imperial crown and the Golden Sword with a gold trail.' },
  evo_robot: { name: 'Robot Mark II', description: 'Energy lines, a spinning core, thrusters and the Turbo Jetpack with fire and smoke.' },
  evo_astronaut: { name: 'Commander Astronaut', description: "A commander's suit with oxygen tubes and the Companion Drone that scans the floor." },
  evo_guard: { name: 'Paladin Guardian', description: 'Paladin armor with a tabard and the Tower Shield with an energy barrier. Requires the Tower Guardian (beat the Relentless Rook).' },
  char_astronaut: { name: 'Astronaut', description: 'Out-of-this-world wins.' },
  move_jamal: { name: "Jamal's Step", description: 'The classic dance step: side to side to the beat.' },
  move_67: { name: 'The 67 Move', description: 'Hands up and down: six… seven!' },
  move_spin: { name: 'Victory Spin', description: 'A full spin to celebrate the checkmate.' },
  move_airplane: { name: 'Airplane', description: 'Arms wide open, flying around the fallen rival.' },
  move_robot: { name: 'Robot Dance', description: 'Stiff, precise moves, beep boop.' },
  move_flex: { name: 'Flex', description: "Shows who's the boss of the board." },
  move_kick: { name: 'Flying Kick', description: 'A jump kick that sends the rival flying.' },
  move_flip: { name: 'Backflip', description: 'A full backflip to finish in style.' },
  move_crown: { name: 'Coronation', description: 'A crown falls from the sky among confetti.' },
  move_lightning: { name: 'Thunder Fury', description: 'Lightning strikes the defeated opponent.' },
  entrance_pop: { name: 'Pop', description: 'Pieces bounce in one by one.' },
  entrance_ground: { name: 'Ground Burst', description: 'The ground cracks and pieces rise out of it.' },
  entrance_rain: { name: 'Piece Rain', description: 'Pieces drop from the sky and kick up dust.' },
  entrance_glitch: { name: 'Glitch', description: 'Matrix glitch: pieces flicker in with RGB shake.' },
  entrance_pixel: { name: '8-bit Pixels', description: 'Each piece is built block by block.' },
  entrance_teleport: { name: 'Quantum Teleport', description: 'A beam of light materializes every piece.' },
  entrance_blackhole: { name: 'Black Hole', description: 'A spinning black hole spits each piece out.' },
  entrance_hero: { name: 'Hero Landing', description: 'Pieces slam down with shockwaves and cracks.' },
  entrance_lightning: { name: 'Lightning Storm', description: 'Lightning strikes each square and the piece sparks to life.' },
};

type Named = { id: string; name: string; description?: string };

/** Nome do item no idioma pedido (em português, o nome do catálogo sem mudança). */
export function itemName(item: Named, lang: 'pt' | 'en'): string {
  return lang === 'en' ? CATALOG_EN[item.id]?.name ?? item.name : item.name;
}

/** Descrição do item no idioma pedido. */
export function itemDescription(item: Named, lang: 'pt' | 'en'): string {
  return lang === 'en' ? CATALOG_EN[item.id]?.description ?? item.description ?? '' : item.description ?? '';
}

/** Nome em inglês a partir do nome em português (para mensagens do servidor que citam o item). */
const EN_BY_PT_NAME = new Map(CATALOG.map((i) => [i.name, CATALOG_EN[i.id]?.name ?? i.name]));
export function itemNameFromPt(ptName: string): string | undefined {
  return EN_BY_PT_NAME.get(ptName);
}

const GEAR_EN: Record<string, string> = {
  gear_backpack: "Champion's Backpack",
  gear_headphones: 'Neon Headphones',
  gear_chain: 'Bling Kit',
  gear_fire_gloves: 'Fire Gloves',
  gear_kunai: 'Energy Kunai',
  gear_staff: 'Arcane Staff',
  gear_gold_sword: 'Golden Sword',
  gear_jetpack: 'Turbo Jetpack',
  gear_drone: 'Companion Drone',
  gear_shield: 'Tower Shield',
};

/** Nome do item especial que vem com a evolução. */
export function gearName(item: { style: { gear: string; gearName: string } }, lang: 'pt' | 'en'): string {
  return lang === 'en' ? GEAR_EN[item.style.gear] ?? item.style.gearName : item.style.gearName;
}

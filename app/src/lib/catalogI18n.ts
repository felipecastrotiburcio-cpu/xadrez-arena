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
  char_rookie: { name: 'Rookie', description: 'The default character: blocks, a smile and lots of will to play.' },
  char_streetwear: { name: 'Streetwear', description: 'Backwards cap and an orange hoodie.' },
  char_cool: { name: 'Cool Kid', description: 'Sunglasses never go out of style.' },
  char_athlete: { name: 'Athlete', description: "A headband and a champion's stamina." },
  char_ninja: { name: 'Ninja', description: 'Silent and deadly on the board.' },
  char_wizard: { name: 'Sorcerer', description: 'Reads the future before every move.' },
  char_king: { name: 'King of the Board', description: 'A golden crown and a royal cape.' },
  char_golden_robot: { name: 'Golden Robot', description: 'Golden armor and a futuristic visor.' },
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

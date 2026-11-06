/**
 * CÓPIA de server/src/catalog.ts — mantenha os dois iguais (o teste
 * server/src/shop.test.ts falha se divergirem). O app usa esta cópia para a loja
 * funcionar offline, com contas salvas no aparelho.
 *
 * Catálogo da loja. O servidor é a fonte da verdade de preços e posse; os dados
 * visuais (cores, padrões) também vão para o app, que só precisa saber desenhar.
 * Regra de preço: quanto mais elaborado o visual, maior a raridade e o preço.
 */

export type ItemType = 'board' | 'pieces' | 'avatar' | 'character' | 'move';
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';

export interface BoardStyle {
  light: string;
  dark: string;
  border: string;
  /** Moldura em volta do tabuleiro (px). */
  frame: number;
  coord: { light: string; dark: string };
  /** Decoração desenhada sobre as casas. */
  pattern: 'none' | 'grain' | 'marble' | 'grid' | 'stars' | 'shine';
  patternColor: string;
  highlight: string;
}

export interface PieceStyle {
  whiteFill: string;
  whiteOutline: string;
  blackFill: string;
  blackOutline: string;
  /** Raio do brilho em volta da peça (0 = contorno simples). */
  glow: number;
}

export interface AvatarStyle {
  /** Emoji do ícone; vazio = inicial do nome. */
  emoji: string;
  background: string;
  ring: string;
}

/** Boneco em blocos (estilo avatar de jogo): as peças são desenhadas em 3D no app. */
export interface CharacterStyle {
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** Acessório da cabeça, modelado em 3D. */
  hat: 'none' | 'cap' | 'crown' | 'tophat' | 'helmet' | 'headband' | 'hair';
  /** Cor do acessório. */
  hatColor: string;
  face: 'smile' | 'grin' | 'shades' | 'mask' | 'visor';
}

export interface ShopItemBase {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  rarity: Rarity;
}

export type ShopItem =
  | (ShopItemBase & { type: 'board'; style: BoardStyle })
  | (ShopItemBase & { type: 'pieces'; style: PieceStyle })
  | (ShopItemBase & { type: 'avatar'; style: AvatarStyle })
  | (ShopItemBase & { type: 'character'; style: CharacterStyle })
  | (ShopItemBase & { type: 'move'; style: { animation: string; emoji: string } });

const board = (
  id: string, name: string, description: string, price: number, rarity: Rarity, style: BoardStyle,
): ShopItem => ({ id, type: 'board', name, description, price, rarity, style });
const pieces = (
  id: string, name: string, description: string, price: number, rarity: Rarity, style: PieceStyle,
): ShopItem => ({ id, type: 'pieces', name, description, price, rarity, style });
const avatar = (
  id: string, name: string, price: number, rarity: Rarity, style: AvatarStyle,
): ShopItem => ({ id, type: 'avatar', name, description: '', price, rarity, style });
const character = (
  id: string, name: string, description: string, price: number, rarity: Rarity, style: CharacterStyle,
): ShopItem => ({ id, type: 'character', name, description, price, rarity, style });
const move = (
  id: string, name: string, description: string, price: number, rarity: Rarity, emoji: string,
): ShopItem => ({ id, type: 'move', name, description, price, rarity, style: { animation: id.replace('move_', ''), emoji } });

export const CATALOG: ShopItem[] = [
  // ----------------------------------------------------------- tabuleiros
  board('board_classic', 'Madeira Clássica', 'O tabuleiro tradicional de madeira.', 0, 'comum', {
    light: '#efd9b4', dark: '#b5835a', border: '#7a5232', frame: 0,
    coord: { light: '#b5835a', dark: '#efd9b4' }, pattern: 'none', patternColor: 'transparent',
    highlight: 'rgba(240, 210, 60, 0.55)',
  }),
  board('board_tournament', 'Verde Torneio', 'As cores dos clubes e torneios.', 150, 'comum', {
    light: '#eeeed2', dark: '#769656', border: '#4b6236', frame: 0,
    coord: { light: '#769656', dark: '#eeeed2' }, pattern: 'none', patternColor: 'transparent',
    highlight: 'rgba(246, 246, 105, 0.6)',
  }),
  board('board_walnut', 'Nogueira Entalhada', 'Madeira nobre com veios e moldura.', 300, 'raro', {
    light: '#d9b48a', dark: '#7b4a2b', border: '#4a2a15', frame: 6,
    coord: { light: '#7b4a2b', dark: '#d9b48a' }, pattern: 'grain', patternColor: 'rgba(60, 30, 10, 0.18)',
    highlight: 'rgba(255, 200, 80, 0.5)',
  }),
  board('board_ocean', 'Oceano Profundo', 'Tons de azul calmos como o mar.', 450, 'raro', {
    light: '#dbe9f4', dark: '#4a7fa8', border: '#24506f', frame: 6,
    coord: { light: '#4a7fa8', dark: '#dbe9f4' }, pattern: 'shine', patternColor: 'rgba(255,255,255,0.18)',
    highlight: 'rgba(120, 220, 255, 0.55)',
  }),
  board('board_marble', 'Mármore Carrara', 'Pedra polida com veios elegantes.', 800, 'epico', {
    light: '#f3f1ec', dark: '#8f9399', border: '#c9a96e', frame: 8,
    coord: { light: '#8f9399', dark: '#f3f1ec' }, pattern: 'marble', patternColor: 'rgba(80, 80, 90, 0.22)',
    highlight: 'rgba(201, 169, 110, 0.6)',
  }),
  board('board_neon', 'Neon Cyberpunk', 'Grade luminosa de uma cidade futurista.', 1200, 'epico', {
    light: '#2b1a4a', dark: '#120a24', border: '#ff2fd6', frame: 4,
    coord: { light: '#00f0ff', dark: '#ff2fd6' }, pattern: 'grid', patternColor: 'rgba(0, 240, 255, 0.35)',
    highlight: 'rgba(255, 47, 214, 0.45)',
  }),
  board('board_ice', 'Gelo Ártico', 'Cristais de gelo com brilho polar.', 600, 'raro', {
    light: '#eef9ff', dark: '#7fb8d9', border: '#3d7ea6', frame: 6,
    coord: { light: '#3d7ea6', dark: '#eef9ff' }, pattern: 'shine', patternColor: 'rgba(255,255,255,0.4)',
    highlight: 'rgba(0, 200, 255, 0.45)',
  }),
  board('board_lava', 'Lava Vulcânica', 'Rocha negra com rios de lava brilhando.', 1600, 'epico', {
    light: '#3a2320', dark: '#1a0f0e', border: '#ff5a1f', frame: 6,
    coord: { light: '#ffb347', dark: '#ff5a1f' }, pattern: 'grid', patternColor: 'rgba(255, 110, 30, 0.55)',
    highlight: 'rgba(255, 170, 40, 0.5)',
  }),
  board('board_royal', 'Ouro Real', 'Marfim e ouro dignos de um rei.', 2000, 'lendario', {
    light: '#fff6dc', dark: '#d4a72c', border: '#8a6508', frame: 10,
    coord: { light: '#a37c10', dark: '#fff6dc' }, pattern: 'shine', patternColor: 'rgba(255, 255, 255, 0.35)',
    highlight: 'rgba(255, 120, 60, 0.45)',
  }),
  board('board_galaxy', 'Galáxia', 'Jogue entre as estrelas.', 3000, 'lendario', {
    light: '#3d2c7a', dark: '#140f33', border: '#8f7bff', frame: 8,
    coord: { light: '#c9bfff', dark: '#8f7bff' }, pattern: 'stars', patternColor: 'rgba(255, 255, 255, 0.85)',
    highlight: 'rgba(143, 123, 255, 0.55)',
  }),

  // ----------------------------------------------------------- peças
  pieces('pieces_classic', 'Clássicas', 'Brancas e pretas tradicionais.', 0, 'comum', {
    whiteFill: '#fbf8f1', whiteOutline: '#2a1d10', blackFill: '#1d1a17', blackOutline: 'rgba(255,255,255,0.35)', glow: 0,
  }),
  pieces('pieces_ivory', 'Marfim e Ébano', 'Acabamento nobre e discreto.', 150, 'comum', {
    whiteFill: '#fff3d6', whiteOutline: '#6b4a1f', blackFill: '#2b1b12', blackOutline: '#c9a46b', glow: 0,
  }),
  pieces('pieces_crystal', 'Cristal', 'Peças translúcidas de cristal.', 350, 'raro', {
    whiteFill: '#e6fbff', whiteOutline: '#3aa7c9', blackFill: '#28536b', blackOutline: '#a8e9ff', glow: 2,
  }),
  pieces('pieces_gems', 'Rubi e Esmeralda', 'Pedras preciosas lapidadas.', 600, 'raro', {
    whiteFill: '#ff5a6e', whiteOutline: '#5c0010', blackFill: '#1fa86b', blackOutline: '#003d22', glow: 2,
  }),
  pieces('pieces_candy', 'Doces', 'Morango e menta, de dar água na boca.', 450, 'raro', {
    whiteFill: '#ffd1e8', whiteOutline: '#d6337a', blackFill: '#7ee8c4', blackOutline: '#0f7a5a', glow: 2,
  }),
  pieces('pieces_neon', 'Neon', 'Peças que brilham no escuro.', 1000, 'epico', {
    whiteFill: '#e8fdff', whiteOutline: '#00f0ff', blackFill: '#ffd9f6', blackOutline: '#ff2fd6', glow: 8,
  }),
  pieces('pieces_shadow', 'Sombras', 'Peças sombrias com brilho violeta.', 1400, 'epico', {
    whiteFill: '#e9dcff', whiteOutline: '#8b5cff', blackFill: '#2a1747', blackOutline: '#c58bff', glow: 7,
  }),
  pieces('pieces_gold', 'Ouro e Prata', 'Metais preciosos polidos.', 1800, 'lendario', {
    whiteFill: '#ffd34d', whiteOutline: '#7a5500', blackFill: '#c7ced6', blackOutline: '#2e3640', glow: 5,
  }),
  pieces('pieces_elements', 'Fogo e Gelo', 'O confronto dos elementos.', 2800, 'lendario', {
    whiteFill: '#ffb347', whiteOutline: '#ff3d00', blackFill: '#9be7ff', blackOutline: '#0066ff', glow: 10,
  }),

  // ----------------------------------------------------------- ícones de perfil
  avatar('avatar_letter', 'Inicial', 0, 'comum', { emoji: '', background: '', ring: 'transparent' }),
  avatar('avatar_knight', 'Cavaleiro', 50, 'comum', { emoji: '♞', background: '#3b4a5e', ring: '#9aa3b2' }),
  avatar('avatar_fox', 'Raposa', 100, 'comum', { emoji: '🦊', background: '#5a3a1e', ring: '#ff9a3c' }),
  avatar('avatar_panda', 'Panda', 100, 'comum', { emoji: '🐼', background: '#2d3a3a', ring: '#e6e6e6' }),
  avatar('avatar_rocket', 'Foguete', 150, 'comum', { emoji: '🚀', background: '#1d2a5c', ring: '#ff7a59' }),
  avatar('avatar_gamer', 'Gamer', 250, 'raro', { emoji: '🎮', background: '#2b1d52', ring: '#2ee59d' }),
  avatar('avatar_robot', 'Robô', 200, 'raro', { emoji: '🤖', background: '#253447', ring: '#4f9ee8' }),
  avatar('avatar_lion', 'Leão', 300, 'raro', { emoji: '🦁', background: '#5c3d0a', ring: '#e0a526' }),
  avatar('avatar_wizard', 'Mago', 500, 'epico', { emoji: '🧙', background: '#2e1d52', ring: '#a77bff' }),
  avatar('avatar_unicorn', 'Unicórnio', 600, 'epico', { emoji: '🦄', background: '#4a1f5c', ring: '#ff9ce6' }),
  avatar('avatar_dragon', 'Dragão', 800, 'epico', { emoji: '🐉', background: '#123d2a', ring: '#3ddc84' }),
  avatar('avatar_crown', 'Coroa', 1500, 'lendario', { emoji: '👑', background: '#4a3300', ring: '#ffd34d' }),
  avatar('avatar_diamond', 'Diamante', 2500, 'lendario', { emoji: '💎', background: '#0f2f4a', ring: '#7fe3ff' }),

  // ----------------------------------------------------------- bonecos
  character('char_rookie', 'Novato', 'O boneco padrão: blocos, sorriso e muita vontade de jogar.', 0, 'comum', {
    skin: '#f8d34a', shirt: '#1e88e5', pants: '#7cb342', shoes: '#4e7a27', hat: 'none', hatColor: '#000000', face: 'smile',
  }),
  character('char_streetwear', 'Estiloso', 'Boné virado e moletom laranja.', 200, 'comum', {
    skin: '#c68642', shirt: '#ff6b35', pants: '#37474f', shoes: '#fafafa', hat: 'cap', hatColor: '#e53935', face: 'grin',
  }),
  character('char_cool', 'Descolado', 'Óculos escuros nunca saem de moda.', 400, 'raro', {
    skin: '#f1c27d', shirt: '#1de9b6', pants: '#283593', shoes: '#212121', hat: 'hair', hatColor: '#5d4037', face: 'shades',
  }),
  character('char_athlete', 'Atleta', 'Faixa na testa e fôlego de campeão.', 500, 'raro', {
    skin: '#a0663e', shirt: '#2ee59d', pants: '#1b2a49', shoes: '#ff4d6d', hat: 'headband', hatColor: '#ffffff', face: 'grin',
  }),
  character('char_ninja', 'Ninja', 'Silencioso e mortal no tabuleiro.', 700, 'epico', {
    skin: '#f1c27d', shirt: '#212121', pants: '#1a1a1a', shoes: '#000000', hat: 'headband', hatColor: '#e53935', face: 'mask',
  }),
  character('char_wizard', 'Feiticeiro', 'Lê o futuro antes do lance.', 1000, 'epico', {
    skin: '#ffe0bd', shirt: '#7c4dff', pants: '#4527a0', shoes: '#311b92', hat: 'tophat', hatColor: '#311b92', face: 'grin',
  }),
  character('char_king', 'Rei do Tabuleiro', 'Coroa de ouro e manto real.', 2000, 'lendario', {
    skin: '#8d5524', shirt: '#c62828', pants: '#ffca28', shoes: '#6d4c41', hat: 'crown', hatColor: '#ffc107', face: 'smile',
  }),
  character('char_golden_robot', 'Robô Dourado', 'Armadura de ouro e visor futurista.', 2500, 'lendario', {
    skin: '#ffd34d', shirt: '#e0a526', pants: '#b07d10', shoes: '#5c4100', hat: 'none', hatColor: '#000000', face: 'visor',
  }),
  character('char_astronaut', 'Astronauta', 'Vitórias de outro planeta.', 3000, 'lendario', {
    skin: '#ffe0bd', shirt: '#eceff1', pants: '#cfd8dc', shoes: '#546e7a', hat: 'helmet', hatColor: '#80deea', face: 'visor',
  }),

  // ----------------------------------------------------------- movimentos especiais (finalizações)
  move('move_jamal', 'Passinho do Jamal', 'O passinho clássico: pra lá e pra cá no ritmo.', 0, 'comum', '🕺'),
  move('move_67', 'Movimento do 67', 'Mãos pra cima e pra baixo: six… seven!', 0, 'comum', '🤲'),
  move('move_spin', 'Giro Vitorioso', 'Um giro completo comemorando o xeque-mate.', 200, 'comum', '🌀'),
  move('move_airplane', 'Aviãozinho', 'Braços abertos, voando em volta do rival caído.', 300, 'comum', '✈️'),
  move('move_robot', 'Dança do Robô', 'Movimentos travados e precisos, bip bop.', 450, 'raro', '🤖'),
  move('move_flex', 'Muque', 'Mostra quem manda no tabuleiro.', 350, 'raro', '💪'),
  move('move_kick', 'Voadora', 'Salto e chute que derruba o rival longe.', 600, 'raro', '🦶'),
  move('move_flip', 'Mortal para Trás', 'Um salto mortal completo para fechar com estilo.', 900, 'epico', '🤸'),
  move('move_crown', 'Coroação', 'Uma coroa desce do céu entre confetes.', 1200, 'epico', '👑'),
  move('move_lightning', 'Fúria do Trovão', 'Raios atingem o adversário derrotado.', 2200, 'lendario', '⚡'),
];

export const DEFAULT_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);

export const DEFAULT_EQUIPPED: Record<ItemType, string> = {
  board: 'board_classic',
  pieces: 'pieces_classic',
  avatar: 'avatar_letter',
  character: 'char_rookie',
  move: 'move_jamal',
};

export const getItem = (id: string) => CATALOG.find((i) => i.id === id);

// ------------------------------------------------------------- economia
export const STARTING_COINS = 300;
export const DAILY_BONUS = 50;
export const LEVEL_UP_BONUS = 100;
/** Bônus por vitória a partir da 3ª vitória seguida (máx. +50). */
export function streakBonus(streak: number) {
  return streak >= 3 ? Math.min(50, (streak - 2) * 10) : 0;
}

/** Moedas por resultado. Amistosas valem metade; canceladas não valem nada. */
/** Moedas por partida contra a IA (contas locais, sem servidor): níveis mais fortes pagam mais. */
export function aiCoinReward(score: number, aiLevel: number) {
  if (score === 1) return 10 + aiLevel * 5;
  if (score === 0.5) return 5 + aiLevel * 2;
  return 3;
}

export function coinReward(score: number, rated: boolean) {
  const base = score === 1 ? 30 : score === 0.5 ? 15 : 5;
  return rated ? base : Math.ceil(base / 2);
}

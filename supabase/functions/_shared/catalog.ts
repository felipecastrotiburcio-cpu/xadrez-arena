/**
 * Catálogo da loja. O servidor é a fonte da verdade de preços e posse; os dados
 * visuais (cores, padrões) também vão para o app, que só precisa saber desenhar.
 * Regra de preço: quanto mais elaborado o visual, maior a raridade e o preço.
 */

export type ItemType = 'board' | 'pieces' | 'avatar' | 'character' | 'move' | 'entrance' | 'evolution';
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
  /** Formato das casas: lisas, ladrilhos com rejunte, redondas, em relevo ou de vidro. */
  shape: 'flat' | 'tiles' | 'round' | 'bevel' | 'glass';
  /** Acabamento da moldura. */
  frameStyle: 'plain' | 'line' | 'ornate' | 'rivets' | 'neon' | 'wood' | 'waves' | 'frost' | 'candy' | 'lava' | 'stars' | 'castle';
}

export interface PieceStyle {
  whiteFill: string;
  whiteOutline: string;
  blackFill: string;
  blackOutline: string;
  /** Raio do brilho em volta da peça (0 = contorno simples). */
  glow: number;
  /** Modelo (formato) das peças — cada conjunto tem um desenho próprio. */
  model: 'staunton' | 'modern' | 'medieval' | 'crystal' | 'cute' | 'robot' | 'pixel' | 'knights' | 'royal';
}

export interface AvatarStyle {
  /** Emoji do ícone; vazio = inicial do nome. */
  emoji: string;
  background: string;
  ring: string;
}

/**
 * Boneco em blocos (estilo avatar de jogo), desenhado em 3D no app: corpo com ombros mais
 * largos que a cintura, mãos, rosto com sobrancelhas, cabelo em mechas e roupas especiais.
 */
export interface CharacterStyle {
  skin: string;
  hair: 'none' | 'spiky' | 'swoop' | 'buzz' | 'long';
  hairColor: string;
  outfit: 'tee' | 'hoodie' | 'gi' | 'ninja' | 'royal' | 'space' | 'robot' | 'robe' | 'armor' | 'jacket';
  /** Cor principal da roupa. */
  top: string;
  /** Cor de destaque (listras, faixa, detalhes). */
  accent: string;
  pants: string;
  ripped?: boolean;
  shoes: string;
  sole?: string;
  headwear: 'none' | 'cap' | 'capBack' | 'headband' | 'crown' | 'wizard' | 'helmet' | 'knight';
  headwearColor: string;
  face: 'smile' | 'grin' | 'smirk' | 'determined' | 'shades' | 'visor' | 'mask';
  /** Corpo mais forte (ombros e braços maiores). */
  strong?: boolean;
  /** Cavalo do xadrez estampado no peito. */
  logo?: boolean;
  /** Braceletes e caneleiras de pedra. */
  bracers?: boolean;
  /** Cor da barba (sem barba se ausente). */
  beard?: string;
}

/**
 * Evolução de um boneco (compra com dinheiro real): inclui o boneco, uma roupa evoluída
 * mais detalhada e um item especial com efeitos (espada, cajado, jetpack...).
 */
export interface EvolutionStyle {
  /** Boneco que evolui. */
  character: string;
  /** Item especial (modelo 3D com efeitos). */
  gear: string;
  /** Roupa evoluída (peças extras desenhadas no app). */
  outfit: string;
  /** Cores novas da roupa evoluída. */
  colors: Partial<CharacterStyle>;
  /** Nome do item especial que vem junto. */
  gearName: string;
  emoji: string;
  /** Cor de destaque da evolução na loja. */
  color: string;
}

export interface ShopItemBase {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  price: number;
  rarity: Rarity;
  /**
   * Itens lendários são vendidos com dinheiro real (Google Play / App Store).
   * É o ID do produto cadastrado nas lojas (igual ao ID do item). Sem isso, o item é comprado com moedas.
   */
  iap?: string;
  /**
   * Recompensa exclusiva: não é vendida na loja. Só se ganha vencendo a IA deste nível
   * pela primeira vez (junto com o emblema dela).
   */
  unlock?: number;
}

export type ShopItem =
  | (ShopItemBase & { type: 'board'; style: BoardStyle })
  | (ShopItemBase & { type: 'pieces'; style: PieceStyle })
  | (ShopItemBase & { type: 'avatar'; style: AvatarStyle })
  | (ShopItemBase & { type: 'character'; style: CharacterStyle })
  | (ShopItemBase & { type: 'move'; style: { animation: string; emoji: string } })
  | (ShopItemBase & { type: 'entrance'; style: EntranceStyle })
  | (ShopItemBase & { type: 'evolution'; style: EvolutionStyle });

/** Surgimento das peças no começo da partida (animação no tabuleiro). */
export interface EntranceStyle {
  effect: 'pop' | 'ground' | 'rain' | 'glitch' | 'pixel' | 'teleport' | 'blackhole' | 'hero' | 'lightning';
  emoji: string;
  /** Cor de destaque do efeito (brilho, raio, portal...). */
  color: string;
}

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
const entrance = (
  id: string, name: string, description: string, price: number, rarity: Rarity, effect: EntranceStyle['effect'], emoji: string, color: string,
): ShopItem => ({ id, type: 'entrance', name, description, price, rarity, style: { effect, emoji, color } });
const evolution = (
  id: string, name: string, description: string, style: EvolutionStyle,
): ShopItem => ({ id, type: 'evolution', name, description, price: 5000, rarity: 'lendario', style });
const move = (
  id: string, name: string, description: string, price: number, rarity: Rarity, emoji: string,
): ShopItem => ({ id, type: 'move', name, description, price, rarity, style: { animation: id.replace('move_', ''), emoji } });

const ITEMS: ShopItem[] = [
  // ----------------------------------------------------------- tabuleiros
  board('board_classic', 'Madeira Clássica', 'O tabuleiro tradicional de madeira.', 0, 'comum', {
    light: '#efd9b4', dark: '#b5835a', border: '#7a5232', frame: 8,
    coord: { light: '#b5835a', dark: '#efd9b4' }, pattern: 'none', patternColor: 'transparent',
    highlight: 'rgba(240, 210, 60, 0.55)',
    shape: 'flat', frameStyle: 'wood',
  }),
  board('board_tournament', 'Verde Torneio', 'As cores dos clubes e torneios.', 150, 'comum', {
    light: '#eeeed2', dark: '#769656', border: '#4b6236', frame: 6,
    coord: { light: '#769656', dark: '#eeeed2' }, pattern: 'none', patternColor: 'transparent',
    highlight: 'rgba(246, 246, 105, 0.6)',
    shape: 'flat', frameStyle: 'line',
  }),
  board('board_walnut', 'Nogueira Entalhada', 'Madeira nobre com veios e moldura.', 300, 'raro', {
    light: '#d9b48a', dark: '#7b4a2b', border: '#4a2a15', frame: 10,
    coord: { light: '#7b4a2b', dark: '#d9b48a' }, pattern: 'grain', patternColor: 'rgba(60, 30, 10, 0.18)',
    highlight: 'rgba(255, 200, 80, 0.5)',
    shape: 'bevel', frameStyle: 'wood',
  }),
  board('board_ocean', 'Oceano Profundo', 'Tons de azul calmos como o mar.', 450, 'raro', {
    light: '#dbe9f4', dark: '#4a7fa8', border: '#24506f', frame: 10,
    coord: { light: '#4a7fa8', dark: '#dbe9f4' }, pattern: 'shine', patternColor: 'rgba(255,255,255,0.18)',
    highlight: 'rgba(120, 220, 255, 0.55)',
    shape: 'round', frameStyle: 'waves',
  }),
  board('board_marble', 'Mármore Carrara', 'Pedra polida com veios elegantes.', 800, 'epico', {
    light: '#f3f1ec', dark: '#8f9399', border: '#c9a96e', frame: 8,
    coord: { light: '#8f9399', dark: '#f3f1ec' }, pattern: 'marble', patternColor: 'rgba(80, 80, 90, 0.22)',
    highlight: 'rgba(201, 169, 110, 0.6)',
    shape: 'flat', frameStyle: 'ornate',
  }),
  board('board_neon', 'Neon Cyberpunk', 'Grade luminosa de uma cidade futurista.', 1200, 'epico', {
    light: '#2b1a4a', dark: '#120a24', border: '#ff2fd6', frame: 6,
    coord: { light: '#00f0ff', dark: '#ff2fd6' }, pattern: 'grid', patternColor: 'rgba(0, 240, 255, 0.35)',
    highlight: 'rgba(255, 47, 214, 0.45)',
    shape: 'tiles', frameStyle: 'neon',
  }),
  board('board_ice', 'Gelo Ártico', 'Cristais de gelo com brilho polar.', 600, 'raro', {
    light: '#eef9ff', dark: '#7fb8d9', border: '#3d7ea6', frame: 10,
    coord: { light: '#3d7ea6', dark: '#eef9ff' }, pattern: 'shine', patternColor: 'rgba(255,255,255,0.4)',
    highlight: 'rgba(0, 200, 255, 0.45)',
    shape: 'glass', frameStyle: 'frost',
  }),
  board('board_lava', 'Lava Vulcânica', 'Rocha negra com rios de lava brilhando.', 1600, 'epico', {
    light: '#3a2320', dark: '#1a0f0e', border: '#ff5a1f', frame: 10,
    coord: { light: '#ffb347', dark: '#ff5a1f' }, pattern: 'grid', patternColor: 'rgba(255, 110, 30, 0.55)',
    highlight: 'rgba(255, 170, 40, 0.5)',
    shape: 'tiles', frameStyle: 'lava',
  }),
  board('board_candy', 'Confeitaria', 'Casas redondinhas de chiclete e menta.', 700, 'raro', {
    light: '#ffe3f1', dark: '#ff8cc6', border: '#7ee8c4', frame: 10,
    coord: { light: '#d6337a', dark: '#fff4fa' }, pattern: 'shine', patternColor: 'rgba(255,255,255,0.35)',
    highlight: 'rgba(255, 230, 90, 0.6)',
    shape: 'round', frameStyle: 'candy',
  }),
  board('board_arcade', 'Fliperama', 'Blocos em relevo de videogame antigo.', 1000, 'epico', {
    light: '#ffd23f', dark: '#3a86ff', border: '#1b1b3a', frame: 8,
    coord: { light: '#1b1b3a', dark: '#ffffff' }, pattern: 'none', patternColor: 'transparent',
    highlight: 'rgba(255, 60, 120, 0.5)',
    shape: 'bevel', frameStyle: 'rivets',
  }),
  board('board_castle', 'Fortaleza dos Cavaleiros', 'Pedras de castelo cercadas por muralha com ameias, torres e ponte levadiça.', 2600, 'lendario', {
    light: '#d9cfb8', dark: '#7d7462', border: '#8a8170', frame: 24,
    coord: { light: '#5b5346', dark: '#efe8d8' }, pattern: 'marble', patternColor: 'rgba(60, 50, 40, 0.22)',
    highlight: 'rgba(255, 196, 60, 0.5)',
    shape: 'bevel', frameStyle: 'castle',
  }),
  board('board_royal', 'Ouro Real', 'Marfim e ouro dignos de um rei.', 2000, 'lendario', {
    light: '#fff6dc', dark: '#d4a72c', border: '#8a6508', frame: 10,
    coord: { light: '#a37c10', dark: '#fff6dc' }, pattern: 'shine', patternColor: 'rgba(255, 255, 255, 0.35)',
    highlight: 'rgba(255, 120, 60, 0.45)',
    shape: 'bevel', frameStyle: 'ornate',
  }),
  board('board_galaxy', 'Galáxia', 'Jogue entre as estrelas.', 3000, 'lendario', {
    light: '#3d2c7a', dark: '#140f33', border: '#8f7bff', frame: 10,
    coord: { light: '#c9bfff', dark: '#8f7bff' }, pattern: 'stars', patternColor: 'rgba(255, 255, 255, 0.85)',
    highlight: 'rgba(143, 123, 255, 0.55)',
    shape: 'round', frameStyle: 'stars',
  }),

  // ----------------------------------------------------------- peças
  pieces('pieces_classic', 'Clássicas', 'Brancas e pretas tradicionais.', 0, 'comum', {
    whiteFill: '#fbf8f1', whiteOutline: '#2a1d10', blackFill: '#1d1a17', blackOutline: 'rgba(255,255,255,0.35)', glow: 0, model: 'staunton',
  }),
  pieces('pieces_ivory', 'Marfim e Ébano', 'Acabamento nobre e discreto.', 150, 'comum', {
    whiteFill: '#fff3d6', whiteOutline: '#6b4a1f', blackFill: '#2b1b12', blackOutline: '#c9a46b', glow: 0, model: 'medieval',
  }),
  pieces('pieces_crystal', 'Cristal', 'Peças translúcidas de cristal.', 350, 'raro', {
    whiteFill: '#e6fbff', whiteOutline: '#3aa7c9', blackFill: '#28536b', blackOutline: '#a8e9ff', glow: 2, model: 'crystal',
  }),
  pieces('pieces_gems', 'Rubi e Esmeralda', 'Pedras preciosas lapidadas.', 600, 'raro', {
    whiteFill: '#ff5a6e', whiteOutline: '#5c0010', blackFill: '#1fa86b', blackOutline: '#003d22', glow: 2, model: 'crystal',
  }),
  pieces('pieces_candy', 'Doces', 'Morango e menta, de dar água na boca.', 450, 'raro', {
    whiteFill: '#ffd1e8', whiteOutline: '#d6337a', blackFill: '#7ee8c4', blackOutline: '#0f7a5a', glow: 2, model: 'cute',
  }),
  pieces('pieces_pixel', 'Pixel 8-bits', 'Peças quadriculadas de videogame retrô.', 500, 'raro', {
    whiteFill: '#f4f4f4', whiteOutline: '#202040', blackFill: '#3b3b6d', blackOutline: '#0d0d1f', glow: 0, model: 'pixel',
  }),
  pieces('pieces_robot', 'Robôs', 'Exército de metal com olhos de LED.', 1100, 'epico', {
    whiteFill: '#dfe7ef', whiteOutline: '#33424f', blackFill: '#3c4652', blackOutline: '#11161c', glow: 0, model: 'robot',
  }),
  pieces('pieces_neon', 'Neon', 'Peças que brilham no escuro.', 1000, 'epico', {
    whiteFill: '#e8fdff', whiteOutline: '#00f0ff', blackFill: '#ffd9f6', blackOutline: '#ff2fd6', glow: 8, model: 'modern',
  }),
  pieces('pieces_shadow', 'Sombras', 'Peças sombrias com brilho violeta.', 1400, 'epico', {
    whiteFill: '#e9dcff', whiteOutline: '#8b5cff', blackFill: '#2a1747', blackOutline: '#c58bff', glow: 7, model: 'modern',
  }),
  pieces('pieces_knights', 'Cavaleiros Medievais', 'Soldados de escudo, cavalos de guerra, monges, rainha e rei de armadura.', 3200, 'lendario', {
    whiteFill: '#dfe4ea', whiteOutline: '#28313b', blackFill: '#45474f', blackOutline: '#0d0e11', glow: 0, model: 'knights',
  }),
  pieces('pieces_gold', 'Ouro e Prata', 'Metais preciosos polidos.', 1800, 'lendario', {
    whiteFill: '#ffd34d', whiteOutline: '#7a5500', blackFill: '#c7ced6', blackOutline: '#2e3640', glow: 5, model: 'medieval',
  }),
  pieces('pieces_elements', 'Fogo e Gelo', 'O confronto dos elementos.', 2800, 'lendario', {
    whiteFill: '#ffb347', whiteOutline: '#ff3d00', blackFill: '#9be7ff', blackOutline: '#0066ff', glow: 10, model: 'crystal',
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
  character('char_rookie', 'Novato', 'O boneco padrão: topete, camiseta com o cavalo e muita vontade de jogar.', 0, 'comum', {
    skin: '#f2c18f', hair: 'swoop', hairColor: '#5d3a1a', outfit: 'tee', top: '#1e88e5', accent: '#ffffff', logo: true,
    pants: '#3b5f8a', shoes: '#e53935', headwear: 'none', headwearColor: '#000000', face: 'smile',
  }),
  character('char_streetwear', 'Estiloso', 'Cabelo espetado, faixa vermelha, moletom e calça rasgada.', 200, 'comum', {
    skin: '#f0c08a', hair: 'spiky', hairColor: '#1c1a1a', outfit: 'hoodie', top: '#3a3d44', accent: '#ffffff', logo: true,
    pants: '#1f1f24', ripped: true, shoes: '#f5f5f5', sole: '#ffffff', headwear: 'headband', headwearColor: '#e53935', face: 'smile',
  }),
  character('char_cool', 'Descolado', 'Óculos escuros, boné para trás e jaqueta aberta.', 400, 'raro', {
    skin: '#c68642', hair: 'buzz', hairColor: '#1b1b1b', outfit: 'jacket', top: '#1de9b6', accent: '#263238', logo: true,
    pants: '#283593', shoes: '#212121', headwear: 'capBack', headwearColor: '#ff6b35', face: 'shades',
  }),
  character('char_athlete', 'Lutador', 'Kimono, faixa preta e braceletes de pedra.', 500, 'raro', {
    skin: '#f2a66b', hair: 'spiky', hairColor: '#4a4d52', outfit: 'gi', top: '#f7f7f7', accent: '#1b1b1f',
    pants: '#f2f2f2', shoes: '#f2a66b', headwear: 'headband', headwearColor: '#2e9e4f', face: 'determined', strong: true, bracers: true,
  }),
  character('char_ninja', 'Ninja', 'Silencioso e mortal no tabuleiro, com espada nas costas.', 700, 'epico', {
    skin: '#f1c27d', hair: 'none', hairColor: '#111111', outfit: 'ninja', top: '#22252b', accent: '#c62828',
    pants: '#1c1e23', shoes: '#111216', headwear: 'headband', headwearColor: '#c62828', face: 'mask',
  }),
  character('char_wizard', 'Feiticeiro', 'Chapéu pontudo, barba branca e manto de estrelas.', 1000, 'epico', {
    skin: '#ffe0bd', hair: 'long', hairColor: '#e8e8e8', outfit: 'robe', top: '#5e35b1', accent: '#ffd54f',
    pants: '#4527a0', shoes: '#311b92', headwear: 'wizard', headwearColor: '#4527a0', face: 'smile', beard: '#ececec',
  }),
  character('char_king', 'Rei do Tabuleiro', 'Coroa de ouro, capa real e gola de pele.', 2000, 'lendario', {
    skin: '#8d5524', hair: 'buzz', hairColor: '#1b1b1b', outfit: 'royal', top: '#c62828', accent: '#ffd54f',
    pants: '#3e2723', shoes: '#4e342e', headwear: 'crown', headwearColor: '#ffc107', face: 'smirk', beard: '#1b1b1b',
  }),
  character('char_golden_robot', 'Robô Dourado', 'Armadura de ouro e visor futurista.', 2500, 'lendario', {
    skin: '#e8b923', hair: 'none', hairColor: '#000000', outfit: 'robot', top: '#d4a017', accent: '#1de9ff',
    pants: '#b07d10', shoes: '#6b4c00', headwear: 'none', headwearColor: '#000000', face: 'visor',
  }),
  character('char_astronaut', 'Astronauta', 'Vitórias de outro planeta.', 3000, 'lendario', {
    skin: '#ffe0bd', hair: 'swoop', hairColor: '#8d5a2b', outfit: 'space', top: '#f5f7f8', accent: '#ff7043',
    pants: '#e6eaec', shoes: '#90a4ae', headwear: 'helmet', headwearColor: '#80deea', face: 'grin',
  }),

  // ----------------------------------------------------------- evoluções (dinheiro real)
  // Cada uma inclui o boneco, a roupa evoluída e o item especial com efeitos.
  evolution('evo_rookie', 'Novato Campeão', 'Jaqueta universitária, medalha de ouro e a Mochila do Campeão com troféu que solta confete.', {
    character: 'char_rookie', gear: 'gear_backpack', outfit: 'outfit_varsity', gearName: 'Mochila do Campeão', emoji: '🎒', color: '#ffc83d',
    colors: { top: '#1565c0', pants: '#1f3a5f', shoes: '#ffffff', sole: '#ffc83d' },
  }),
  evolution('evo_streetwear', 'DJ Neon', 'Moletom com linhas neon que mudam de cor e o Fone Neon com ondas sonoras e notas musicais.', {
    character: 'char_streetwear', gear: 'gear_headphones', outfit: 'outfit_dj', gearName: 'Fone Neon', emoji: '🎧', color: '#00e676',
    colors: { top: '#1a1b20', pants: '#111216' },
  }),
  evolution('evo_cool', 'Descolado Milionário', 'Jaqueta de veludo com ouro, tênis dourado e o Kit Ostentação: corrente, medalhão de diamantes e relógio.', {
    character: 'char_cool', gear: 'gear_chain', outfit: 'outfit_luxury', gearName: 'Kit Ostentação', emoji: '💎', color: '#c17bff',
    colors: { top: '#4a148c', accent: '#111111', pants: '#141414', shoes: '#ffc83d', sole: '#ffffff', headwearColor: '#ffc83d' },
  }),
  evolution('evo_athlete', 'Mestre do Fogo', 'Kimono preto com chamas, ombreira de lava e as Luvas de Fogo que deixam um rastro em cada soco.', {
    character: 'char_athlete', gear: 'gear_fire_gloves', outfit: 'outfit_fire_master', gearName: 'Luvas de Fogo', emoji: '🔥', color: '#ff6d00',
    colors: { top: '#1d1d22', pants: '#1d1d22', accent: '#c62828', headwearColor: '#c62828', hairColor: '#2a2a2e' },
  }),
  evolution('evo_ninja', 'Ninja Sombra Elétrica', 'Armadura com linhas elétricas, cachecol que voa e as Kunais de Energia com faíscas e rastro azul.', {
    character: 'char_ninja', gear: 'gear_kunai', outfit: 'outfit_shadow', gearName: 'Kunais de Energia', emoji: '⚡', color: '#00e5ff',
    colors: { top: '#15171d', pants: '#121419', accent: '#00b8d4', headwearColor: '#00b8d4' },
  }),
  evolution('evo_wizard', 'Arquimago', 'Manto com runas, auréola mágica e o Cajado Arcano com círculo mágico no chão.', {
    character: 'char_wizard', gear: 'gear_staff', outfit: 'outfit_archmage', gearName: 'Cajado Arcano', emoji: '🔮', color: '#b388ff',
    colors: { top: '#311b92', pants: '#1a237e', headwearColor: '#1a237e', shoes: '#1a237e' },
  }),
  evolution('evo_king', 'Rei Imperador', 'Armadura de ouro, coroa imperial e a Espada Dourada com rastro de ouro.', {
    character: 'char_king', gear: 'gear_gold_sword', outfit: 'outfit_emperor', gearName: 'Espada Dourada', emoji: '🗡️', color: '#ffc83d',
    colors: { top: '#8e0000' },
  }),
  evolution('evo_robot', 'Robô Mark II', 'Linhas de energia, núcleo girando, propulsores e o Jetpack Turbo com fogo e fumaça.', {
    character: 'char_golden_robot', gear: 'gear_jetpack', outfit: 'outfit_mk2', gearName: 'Jetpack Turbo', emoji: '🚀', color: '#18ffff',
    colors: { skin: '#ffcf33', top: '#f0b400', pants: '#c99400' },
  }),
  evolution('evo_astronaut', 'Astronauta Comandante', 'Traje de comandante com tubos de oxigênio e o Drone Companheiro que escaneia o chão.', {
    character: 'char_astronaut', gear: 'gear_drone', outfit: 'outfit_commander', gearName: 'Drone Companheiro', emoji: '🛸', color: '#40c4ff',
    colors: { accent: '#1e88e5', headwearColor: '#ffd54f' },
  }),
  evolution('evo_guard', 'Guardião Paladino', 'Armadura de paladino com tabardo e o Escudo da Torre com barreira de energia. Precisa do Guardião da Torre (vença a Torre Implacável).', {
    character: 'char_tower_guard', gear: 'gear_shield', outfit: 'outfit_paladin', gearName: 'Escudo da Torre', emoji: '🛡️', color: '#40c4ff',
    colors: { top: '#cfd8dc', pants: '#90a4ae', headwearColor: '#e0e6ea' },
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

  // ----------------------------------------------------------- surgimento das peças (começo da partida)
  entrance('entrance_pop', 'Pop', 'As peças aparecem quicando, uma a uma.', 0, 'comum', 'pop', '🫧', '#ffffff'),
  entrance('entrance_ground', 'Brota do Chão', 'O chão racha e as peças sobem espalhando terra.', 150, 'comum', 'ground', '🕳️', '#5b3a1e'),
  entrance('entrance_rain', 'Chuva de Peças', 'As peças despencam do céu e levantam poeira.', 300, 'raro', 'rain', '🌧️', '#cfd8dc'),
  entrance('entrance_glitch', 'Glitch', 'Falha na matrix: as peças surgem tremendo em RGB.', 600, 'epico', 'glitch', '📺', '#ff2fd6'),
  entrance('entrance_pixel', 'Pixel 8-bits', 'Cada peça é montada bloquinho por bloquinho.', 900, 'epico', 'pixel', '🧱', '#2ee59d'),
  entrance('entrance_teleport', 'Teletransporte Quântico', 'Um feixe de luz desce e materializa cada peça.', 1500, 'lendario', 'teleport', '🛸', '#00e5ff'),
  entrance('entrance_blackhole', 'Buraco Negro', 'Um buraco negro gira na casa e cospe a peça girando.', 2500, 'lendario', 'blackhole', '🌀', '#a259ff'),
  entrance('entrance_hero', 'Aterrissagem de Herói', 'As peças caem do céu com impacto, onda de choque e rachaduras.', 2500, 'lendario', 'hero', '💥', '#ffb300'),
  entrance('entrance_lightning', 'Tempestade de Raios', 'Um raio cai em cada casa e a peça surge eletrizada.', 3000, 'lendario', 'lightning', '⚡', '#ffe14d'),

  // ----------------------------------------------------------- recompensas exclusivas das IAs
  // Não são vendidas: cada uma é liberada ao vencer a IA do nível indicado pela primeira vez.
  { ...avatar('avatar_pawn_medal', 'Medalha do Peão', 0, 'raro', { emoji: '🎖️', background: '#4a3315', ring: '#cd8a4b' }), unlock: 1 },
  {
    ...board('board_knight_meadow', 'Campo do Cavaleiro', 'O gramado onde o Cavalo Aprendiz treina seus saltos.', 0, 'raro', {
      light: '#eef4d0', dark: '#7fae4f', border: '#5a3a1e', frame: 10,
      coord: { light: '#5f8a33', dark: '#eef4d0' }, pattern: 'grain', patternColor: 'rgba(40, 80, 20, 0.14)',
      highlight: 'rgba(255, 214, 64, 0.55)',
      shape: 'tiles', frameStyle: 'wood',
    }),
    unlock: 2,
  },
  {
    ...board('board_bishop_glass', 'Vitral do Bispo', 'Casas de vidro colorido, como os vitrais da catedral do Bispo Estrategista.', 0, 'epico', {
      light: '#d8e6ff', dark: '#6a4fc9', border: '#2b1f5c', frame: 10,
      coord: { light: '#4b38a0', dark: '#e6eeff' }, pattern: 'shine', patternColor: 'rgba(255, 255, 255, 0.35)',
      highlight: 'rgba(255, 200, 60, 0.55)',
      shape: 'glass', frameStyle: 'ornate',
    }),
    unlock: 3,
  },
  {
    ...character('char_tower_guard', 'Guardião da Torre', 'Elmo de cavaleiro, armadura e capa de quem derrubou a Torre Implacável.', 0, 'epico', {
      skin: '#f1c27d', hair: 'none', hairColor: '#000000', outfit: 'armor', top: '#8a949e', accent: '#1565c0',
      pants: '#4a525a', shoes: '#2b3036', headwear: 'knight', headwearColor: '#b0bac3', face: 'smile', strong: true,
    }),
    unlock: 4,
  },
  {
    ...pieces('pieces_royal', 'Realeza da Dama Mestra', 'Conjunto único de pérola e obsidiana, com frisos de ouro e joias. Só para quem venceu a Dama Mestra.', 0, 'lendario', {
      whiteFill: '#f7f2e6', whiteOutline: '#6b4e12', blackFill: '#1d1733', blackOutline: '#d9b45a', glow: 4, model: 'royal',
    }),
    unlock: 5,
  },
];

/** Lendários = compra real no app; os demais = moedas. */
export const CATALOG: ShopItem[] = ITEMS.map((i) => (i.rarity === 'lendario' && !i.unlock ? { ...i, iap: i.id } : i));

/** Itens que toda conta já ganha ao ser criada (os gratuitos da loja; recompensas não). */
export const DEFAULT_ITEMS = CATALOG.filter((i) => i.price === 0 && !i.unlock).map((i) => i.id);

// ------------------------------------------------------------- emblemas e recompensas das IAs
/** Emblema ganho ao vencer a IA de cada nível (1 a 5). */
export const badgeId = (aiLevel: number) => `ai_${aiLevel}`;
export const BADGE_IDS = [1, 2, 3, 4, 5].map(badgeId);
/** Recompensa exclusiva de cada IA (liberada na 1ª vitória contra ela). */
export const aiRewardItem = (aiLevel: number) => CATALOG.find((i) => i.unlock === aiLevel);

export const DEFAULT_EQUIPPED: Record<ItemType, string> = {
  board: 'board_classic',
  pieces: 'pieces_classic',
  avatar: 'avatar_letter',
  character: 'char_rookie',
  move: 'move_jamal',
  entrance: 'entrance_pop',
  // Evolução ativa ('' = nenhuma). Só vale enquanto o boneco dela estiver equipado.
  evolution: '',
};

/** Evolução do boneco (a que inclui este boneco), se houver. */
export const evolutionOf = (characterId: string) =>
  CATALOG.find((i): i is Extract<ShopItem, { type: 'evolution' }> => i.type === 'evolution' && i.style.character === characterId);

export const getItem = (id: string) => CATALOG.find((i) => i.id === id);

/**
 * Itens entregues ao adquirir um item. A evolução traz junto o boneco dela, menos quando o
 * boneco é recompensa de IA (aí é preciso vencê-la antes).
 */
export function itemsGranted(item: ShopItem, inventory: string[]): string[] {
  const out = [item.id];
  if (item.type === 'evolution') {
    const ch = getItem(item.style.character);
    if (ch && !ch.unlock && !inventory.includes(ch.id)) out.push(ch.id);
  }
  return out;
}

/** O que fica equipado ao usar um item: a evolução também equipa o boneco dela (se a pessoa o tiver). */
export function equipSlots(item: ShopItem, inventory: string[]): Partial<Record<ItemType, string>> {
  if (item.type === 'evolution') {
    return inventory.includes(item.style.character) ? { evolution: item.id, character: item.style.character } : { evolution: item.id };
  }
  return { [item.type]: item.id };
}

// ------------------------------------------------------------- economia
export const STARTING_COINS = 300;
export const DAILY_BONUS = 50;

/**
 * Modo desenvolvedor: com ele ativo na conta, todos os itens da loja saem de graça.
 * A senha NUNCA fica no código (o repositório é público): guardamos só a derivação
 * PBKDF2-SHA256 dela; quem confere é o servidor (ou o aparelho, nas contas locais).
 */
export const DEV_MODE_KDF = {
  salt: 'xadrez-arena/dev-mode/v1',
  iterations: 60000,
  hash: 'b53c500622b0d3453ba95fe2d6b8f92730f92f4410fb9cca6e45d29cb13cc7a3',
} as const;
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

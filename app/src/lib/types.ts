export interface PublicUser {
  id: string;
  username: string;
  rating: number;
  peakRating: number;
  level: number;
  levelName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
  winStreak: number;
  bestStreak: number;
  cosmetics: { avatar: string; character: string; move: string };
}

export type ItemType = 'board' | 'pieces' | 'avatar' | 'character' | 'move';
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';

export interface PrivateUser extends PublicUser {
  coins: number;
  inventory: string[];
  equipped: Record<ItemType, string>;
  dailyBonusAvailable: boolean;
}

export interface BoardStyle {
  light: string;
  dark: string;
  border: string;
  frame: number;
  coord: { light: string; dark: string };
  pattern: 'none' | 'grain' | 'marble' | 'grid' | 'stars' | 'shine';
  patternColor: string;
  highlight: string;
  /** Opcionais: catálogos antigos (em cache) não têm. */
  shape?: 'flat' | 'tiles' | 'round' | 'bevel' | 'glass';
  frameStyle?: 'plain' | 'line' | 'ornate' | 'rivets' | 'neon';
}

export interface PieceStyle {
  whiteFill: string;
  whiteOutline: string;
  blackFill: string;
  blackOutline: string;
  glow: number;
  model?: 'staunton' | 'modern' | 'medieval' | 'crystal' | 'cute' | 'robot' | 'pixel';
}

export interface AvatarStyle {
  emoji: string;
  background: string;
  ring: string;
}

export interface CharacterStyle {
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  hat: 'none' | 'cap' | 'crown' | 'tophat' | 'helmet' | 'headband' | 'hair';
  hatColor: string;
  face: 'smile' | 'grin' | 'shades' | 'mask' | 'visor';
}

interface ShopItemBase {
  id: string;
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

export interface AppNotification {
  id: string;
  type: 'welcome' | 'friend_request' | 'friend_accepted' | 'invite_missed' | 'game_result' | 'level_up' | 'reward';
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: number;
}

export interface TimeControl {
  id: string;
  label: string;
  initialMs: number;
  incrementMs: number;
}

export type Side = 'w' | 'b';

export interface GameState {
  id: string;
  white: PublicUser;
  black: PublicUser;
  fen: string;
  pgn: string;
  moves: string[];
  lastMove: { from: string; to: string } | null;
  turn: Side;
  inCheck: boolean;
  clocks: { white: number; black: number };
  clocksRunning: boolean;
  timeControl: TimeControl;
  rated: boolean;
  drawOffer: Side | null;
  serverTime: number;
}

export interface GameOver extends GameState {
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  reason: string;
  ratingChanges: { white: number; black: number };
  coinRewards: { white: number; black: number };
  streaks?: { white: number; black: number };
  levelUp: { white: boolean; black: boolean };
}

export interface Invite {
  id: string;
  from: PublicUser;
  to: PublicUser;
  timeControl: TimeControl;
  rated: boolean;
  color: 'white' | 'black' | 'random';
  createdAt: number;
  expiresAt: number;
}

export interface FriendEntry {
  requestId: string;
  user: PublicUser;
  online: boolean;
  inGame: boolean;
  since: number;
}

export type FriendshipStatus =
  | { status: 'none' }
  | { status: 'friends' | 'incoming' | 'outgoing'; id: string };

export interface GameSummary {
  id: string;
  color: 'white' | 'black';
  opponent: PublicUser | null;
  /** Nome do adversário quando não é um jogador (ex.: IA). */
  opponentName?: string;
  result: string;
  outcome: 'win' | 'loss' | 'draw';
  reason: string;
  rated: boolean;
  timeControl: string;
  ratingChange: number;
  endedAt: number;
}

export interface Ack {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

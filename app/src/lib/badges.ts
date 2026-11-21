import { AI_LEVELS } from '../ai';
import { aiRewardItem, badgeId } from './catalog';
import type { PieceType } from '../components/ChessPiece';

/**
 * Emblemas: um para cada IA vencida. O jogador escolhe um para mostrar no perfil e nas partidas.
 * A 1ª vitória contra cada IA também libera uma recompensa exclusiva (não vendida na loja).
 */
export interface BadgeInfo {
  id: string;
  level: number;
  /** Peça desenhada no emblema (a mesma do ícone da IA). */
  piece: PieceType;
  /** Cor do escudo: bronze, verde-água, azul, violeta e ouro (da mais fácil à mais difícil). */
  color: string;
  dark: string;
  rewardId?: string;
}

const PIECES: PieceType[] = ['p', 'n', 'b', 'r', 'q'];
const COLORS = [
  ['#d9925a', '#8a4f22'],
  ['#36d1b5', '#14806b'],
  ['#6fb8ff', '#2f6fb8'],
  ['#a68bff', '#5b3fc0'],
  ['#f4b942', '#a86d0c'],
];

export const BADGES: BadgeInfo[] = AI_LEVELS.map((l, i) => ({
  id: badgeId(l.id),
  level: l.id,
  piece: PIECES[i],
  color: COLORS[i][0],
  dark: COLORS[i][1],
  rewardId: aiRewardItem(l.id)?.id,
}));

export const getBadge = (id: string | null | undefined) => BADGES.find((b) => b.id === id);

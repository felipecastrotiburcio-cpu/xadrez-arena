import { reasonText, tStatic } from './i18n';
import type { Side } from './types';

const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

/** Peças capturadas de cada cor e vantagem material, a partir do FEN. */
export function materialInfo(fen: string) {
  const count: Record<Side, Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const ch of fen.split(' ')[0]) {
    const lower = ch.toLowerCase();
    if (!(lower in START_COUNT)) continue;
    count[ch === lower ? 'b' : 'w'][lower]++;
  }
  const captured: Record<Side, string[]> = { w: [], b: [] };
  let score = 0;
  for (const side of ['w', 'b'] as Side[]) {
    for (const t of ORDER) {
      const missing = Math.max(0, START_COUNT[t] - count[side][t]);
      for (let i = 0; i < missing; i++) captured[side].push(t);
    }
  }
  for (const t of ORDER) score += (count.w[t] - count.b[t]) * VALUES[t];
  // captured.w = peças brancas que foram capturadas (exibidas ao lado das pretas).
  return { captured, advantage: score };
}

export const PIECE_GLYPH: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  // ︎ força a apresentação como texto (sem emoji) no iOS/Android.
  p: '♟︎',
};

export function resultText(result: string | null, reason: string, mySide: Side | null) {
  // Textos no idioma atual; o motivo chega em português (do servidor) e é traduzido aqui.
  const why = reasonText(reason);
  if (!result) return { title: tStatic('result.cancelled'), subtitle: tStatic('result.cancelledSub'), outcome: 'draw' as const };
  if (result === '1/2-1/2') return { title: tStatic('result.draw'), subtitle: tStatic('result.by', { reason: why }), outcome: 'draw' as const };
  const whiteWon = result === '1-0';
  const won = mySide ? (mySide === 'w') === whiteWon : null;
  const winner = tStatic(whiteWon ? 'result.white' : 'result.black');
  if (won === null) return { title: tStatic('result.won', { winner }), subtitle: tStatic('result.by', { reason: why }), outcome: 'draw' as const };
  return {
    title: tStatic(won ? 'result.victory' : 'result.defeat'),
    subtitle: tStatic('result.wonBy', { winner, reason: why }),
    outcome: won ? ('win' as const) : ('loss' as const),
  };
}

/** O lado ainda consegue dar xeque-mate? (sem isso, quem perde no tempo empata — regra da FIDE usada por Lichess e Chess.com) */
export function hasMatingMaterial(fen: string, side: Side) {
  let minors = 0;
  const board = fen.split(' ')[0];
  for (const ch of board) {
    const isWhite = ch >= 'A' && ch <= 'Z';
    if (!/[a-z]/i.test(ch) || (side === 'w') !== isWhite) continue;
    const t = ch.toLowerCase();
    if (t === 'p' || t === 'r' || t === 'q') return true;
    if (t === 'n' || t === 'b') minors++;
  }
  return minors >= 2;
}

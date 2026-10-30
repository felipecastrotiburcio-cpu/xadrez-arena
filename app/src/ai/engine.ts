/**
 * Motor de xadrez próprio usado pela IA.
 *
 * Representação 0x88 (sq = rank * 16 + file, rank 0 = fileira 1), geração de
 * lances pseudo-legais com filtro de legalidade, hash Zobrist incremental,
 * busca negamax com poda alfa-beta, aprofundamento iterativo, busca de
 * quiescência, tabela de transposição e heurísticas de ordenação (MVV-LVA,
 * killer moves, history).
 *
 * O jogo em si (regras exibidas na UI, PGN etc.) é controlado pelo chess.js;
 * este motor só recebe um FEN e devolve o melhor lance.
 */

export type Color = 0 | 1;
export const WHITE = 0;
export const BLACK = 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_OFFSETS = [15, 17, -15, -17];
const ROOK_OFFSETS = [16, -16, 1, -1];
const KING_OFFSETS = [15, 17, -15, -17, 16, -16, 1, -1];

const F_DOUBLE = 1;
const F_EP = 2;
const F_CASTLE = 4;

// Lance codificado em um inteiro: from | to << 7 | promo << 14 | flags << 17
const encode = (from: number, to: number, promo = 0, flags = 0) =>
  from | (to << 7) | (promo << 14) | (flags << 17);
export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
const moveFlags = (m: number) => (m >> 17) & 15;

const pieceType = (p: number) => p & 7;
const pieceColor = (p: number) => (p >> 3) as Color;
const makePiece = (type: number, color: Color) => type | (color << 3);

export const squareName = (sq: number) =>
  'abcdefgh'[sq & 7] + String((sq >> 4) + 1);
export const parseSquare = (name: string) =>
  (Number(name[1]) - 1) * 16 + 'abcdefgh'.indexOf(name[0]);

// Máscara de direitos de roque: mexer em rei/torre (ou capturar torre) remove o direito.
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~2; // a1
CASTLE_MASK[4] = 15 & ~3; // e1
CASTLE_MASK[7] = 15 & ~1; // h1
CASTLE_MASK[112] = 15 & ~8; // a8
CASTLE_MASK[116] = 15 & ~12; // e8
CASTLE_MASK[119] = 15 & ~4; // h8

// ---------------------------------------------------------------- Zobrist
let seed = 0x2f6b9a1d;
const rand32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
};
const Z_PIECE: Int32Array[] = Array.from({ length: 16 }, () => {
  const t = new Int32Array(128);
  for (let i = 0; i < 128; i++) t[i] = rand32();
  return t;
});
const Z_CASTLE = Int32Array.from({ length: 16 }, rand32);
const Z_EP = Int32Array.from({ length: 128 }, rand32);
const Z_SIDE = rand32();

interface Undo {
  move: number;
  captured: number;
  capturedSq: number;
  castling: number;
  ep: number;
  halfmove: number;
  hash: number;
}

export class Position {
  board = new Int8Array(128);
  side: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = [0, 0];
  hash = 0;
  /** Hashes de todas as posições já ocorridas (para detectar repetição). */
  history: number[] = [];
  private undos: Undo[] = [];

  constructor(fen?: string) {
    if (fen) this.load(fen);
  }

  load(fen: string) {
    const [placement, side, castling, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    let rank = 7;
    let file = 0;
    for (const ch of placement) {
      if (ch === '/') {
        rank--;
        file = 0;
      } else if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else {
        const color: Color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const type = ' pnbrqk'.indexOf(ch.toLowerCase());
        const sq = rank * 16 + file;
        this.board[sq] = makePiece(type, color);
        if (type === KING) this.kings[color] = sq;
        file++;
      }
    }
    this.side = side === 'b' ? BLACK : WHITE;
    this.castling = 0;
    if (castling && castling !== '-') {
      if (castling.includes('K')) this.castling |= 1;
      if (castling.includes('Q')) this.castling |= 2;
      if (castling.includes('k')) this.castling |= 4;
      if (castling.includes('q')) this.castling |= 8;
    }
    this.ep = ep && ep !== '-' ? parseSquare(ep) : -1;
    this.halfmove = Number(half) || 0;
    this.fullmove = Number(full) || 1;
    this.undos = [];
    this.hash = this.computeHash();
    this.history = [this.hash];
  }

  computeHash() {
    let h = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = this.board[sq];
      if (p) h ^= Z_PIECE[p][sq];
    }
    h ^= Z_CASTLE[this.castling];
    if (this.ep !== -1) h ^= Z_EP[this.ep];
    if (this.side === BLACK) h ^= Z_SIDE;
    return h;
  }

  isAttacked(sq: number, by: Color): boolean {
    const b = this.board;
    // Peões
    if (by === WHITE) {
      const a = sq - 15;
      const c = sq - 17;
      if (!(a & 0x88) && b[a] === PAWN) return true;
      if (!(c & 0x88) && b[c] === PAWN) return true;
    } else {
      const a = sq + 15;
      const c = sq + 17;
      const bp = makePiece(PAWN, BLACK);
      if (!(a & 0x88) && b[a] === bp) return true;
      if (!(c & 0x88) && b[c] === bp) return true;
    }
    const n = makePiece(KNIGHT, by);
    for (const o of KNIGHT_OFFSETS) {
      const t = sq + o;
      if (!(t & 0x88) && b[t] === n) return true;
    }
    const k = makePiece(KING, by);
    for (const o of KING_OFFSETS) {
      const t = sq + o;
      if (!(t & 0x88) && b[t] === k) return true;
    }
    const bishop = makePiece(BISHOP, by);
    const rook = makePiece(ROOK, by);
    const queen = makePiece(QUEEN, by);
    for (const o of BISHOP_OFFSETS) {
      let t = sq + o;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        t += o;
      }
    }
    for (const o of ROOK_OFFSETS) {
      let t = sq + o;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
        t += o;
      }
    }
    return false;
  }

  inCheck(color: Color = this.side) {
    return this.isAttacked(this.kings[color], (color ^ 1) as Color);
  }

  /** Gera lances pseudo-legais. Com `noisy`, só capturas e promoções a dama. */
  generate(noisy = false): number[] {
    const moves: number[] = [];
    const b = this.board;
    const us = this.side;
    const them = (us ^ 1) as Color;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || pieceColor(p) !== us) continue;
      const type = pieceType(p);

      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const lastRank = us === WHITE ? 7 : 0;
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if (one >> 4 === lastRank) {
            moves.push(encode(sq, one, QUEEN));
            if (!noisy) {
              moves.push(encode(sq, one, ROOK));
              moves.push(encode(sq, one, BISHOP));
              moves.push(encode(sq, one, KNIGHT));
            }
          } else if (!noisy) {
            moves.push(encode(sq, one));
            const two = one + dir;
            if (sq >> 4 === startRank && !b[two]) moves.push(encode(sq, two, 0, F_DOUBLE));
          }
        }
        for (const side of [dir - 1, dir + 1]) {
          const t = sq + side;
          if (t & 0x88) continue;
          const target = b[t];
          if (target && pieceColor(target) === them) {
            if (t >> 4 === lastRank) {
              moves.push(encode(sq, t, QUEEN));
              if (!noisy) {
                moves.push(encode(sq, t, ROOK));
                moves.push(encode(sq, t, BISHOP));
                moves.push(encode(sq, t, KNIGHT));
              }
            } else {
              moves.push(encode(sq, t));
            }
          } else if (t === this.ep) {
            moves.push(encode(sq, t, 0, F_EP));
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (const o of offsets) {
          const t = sq + o;
          if (t & 0x88) continue;
          const target = b[t];
          if (!target) {
            if (!noisy) moves.push(encode(sq, t));
          } else if (pieceColor(target) === them) {
            moves.push(encode(sq, t));
          }
        }
      } else {
        const offsets =
          type === BISHOP ? BISHOP_OFFSETS : type === ROOK ? ROOK_OFFSETS : KING_OFFSETS;
        for (const o of offsets) {
          let t = sq + o;
          while (!(t & 0x88)) {
            const target = b[t];
            if (!target) {
              if (!noisy) moves.push(encode(sq, t));
            } else {
              if (pieceColor(target) === them) moves.push(encode(sq, t));
              break;
            }
            t += o;
          }
        }
      }

      if (type === KING && !noisy) {
        if (us === WHITE && sq === 4) {
          if (this.castling & 1 && !b[5] && !b[6] && b[7] === ROOK &&
            !this.isAttacked(4, BLACK) && !this.isAttacked(5, BLACK) && !this.isAttacked(6, BLACK)) {
            moves.push(encode(4, 6, 0, F_CASTLE));
          }
          if (this.castling & 2 && !b[3] && !b[2] && !b[1] && b[0] === ROOK &&
            !this.isAttacked(4, BLACK) && !this.isAttacked(3, BLACK) && !this.isAttacked(2, BLACK)) {
            moves.push(encode(4, 2, 0, F_CASTLE));
          }
        } else if (us === BLACK && sq === 116) {
          const br = makePiece(ROOK, BLACK);
          if (this.castling & 4 && !b[117] && !b[118] && b[119] === br &&
            !this.isAttacked(116, WHITE) && !this.isAttacked(117, WHITE) && !this.isAttacked(118, WHITE)) {
            moves.push(encode(116, 118, 0, F_CASTLE));
          }
          if (this.castling & 8 && !b[115] && !b[114] && !b[113] && b[112] === br &&
            !this.isAttacked(116, WHITE) && !this.isAttacked(115, WHITE) && !this.isAttacked(114, WHITE)) {
            moves.push(encode(116, 114, 0, F_CASTLE));
          }
        }
      }
    }
    return moves;
  }

  /** Executa o lance. Retorna false (e desfaz) se deixar o próprio rei em xeque. */
  make(m: number): boolean {
    const b = this.board;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const promo = movePromo(m);
    const piece = b[from];
    const us = this.side;
    let captured = b[to];
    let capturedSq = to;
    let h = this.hash;

    this.undos.push({
      move: m,
      captured: 0,
      capturedSq: to,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      hash: this.hash,
    });

    if (flags & F_EP) {
      capturedSq = us === WHITE ? to - 16 : to + 16;
      captured = b[capturedSq];
      b[capturedSq] = 0;
    }
    if (captured) h ^= Z_PIECE[captured][capturedSq];
    const undo = this.undos[this.undos.length - 1];
    undo.captured = captured;
    undo.capturedSq = capturedSq;

    h ^= Z_PIECE[piece][from];
    b[from] = 0;
    const placed = promo ? makePiece(promo, us) : piece;
    b[to] = placed;
    h ^= Z_PIECE[placed][to];

    if (flags & F_CASTLE) {
      const rook = makePiece(ROOK, us);
      const [rFrom, rTo] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      b[rFrom] = 0;
      b[rTo] = rook;
      h ^= Z_PIECE[rook][rFrom] ^ Z_PIECE[rook][rTo];
    }
    if (pieceType(piece) === KING) this.kings[us] = to;

    h ^= Z_CASTLE[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    h ^= Z_CASTLE[this.castling];

    if (this.ep !== -1) h ^= Z_EP[this.ep];
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep !== -1) h ^= Z_EP[this.ep];

    this.halfmove = pieceType(piece) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = (us ^ 1) as Color;
    h ^= Z_SIDE;
    this.hash = h;
    this.history.push(h);

    if (this.isAttacked(this.kings[us], this.side)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.undos.pop();
    if (!u) return;
    const b = this.board;
    const m = u.move;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    this.side = (this.side ^ 1) as Color;
    const us = this.side;
    const moved = movePromo(m) ? makePiece(PAWN, us) : b[to];
    b[from] = moved;
    b[to] = 0;
    if (u.captured) b[u.capturedSq] = u.captured;
    if (flags & F_CASTLE) {
      const rook = makePiece(ROOK, us);
      const [rFrom, rTo] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      b[rTo] = 0;
      b[rFrom] = rook;
    }
    if (pieceType(moved) === KING) this.kings[us] = from;
    if (us === BLACK) this.fullmove--;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.hash = u.hash;
    this.history.pop();
  }

  legalMoves(): number[] {
    const legal: number[] = [];
    for (const m of this.generate()) {
      if (this.make(m)) {
        legal.push(m);
        this.unmake();
      }
    }
    return legal;
  }

  isRepetition(): boolean {
    const h = this.hash;
    const hist = this.history;
    const limit = Math.max(0, hist.length - 1 - this.halfmove);
    for (let i = hist.length - 3; i >= limit; i -= 2) {
      if (hist[i] === h) return true;
    }
    return false;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    let nodes = 0;
    for (const m of this.generate()) {
      if (this.make(m)) {
        nodes += this.perft(depth - 1);
        this.unmake();
      }
    }
    return nodes;
  }
}

// ---------------------------------------------------------------- Avaliação

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Tabelas peça-casa (Simplified Evaluation Function), de a8 até h1 sob a ótica das brancas.
const PST: number[][] = [
  [],
  // Peão
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  // Cavalo
  [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  // Bispo
  [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  // Torre
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  // Dama
  [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  // Rei (meio-jogo)
  [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
];
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];
const PASSED_BONUS = [0, 5, 10, 20, 35, 60, 100, 0];

const pstIndex = (sq: number, color: Color) => {
  const rank = sq >> 4;
  const file = sq & 7;
  return color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
};

/** Avaliação estática em centipeões, do ponto de vista de quem joga. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  let mg = 0;
  let eg = 0;
  let phase = 0;
  const bishops = [0, 0];
  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const pawnRanks: number[][] = [[], []];

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const type = pieceType(p);
    const color = pieceColor(p);
    const sign = color === WHITE ? 1 : -1;
    const idx = pstIndex(sq, color);
    phase += PHASE[type];
    if (type === KING) {
      mg += sign * PST[KING][idx];
      eg += sign * KING_END[idx];
      continue;
    }
    const v = VALUE[type] + PST[type][idx];
    mg += sign * v;
    eg += sign * v;
    if (type === BISHOP) bishops[color]++;
    if (type === PAWN) {
      pawnFiles[color][sq & 7]++;
      pawnRanks[color].push(sq);
    }
  }

  // Par de bispos
  if (bishops[WHITE] >= 2) { mg += 30; eg += 40; }
  if (bishops[BLACK] >= 2) { mg -= 30; eg -= 40; }

  // Estrutura de peões: dobrados, isolados e passados
  for (const color of [WHITE, BLACK] as Color[]) {
    const sign = color === WHITE ? 1 : -1;
    const files = pawnFiles[color];
    const enemy = (color ^ 1) as Color;
    for (let f = 0; f < 8; f++) {
      if (files[f] > 1) {
        mg -= sign * 12 * (files[f] - 1);
        eg -= sign * 20 * (files[f] - 1);
      }
      if (files[f] && !(f > 0 && files[f - 1]) && !(f < 7 && files[f + 1])) {
        mg -= sign * 10 * files[f];
        eg -= sign * 15 * files[f];
      }
    }
    for (const sq of pawnRanks[color]) {
      const file = sq & 7;
      const rank = sq >> 4;
      let passed = true;
      for (const esq of pawnRanks[enemy]) {
        const ef = esq & 7;
        if (Math.abs(ef - file) > 1) continue;
        const er = esq >> 4;
        if (color === WHITE ? er > rank : er < rank) {
          passed = false;
          break;
        }
      }
      if (passed) {
        const rel = color === WHITE ? rank : 7 - rank;
        mg += sign * PASSED_BONUS[rel] * 0.5;
        eg += sign * PASSED_BONUS[rel];
      }
    }
  }

  const p = Math.min(phase, 24);
  const score = (mg * p + eg * (24 - p)) / 24;
  return Math.round(pos.side === WHITE ? score : -score);
}

// ---------------------------------------------------------------- Busca

const MATE = 100000;
const INF = 1000000;
const MAX_PLY = 64;

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  move: number;
}

class TimeUp extends Error {}

export interface SearchOptions {
  /** Profundidade máxima (em meio-lances). */
  depth: number;
  /** Tempo máximo em ms. */
  timeMs: number;
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
}

export class Searcher {
  nodes = 0;
  private deadline = 0;
  private tt = new Map<number, TTEntry>();
  private killers: number[][] = Array.from({ length: MAX_PLY + 1 }, () => [0, 0]);
  private historyTable = new Int32Array(128 * 128);

  constructor(private pos: Position) {}

  private checkTime() {
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new TimeUp();
  }

  private orderMoves(moves: number[], ttMove: number, ply: number): number[] {
    const b = this.pos.board;
    const killers = this.killers[ply] ?? [0, 0];
    const scored = moves.map((m) => {
      let s = 0;
      if (m === ttMove) s = 10_000_000;
      else {
        const victim = b[moveTo(m)];
        const promo = movePromo(m);
        if (victim) s = 1_000_000 + VALUE[pieceType(victim)] * 10 - VALUE[pieceType(b[moveFrom(m)])] / 10;
        else if (moveFlags(m) & F_EP) s = 1_000_000 + 1000;
        if (promo) s += 900_000 + VALUE[promo];
        if (!s) {
          if (m === killers[0]) s = 800_000;
          else if (m === killers[1]) s = 700_000;
          else s = this.historyTable[moveFrom(m) * 128 + moveTo(m)];
        }
      }
      return { m, s };
    });
    scored.sort((a, c) => c.s - a.s);
    return scored.map((x) => x.m);
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.nodes++;
    this.checkTime();
    const standPat = evaluate(this.pos);
    if (ply >= MAX_PLY) return standPat;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const moves = this.orderMoves(this.pos.generate(true), 0, ply);
    for (const m of moves) {
      // Poda delta: captura não consegue recuperar a diferença.
      const victim = this.pos.board[moveTo(m)];
      const gain = (victim ? VALUE[pieceType(victim)] : 100) + (movePromo(m) ? 800 : 0);
      if (standPat + gain + 200 < alpha) continue;
      if (!this.pos.make(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    if (ply > 0 && (pos.halfmove >= 100 || pos.isRepetition())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck && ply < MAX_PLY) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    this.nodes++;
    this.checkTime();

    const alphaOrig = alpha;
    const entry = this.tt.get(pos.hash);
    let ttMove = 0;
    if (entry) {
      ttMove = entry.move;
      if (ply > 0 && entry.depth >= depth) {
        if (entry.flag === TT_EXACT) return entry.score;
        if (entry.flag === TT_LOWER && entry.score >= beta) return entry.score;
        if (entry.flag === TT_UPPER && entry.score <= alpha) return entry.score;
      }
    }

    // Null move pruning (fora de xeque, com material suficiente).
    if (!inCheck && ply > 0 && depth >= 3 && beta < MATE - 1000 && this.hasPieces()) {
      const ep = pos.ep;
      const prevHash = pos.hash;
      pos.side = (pos.side ^ 1) as Color;
      pos.hash ^= Z_SIDE ^ (ep !== -1 ? Z_EP[ep] : 0);
      pos.ep = -1;
      pos.history.push(pos.hash);
      let score: number;
      try {
        score = -this.search(depth - 3, -beta, -beta + 1, ply + 1);
      } finally {
        pos.history.pop();
        pos.ep = ep;
        pos.hash = prevHash;
        pos.side = (pos.side ^ 1) as Color;
      }
      if (score >= beta) return beta;
    }

    const moves = this.orderMoves(pos.generate(), ttMove, ply);
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (const m of moves) {
      if (!pos.make(m)) continue;
      legal++;
      let score: number;
      try {
        score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        pos.unmake();
      }
      if (score > best) {
        best = score;
        bestMove = m;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        const quiet = !pos.board[moveTo(m)] && !movePromo(m) && !(moveFlags(m) & F_EP);
        if (quiet && ply <= MAX_PLY) {
          const k = this.killers[ply];
          if (k[0] !== m) {
            k[1] = k[0];
            k[0] = m;
          }
          this.historyTable[moveFrom(m) * 128 + moveTo(m)] += depth * depth;
        }
        break;
      }
    }

    if (legal === 0) return inCheck ? -MATE + ply : 0;

    const flag = best <= alphaOrig ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT;
    if (this.tt.size > 400_000) this.tt.clear();
    this.tt.set(pos.hash, { depth, score: best, flag, move: bestMove });
    return best;
  }

  private hasPieces() {
    const b = this.pos.board;
    const side = this.pos.side;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = b[sq];
      if (p && pieceColor(p) === side) {
        const t = pieceType(p);
        if (t !== PAWN && t !== KING) return true;
      }
    }
    return false;
  }

  /** Aprofundamento iterativo; devolve o melhor lance da última iteração completa. */
  think({ depth, timeMs }: SearchOptions): SearchResult {
    this.nodes = 0;
    this.deadline = Date.now() + timeMs;
    const legal = this.pos.legalMoves();
    if (legal.length === 0) return { move: 0, score: 0, depth: 0, nodes: 0 };
    let result: SearchResult = { move: legal[0], score: 0, depth: 0, nodes: 0 };
    if (legal.length === 1) return { ...result, depth: 1 };

    for (let d = 1; d <= depth; d++) {
      try {
        const score = this.search(d, -INF, INF, 0);
        const entry = this.tt.get(this.pos.hash);
        if (entry?.move) result = { move: entry.move, score, depth: d, nodes: this.nodes };
        if (Math.abs(score) > MATE - 100) break; // mate encontrado
      } catch (e) {
        if (e instanceof TimeUp) break;
        throw e;
      }
    }
    result.nodes = this.nodes;
    return result;
  }

  /** Pontua cada lance da raiz com janela cheia (usado pelos níveis "humanos"). */
  scoreRootMoves({ depth, timeMs }: SearchOptions): { move: number; score: number }[] {
    this.nodes = 0;
    this.deadline = Date.now() + timeMs;
    const out: { move: number; score: number }[] = [];
    let timedOut = false;
    for (const m of this.pos.legalMoves()) {
      this.pos.make(m);
      let score = -evaluate(this.pos);
      try {
        // Sem tempo: os lances restantes ficam só com a avaliação estática.
        if (!timedOut) score = -this.search(depth - 1, -INF, INF, 1);
      } catch (e) {
        if (!(e instanceof TimeUp)) throw e;
        timedOut = true;
      } finally {
        this.pos.unmake();
      }
      out.push({ move: m, score });
    }
    return out;
  }
}

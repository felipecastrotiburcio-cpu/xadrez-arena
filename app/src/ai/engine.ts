/**
 * Motor de xadrez próprio usado pela IA.
 *
 * Representação 0x88 (sq = rank * 16 + file, rank 0 = fileira 1), geração de
 * lances pseudo-legais com filtro de legalidade, hash Zobrist incremental,
 * busca negamax PVS com poda alfa-beta, aprofundamento iterativo, reduções de
 * lances tardios, busca de quiescência, tabela de transposição e heurísticas
 * de ordenação (MVV-LVA, killer moves, history).
 *
 * Otimizado para interpretadores (Hermes no celular): nada é alocado durante a
 * busca — pilhas, listas de lances e tabela de transposição são arrays tipados
 * pré-alocados, e os laços são indexados.
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

const KNIGHT_OFFSETS = Int32Array.of(33, 31, 18, 14, -33, -31, -18, -14);
const BISHOP_OFFSETS = Int32Array.of(15, 17, -15, -17);
const ROOK_OFFSETS = Int32Array.of(16, -16, 1, -1);
const KING_OFFSETS = Int32Array.of(15, 17, -15, -17, 16, -16, 1, -1);

const F_DOUBLE = 1;
const F_EP = 2;
const F_CASTLE = 4;

// Lance codificado em um inteiro: from | to << 7 | promo << 14 | flags << 17
const encode = (from: number, to: number, promo: number, flags: number) =>
  from | (to << 7) | (promo << 14) | (flags << 17);
export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
const moveFlags = (m: number) => (m >> 17) & 15;

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
/** Z_PIECE[peça * 128 + casa] */
const Z_PIECE = new Int32Array(16 * 128);
for (let i = 0; i < Z_PIECE.length; i++) Z_PIECE[i] = rand32();
const Z_CASTLE = Int32Array.from({ length: 16 }, rand32);
const Z_EP = Int32Array.from({ length: 128 }, rand32);
const Z_SIDE = rand32();

const MAX_UNDO = 1024;
/** Tamanho máximo de uma lista de lances (o máximo legal conhecido é 218). */
export const MAX_MOVES = 256;

export class Position {
  board = new Int8Array(128);
  side: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = new Int32Array(2);
  hash = 0;
  /** Hashes de todas as posições já ocorridas (para detectar repetição). */
  history: number[] = [];
  // Pilha de desfazer em arrays tipados (sem alocação por lance).
  private sp = 0;
  private uMove = new Int32Array(MAX_UNDO);
  private uCaptured = new Int8Array(MAX_UNDO);
  private uCapSq = new Int16Array(MAX_UNDO);
  private uCastling = new Int8Array(MAX_UNDO);
  private uEp = new Int16Array(MAX_UNDO);
  private uHalf = new Int16Array(MAX_UNDO);
  private uHash = new Int32Array(MAX_UNDO);

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
        this.board[sq] = type | (color << 3);
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
    this.sp = 0;
    this.hash = this.computeHash();
    this.history = [this.hash];
  }

  computeHash() {
    let h = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = this.board[sq];
      if (p) h ^= Z_PIECE[p * 128 + sq];
    }
    h ^= Z_CASTLE[this.castling];
    if (this.ep !== -1) h ^= Z_EP[this.ep];
    if (this.side === BLACK) h ^= Z_SIDE;
    return h;
  }

  isAttacked(sq: number, by: number): boolean {
    const b = this.board;
    let t: number;
    // Peões
    if (by === WHITE) {
      t = sq - 15;
      if (!(t & 0x88) && b[t] === PAWN) return true;
      t = sq - 17;
      if (!(t & 0x88) && b[t] === PAWN) return true;
    } else {
      t = sq + 15;
      if (!(t & 0x88) && b[t] === (PAWN | 8)) return true;
      t = sq + 17;
      if (!(t & 0x88) && b[t] === (PAWN | 8)) return true;
    }
    const c = by << 3;
    const n = KNIGHT | c;
    for (let i = 0; i < 8; i++) {
      t = sq + KNIGHT_OFFSETS[i];
      if (!(t & 0x88) && b[t] === n) return true;
    }
    const k = KING | c;
    for (let i = 0; i < 8; i++) {
      t = sq + KING_OFFSETS[i];
      if (!(t & 0x88) && b[t] === k) return true;
    }
    const bishop = BISHOP | c;
    const rook = ROOK | c;
    const queen = QUEEN | c;
    for (let i = 0; i < 4; i++) {
      const o = BISHOP_OFFSETS[i];
      t = sq + o;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        t += o;
      }
    }
    for (let i = 0; i < 4; i++) {
      const o = ROOK_OFFSETS[i];
      t = sq + o;
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

  inCheck(color: number = this.side) {
    return this.isAttacked(this.kings[color], color ^ 1);
  }

  /**
   * Escreve os lances pseudo-legais em `out` a partir de `start` e devolve o novo fim.
   * Com `noisy`, só capturas e promoções a dama.
   */
  genInto(out: Int32Array, start: number, noisy: boolean): number {
    let n = start;
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || p >> 3 !== us) continue;
      const type = p & 7;

      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const lastRank = us === WHITE ? 7 : 0;
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if (one >> 4 === lastRank) {
            out[n++] = encode(sq, one, QUEEN, 0);
            if (!noisy) {
              out[n++] = encode(sq, one, ROOK, 0);
              out[n++] = encode(sq, one, BISHOP, 0);
              out[n++] = encode(sq, one, KNIGHT, 0);
            }
          } else if (!noisy) {
            out[n++] = encode(sq, one, 0, 0);
            const two = one + dir;
            if (sq >> 4 === startRank && !b[two]) out[n++] = encode(sq, two, 0, F_DOUBLE);
          }
        }
        for (let s = -1; s <= 1; s += 2) {
          const t = one + s;
          if (t & 0x88) continue;
          const target = b[t];
          if (target && target >> 3 === them) {
            if (t >> 4 === lastRank) {
              out[n++] = encode(sq, t, QUEEN, 0);
              if (!noisy) {
                out[n++] = encode(sq, t, ROOK, 0);
                out[n++] = encode(sq, t, BISHOP, 0);
                out[n++] = encode(sq, t, KNIGHT, 0);
              }
            } else {
              out[n++] = encode(sq, t, 0, 0);
            }
          } else if (t === this.ep) {
            out[n++] = encode(sq, t, 0, F_EP);
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (let i = 0; i < 8; i++) {
          const t = sq + offsets[i];
          if (t & 0x88) continue;
          const target = b[t];
          if (!target) {
            if (!noisy) out[n++] = encode(sq, t, 0, 0);
          } else if (target >> 3 === them) {
            out[n++] = encode(sq, t, 0, 0);
          }
        }
      } else {
        const offsets = type === BISHOP ? BISHOP_OFFSETS : type === ROOK ? ROOK_OFFSETS : KING_OFFSETS;
        const count = offsets.length;
        for (let i = 0; i < count; i++) {
          const o = offsets[i];
          let t = sq + o;
          while (!(t & 0x88)) {
            const target = b[t];
            if (!target) {
              if (!noisy) out[n++] = encode(sq, t, 0, 0);
            } else {
              if (target >> 3 === them) out[n++] = encode(sq, t, 0, 0);
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
            out[n++] = encode(4, 6, 0, F_CASTLE);
          }
          if (this.castling & 2 && !b[3] && !b[2] && !b[1] && b[0] === ROOK &&
            !this.isAttacked(4, BLACK) && !this.isAttacked(3, BLACK) && !this.isAttacked(2, BLACK)) {
            out[n++] = encode(4, 2, 0, F_CASTLE);
          }
        } else if (us === BLACK && sq === 116) {
          const br = ROOK | 8;
          if (this.castling & 4 && !b[117] && !b[118] && b[119] === br &&
            !this.isAttacked(116, WHITE) && !this.isAttacked(117, WHITE) && !this.isAttacked(118, WHITE)) {
            out[n++] = encode(116, 118, 0, F_CASTLE);
          }
          if (this.castling & 8 && !b[115] && !b[114] && !b[113] && b[112] === br &&
            !this.isAttacked(116, WHITE) && !this.isAttacked(115, WHITE) && !this.isAttacked(114, WHITE)) {
            out[n++] = encode(116, 114, 0, F_CASTLE);
          }
        }
      }
    }
    return n;
  }

  /** Lances pseudo-legais como array comum (fora da busca). */
  generate(noisy = false): number[] {
    const buf = new Int32Array(MAX_MOVES);
    return Array.from(buf.subarray(0, this.genInto(buf, 0, noisy)));
  }

  /** Executa o lance. Retorna false (e desfaz) se deixar o próprio rei em xeque. */
  make(m: number): boolean {
    const b = this.board;
    const from = m & 127;
    const to = (m >> 7) & 127;
    const flags = (m >> 17) & 15;
    const promo = (m >> 14) & 7;
    const piece = b[from];
    const us = this.side;
    let captured = b[to];
    let capturedSq = to;
    let h = this.hash;

    const i = this.sp++;
    this.uMove[i] = m;
    this.uCastling[i] = this.castling;
    this.uEp[i] = this.ep;
    this.uHalf[i] = this.halfmove;
    this.uHash[i] = h;

    if (flags & F_EP) {
      capturedSq = us === WHITE ? to - 16 : to + 16;
      captured = b[capturedSq];
      b[capturedSq] = 0;
    }
    if (captured) h ^= Z_PIECE[captured * 128 + capturedSq];
    this.uCaptured[i] = captured;
    this.uCapSq[i] = capturedSq;

    h ^= Z_PIECE[piece * 128 + from];
    b[from] = 0;
    const placed = promo ? promo | (us << 3) : piece;
    b[to] = placed;
    h ^= Z_PIECE[placed * 128 + to];

    if (flags & F_CASTLE) {
      const rook = ROOK | (us << 3);
      const rFrom = to > from ? from + 3 : from - 4;
      const rTo = to > from ? from + 1 : from - 1;
      b[rFrom] = 0;
      b[rTo] = rook;
      h ^= Z_PIECE[rook * 128 + rFrom] ^ Z_PIECE[rook * 128 + rTo];
    }
    if ((piece & 7) === KING) this.kings[us] = to;

    h ^= Z_CASTLE[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    h ^= Z_CASTLE[this.castling];

    if (this.ep !== -1) h ^= Z_EP[this.ep];
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep !== -1) h ^= Z_EP[this.ep];

    this.halfmove = (piece & 7) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = (us ^ 1) as Color;
    h ^= Z_SIDE;
    this.hash = h;
    this.history.push(h);

    if (this.isAttacked(this.kings[us], us ^ 1)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    if (this.sp === 0) return;
    const i = --this.sp;
    const b = this.board;
    const m = this.uMove[i];
    const from = m & 127;
    const to = (m >> 7) & 127;
    const flags = (m >> 17) & 15;
    this.side = (this.side ^ 1) as Color;
    const us = this.side;
    const moved = (m >> 14) & 7 ? PAWN | (us << 3) : b[to];
    b[from] = moved;
    b[to] = 0;
    const captured = this.uCaptured[i];
    if (captured) b[this.uCapSq[i]] = captured;
    if (flags & F_CASTLE) {
      const rFrom = to > from ? from + 3 : from - 4;
      const rTo = to > from ? from + 1 : from - 1;
      b[rTo] = 0;
      b[rFrom] = ROOK | (us << 3);
    }
    if ((moved & 7) === KING) this.kings[us] = from;
    if (us === BLACK) this.fullmove--;
    this.castling = this.uCastling[i];
    this.ep = this.uEp[i];
    this.halfmove = this.uHalf[i];
    this.hash = this.uHash[i];
    this.history.pop();
  }

  /** Altura atual da pilha de desfazer. */
  stackDepth() {
    return this.sp;
  }

  /** Desfaz lances até a pilha voltar à altura `sp` (após interromper a busca). */
  rewind(sp: number) {
    while (this.sp > sp) {
      if (this.uMove[this.sp - 1] === 0) this.unmakeNull();
      else this.unmake();
    }
  }

  /** Passa a vez (null move) — usado pela poda de lance nulo. */
  makeNull() {
    const i = this.sp++;
    this.uMove[i] = 0;
    this.uEp[i] = this.ep;
    this.uHash[i] = this.hash;
    if (this.ep !== -1) this.hash ^= Z_EP[this.ep];
    this.ep = -1;
    this.side = (this.side ^ 1) as Color;
    this.hash ^= Z_SIDE;
    this.history.push(this.hash);
  }

  unmakeNull() {
    const i = --this.sp;
    this.side = (this.side ^ 1) as Color;
    this.ep = this.uEp[i];
    this.hash = this.uHash[i];
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
    const buf = new Int32Array(MAX_MOVES);
    const n = this.genInto(buf, 0, false);
    let nodes = 0;
    for (let i = 0; i < n; i++) {
      if (this.make(buf[i])) {
        nodes += this.perft(depth - 1);
        this.unmake();
      }
    }
    return nodes;
  }
}

// ---------------------------------------------------------------- Avaliação

const VALUE = Int32Array.of(0, 100, 320, 330, 500, 900, 0);
const PHASE = Int32Array.of(0, 0, 1, 1, 2, 4, 0);

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

// Tabelas achatadas em arrays tipados: PST_FLAT[tipo * 64 + índice]
const PST_FLAT = new Int32Array(8 * 64);
for (let t = 1; t <= 6; t++) for (let i = 0; i < 64; i++) PST_FLAT[t * 64 + i] = PST[t][i];
const KING_END_FLAT = Int32Array.from(KING_END);
const PASSED = Int32Array.from(PASSED_BONUS);

// Áreas de rascunho da avaliação (reaproveitadas a cada chamada).
const pawnFiles = new Int8Array(16); // cor * 8 + coluna
const pawnSq = new Int16Array(32); // cor * 16 + n
const pawnCount = new Int32Array(2);

/** Avaliação estática em centipeões, do ponto de vista de quem joga. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  let mg = 0;
  let eg = 0;
  let phase = 0;
  let bishopsW = 0;
  let bishopsB = 0;
  pawnFiles.fill(0);
  pawnCount[0] = 0;
  pawnCount[1] = 0;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const type = p & 7;
    const color = p >> 3;
    const rank = sq >> 4;
    const file = sq & 7;
    const idx = color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
    phase += PHASE[type];
    if (type === KING) {
      if (color === WHITE) {
        mg += PST_FLAT[KING * 64 + idx];
        eg += KING_END_FLAT[idx];
      } else {
        mg -= PST_FLAT[KING * 64 + idx];
        eg -= KING_END_FLAT[idx];
      }
      continue;
    }
    const v = VALUE[type] + PST_FLAT[type * 64 + idx];
    if (color === WHITE) {
      mg += v;
      eg += v;
    } else {
      mg -= v;
      eg -= v;
    }
    if (type === BISHOP) {
      if (color === WHITE) bishopsW++;
      else bishopsB++;
    } else if (type === PAWN) {
      pawnFiles[color * 8 + file]++;
      pawnSq[color * 16 + pawnCount[color]++] = sq;
    }
  }

  // Par de bispos
  if (bishopsW >= 2) {
    mg += 30;
    eg += 40;
  }
  if (bishopsB >= 2) {
    mg -= 30;
    eg -= 40;
  }

  // Estrutura de peões: dobrados, isolados e passados
  for (let color = 0; color < 2; color++) {
    const sign = color === WHITE ? 1 : -1;
    const fb = color * 8;
    for (let f = 0; f < 8; f++) {
      const cnt = pawnFiles[fb + f];
      if (!cnt) continue;
      if (cnt > 1) {
        mg -= sign * 12 * (cnt - 1);
        eg -= sign * 20 * (cnt - 1);
      }
      if (!(f > 0 && pawnFiles[fb + f - 1]) && !(f < 7 && pawnFiles[fb + f + 1])) {
        mg -= sign * 10 * cnt;
        eg -= sign * 15 * cnt;
      }
    }
    const enemy = color ^ 1;
    const nEnemy = pawnCount[enemy];
    for (let i = 0; i < pawnCount[color]; i++) {
      const sq = pawnSq[color * 16 + i];
      const file = sq & 7;
      const rank = sq >> 4;
      let passed = true;
      for (let j = 0; j < nEnemy; j++) {
        const esq = pawnSq[enemy * 16 + j];
        const df = (esq & 7) - file;
        if (df > 1 || df < -1) continue;
        const er = esq >> 4;
        if (color === WHITE ? er > rank : er < rank) {
          passed = false;
          break;
        }
      }
      if (passed) {
        const bonus = PASSED[color === WHITE ? rank : 7 - rank];
        mg += (sign * bonus) >> 1;
        eg += sign * bonus;
      }
    }
  }

  const ph = phase > 24 ? 24 : phase;
  const score = ((mg * ph + eg * (24 - ph)) / 24) | 0;
  return pos.side === WHITE ? score : -score;
}

// ---------------------------------------------------------------- Busca

const MATE = 100000;
const INF = 1000000;
const MAX_PLY = 64;

const TT_SIZE = 1 << 18;
const TT_MASK = TT_SIZE - 1;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

/** Sinal de "tempo esgotado" (objeto simples: lançar Error captura pilha, o que é caro). */
const TIME_UP = { timeUp: true };

const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Memória da busca, alocada uma vez e reaproveitada (a tabela de transposição persiste entre lances). */
class SearchMemory {
  ttKey = new Int32Array(TT_SIZE);
  ttMove = new Int32Array(TT_SIZE);
  ttScore = new Int32Array(TT_SIZE);
  ttDepth = new Int8Array(TT_SIZE);
  ttFlag = new Int8Array(TT_SIZE);
  killers = new Int32Array((MAX_PLY + 2) * 2);
  history = new Int32Array(128 * 128);
  moves = new Int32Array((MAX_PLY + 2) * MAX_MOVES);
  scores = new Int32Array((MAX_PLY + 2) * MAX_MOVES);
}
let memory: SearchMemory | null = null;

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
  private rootBest = 0;
  private m: SearchMemory;

  constructor(private pos: Position) {
    memory ??= new SearchMemory();
    this.m = memory;
    this.m.killers.fill(0);
    this.m.history.fill(0);
  }

  private ttStore(depth: number, score: number, flag: number, move: number, ply: number) {
    const m = this.m;
    const i = this.pos.hash & TT_MASK;
    // Prefere manter entradas mais profundas da mesma posição.
    if (m.ttFlag[i] && m.ttKey[i] === this.pos.hash && m.ttDepth[i] > depth && flag !== TT_EXACT) return;
    // Notas de mate guardadas relativas à posição, não à raiz.
    if (score > MATE - 1000) score += ply;
    else if (score < -MATE + 1000) score -= ply;
    m.ttKey[i] = this.pos.hash;
    m.ttDepth[i] = depth > 127 ? 127 : depth;
    m.ttScore[i] = score;
    m.ttFlag[i] = flag;
    m.ttMove[i] = move;
  }

  /** Dá notas para ordenar os lances [base, end). */
  private scoreMoves(base: number, end: number, ttMove: number, ply: number) {
    const b = this.pos.board;
    const mv = this.m.moves;
    const sc = this.m.scores;
    const k0 = this.m.killers[ply * 2];
    const k1 = this.m.killers[ply * 2 + 1];
    const hist = this.m.history;
    for (let i = base; i < end; i++) {
      const m = mv[i];
      let s = 0;
      if (m === ttMove) s = 10_000_000;
      else {
        const victim = b[(m >> 7) & 127];
        const promo = (m >> 14) & 7;
        if (victim) s = 1_000_000 + VALUE[victim & 7] * 10 - ((VALUE[b[m & 127] & 7] / 10) | 0);
        else if ((m >> 17) & F_EP) s = 1_001_000;
        if (promo) s += 900_000 + VALUE[promo];
        if (!s) {
          if (m === k0) s = 800_000;
          else if (m === k1) s = 700_000;
          else s = hist[(m & 127) * 128 + ((m >> 7) & 127)];
        }
      }
      sc[i] = s;
    }
  }

  /** Traz para a posição i o lance de maior nota em [i, end). */
  private pickBest(i: number, end: number) {
    const mv = this.m.moves;
    const sc = this.m.scores;
    let best = i;
    for (let j = i + 1; j < end; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) {
      const tm = mv[i];
      mv[i] = mv[best];
      mv[best] = tm;
      const ts = sc[i];
      sc[i] = sc[best];
      sc[best] = ts;
    }
  }

  private tick() {
    this.nodes++;
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) throw TIME_UP;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.tick();
    const pos = this.pos;
    const standPat = evaluate(pos);
    if (ply >= MAX_PLY) return standPat;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const base = ply * MAX_MOVES;
    const end = pos.genInto(this.m.moves, base, true);
    this.scoreMoves(base, end, 0, ply);
    const b = pos.board;
    for (let i = base; i < end; i++) {
      this.pickBest(i, end);
      const m = this.m.moves[i];
      // Poda delta: a captura não consegue recuperar a diferença.
      const victim = b[(m >> 7) & 127];
      const gain = (victim ? VALUE[victim & 7] : 100) + ((m >> 14) & 7 ? 800 : 0);
      if (standPat + gain + 200 < alpha) continue;
      if (!pos.make(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    if (ply > 0 && (pos.halfmove >= 100 || pos.isRepetition())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck && ply < MAX_PLY) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    this.tick();
    if (ply >= MAX_PLY) return evaluate(pos);

    const m = this.m;
    const alphaOrig = alpha;
    const ti = pos.hash & TT_MASK;
    let ttMove = 0;
    if (m.ttFlag[ti] && m.ttKey[ti] === pos.hash) {
      ttMove = m.ttMove[ti];
      if (ply > 0 && m.ttDepth[ti] >= depth) {
        let s = m.ttScore[ti];
        if (s > MATE - 1000) s -= ply;
        else if (s < -MATE + 1000) s += ply;
        const f = m.ttFlag[ti];
        if (f === TT_EXACT) return s;
        if (f === TT_LOWER && s >= beta) return s;
        if (f === TT_UPPER && s <= alpha) return s;
      }
    }

    // Poda de lance nulo (fora de xeque, com material suficiente).
    if (allowNull && !inCheck && ply > 0 && depth >= 3 && beta < MATE - 1000 && this.hasPieces()) {
      pos.makeNull();
      const score = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (score >= beta) return beta;
    }

    const base = ply * MAX_MOVES;
    const end = pos.genInto(m.moves, base, false);
    this.scoreMoves(base, end, ttMove, ply);
    const b = pos.board;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (let i = base; i < end; i++) {
      this.pickBest(i, end);
      const mv = m.moves[i];
      const quiet = !b[(mv >> 7) & 127] && !((mv >> 14) & 7) && !((mv >> 17) & F_EP);
      if (!pos.make(mv)) continue;
      legal++;
      let score: number;
      if (legal === 1) {
        score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        // Redução de lances tardios: lances quietos no fim da lista quase nunca são os melhores.
        const reduce =
          depth >= 3 && legal > 3 && quiet && !inCheck && mv !== m.killers[ply * 2] && mv !== m.killers[ply * 2 + 1]
            ? 1
            : 0;
        score = -this.search(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && reduce) score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (score > best) {
        best = score;
        bestMove = mv;
        if (ply === 0) this.rootBest = mv;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (quiet && ply <= MAX_PLY) {
          const k = ply * 2;
          if (m.killers[k] !== mv) {
            m.killers[k + 1] = m.killers[k];
            m.killers[k] = mv;
          }
          m.history[(mv & 127) * 128 + ((mv >> 7) & 127)] += depth * depth;
        }
        break;
      }
    }

    if (legal === 0) return inCheck ? -MATE + ply : 0;
    this.ttStore(depth, best, best <= alphaOrig ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT, bestMove, ply);
    return best;
  }

  private hasPieces() {
    const b = this.pos.board;
    const side = this.pos.side;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (p && p >> 3 === side) {
        const t = p & 7;
        if (t !== PAWN && t !== KING) return true;
      }
    }
    return false;
  }

  /** Executa uma iteração; em caso de tempo esgotado, restaura a posição e devolve null. */
  private iterate(d: number): number | null {
    const sp = this.pos.stackDepth();
    try {
      return this.search(d, -INF, INF, 0, true);
    } catch (e) {
      if (e !== TIME_UP) throw e;
      this.pos.rewind(sp);
      return null;
    }
  }

  private begin(timeMs: number) {
    this.nodes = 0;
    this.rootBest = 0;
    this.deadline = Date.now() + timeMs;
    const legal = this.pos.legalMoves();
    return legal;
  }

  /** Aprofundamento iterativo; devolve o melhor lance da última iteração completa. */
  think({ depth, timeMs }: SearchOptions): SearchResult {
    const legal = this.begin(timeMs);
    if (legal.length === 0) return { move: 0, score: 0, depth: 0, nodes: 0 };
    let result: SearchResult = { move: legal[0], score: 0, depth: 0, nodes: 0 };
    if (legal.length === 1) return { ...result, depth: 1 };
    for (let d = 1; d <= depth; d++) {
      const score = this.iterate(d);
      if (score === null) break;
      if (this.rootBest) result = { move: this.rootBest, score, depth: d, nodes: this.nodes };
      if (Math.abs(score) > MATE - 100) break;
    }
    result.nodes = this.nodes;
    return result;
  }

  /** Igual a think(), mas devolve o controle à interface entre as iterações. */
  async thinkAsync({ depth, timeMs }: SearchOptions): Promise<SearchResult> {
    const legal = this.begin(timeMs);
    if (legal.length === 0) return { move: 0, score: 0, depth: 0, nodes: 0 };
    let result: SearchResult = { move: legal[0], score: 0, depth: 0, nodes: 0 };
    if (legal.length === 1) return { ...result, depth: 1 };
    for (let d = 1; d <= depth; d++) {
      await yieldToUI();
      if (Date.now() > this.deadline) break;
      const score = this.iterate(d);
      if (score === null) break;
      if (this.rootBest) result = { move: this.rootBest, score, depth: d, nodes: this.nodes };
      if (Math.abs(score) > MATE - 100) break;
    }
    result.nodes = this.nodes;
    return result;
  }

  private scoreRoot(mv: number, depth: number, timedOut: boolean): { score: number; timedOut: boolean } {
    const sp = this.pos.stackDepth();
    this.pos.make(mv);
    let score = -evaluate(this.pos);
    if (!timedOut) {
      try {
        score = -this.search(depth - 1, -INF, INF, 1, true);
      } catch (e) {
        if (e !== TIME_UP) throw e;
        timedOut = true;
      }
    }
    // Sem tempo, os lances restantes ficam só com a avaliação estática.
    this.pos.rewind(sp);
    return { score, timedOut };
  }

  /** Pontua cada lance da raiz com janela cheia (usado pelos níveis "humanos"). */
  scoreRootMoves({ depth, timeMs }: SearchOptions): { move: number; score: number }[] {
    const legal = this.begin(timeMs);
    const out: { move: number; score: number }[] = [];
    let timedOut = false;
    for (const mv of legal) {
      const r = this.scoreRoot(mv, depth, timedOut);
      timedOut = r.timedOut;
      out.push({ move: mv, score: r.score });
    }
    return out;
  }

  /** Igual a scoreRootMoves(), devolvendo o controle à interface entre os lances. */
  async scoreRootMovesAsync({ depth, timeMs }: SearchOptions): Promise<{ move: number; score: number }[]> {
    const legal = this.begin(timeMs);
    const out: { move: number; score: number }[] = [];
    let timedOut = false;
    for (const mv of legal) {
      await yieldToUI();
      const r = this.scoreRoot(mv, depth, timedOut);
      timedOut = r.timedOut;
      out.push({ move: mv, score: r.score });
    }
    return out;
  }
}

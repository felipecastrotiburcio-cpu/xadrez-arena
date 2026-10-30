import {
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  Position,
  Searcher,
  moveFrom,
  movePromo,
  moveTo,
  squareName,
} from './engine';

export interface AiLevel {
  id: number;
  name: string;
  description: string;
  /** Elo aproximado, só para exibição. */
  elo: number;
  depth: number;
  timeMs: number;
  /** Ruído (centipeões) somado às notas dos lances da raiz. 0 = joga o melhor lance. */
  noise: number;
  /** Chance de jogar um lance aleatório. */
  blunder: number;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 1, name: 'Peão Curioso', description: 'Está aprendendo a mexer as peças.', elo: 400, depth: 1, timeMs: 400, noise: 180, blunder: 0.25 },
  { id: 2, name: 'Cavalo Aprendiz', description: 'Vê ameaças simples, mas se distrai.', elo: 800, depth: 2, timeMs: 600, noise: 90, blunder: 0.08 },
  { id: 3, name: 'Bispo Estrategista', description: 'Joga sólido e pune erros.', elo: 1200, depth: 3, timeMs: 1000, noise: 30, blunder: 0 },
  { id: 4, name: 'Torre Implacável', description: 'Calcula táticas com precisão.', elo: 1600, depth: 6, timeMs: 1500, noise: 0, blunder: 0 },
  { id: 5, name: 'Dama Mestra', description: 'Usa todo o poder do motor.', elo: 2000, depth: 20, timeMs: 3000, noise: 0, blunder: 0 },
];

export interface AiMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

const PROMO_CHAR: Record<number, AiMove['promotion']> = {
  [KNIGHT]: 'n',
  [BISHOP]: 'b',
  [ROOK]: 'r',
  [QUEEN]: 'q',
};

function toAiMove(m: number): AiMove {
  const promo = movePromo(m);
  return {
    from: squareName(moveFrom(m)),
    to: squareName(moveTo(m)),
    ...(promo ? { promotion: PROMO_CHAR[promo] } : {}),
  };
}

export interface FindMoveOptions {
  level: number;
  /** FENs das posições anteriores (para o motor reconhecer repetições). */
  history?: string[];
  random?: () => number;
}

export interface FindMoveResult {
  move: AiMove | null;
  /** Avaliação em centipeões do ponto de vista de quem joga. */
  score: number;
  depth: number;
  nodes: number;
}

export function findBestMove(fen: string, { level, history = [], random = Math.random }: FindMoveOptions): FindMoveResult {
  const cfg = AI_LEVELS.find((l) => l.id === level) ?? AI_LEVELS[2];
  const pos = new Position(fen);
  if (history.length) {
    const hashes = history.map((f) => new Position(f).hash);
    pos.history = [...hashes, pos.hash];
  }

  const legal = pos.legalMoves();
  if (legal.length === 0) return { move: null, score: 0, depth: 0, nodes: 0 };

  if (cfg.blunder > 0 && random() < cfg.blunder) {
    const m = legal[Math.floor(random() * legal.length)];
    return { move: toAiMove(m), score: 0, depth: 0, nodes: 0 };
  }

  const searcher = new Searcher(pos);

  if (cfg.noise > 0) {
    const scored = searcher.scoreRootMoves({ depth: cfg.depth, timeMs: cfg.timeMs });
    let best = scored[0];
    let bestNoisy = -Infinity;
    for (const s of scored) {
      const noisy = s.score + (random() * 2 - 1) * cfg.noise;
      if (noisy > bestNoisy) {
        bestNoisy = noisy;
        best = s;
      }
    }
    return { move: toAiMove(best.move), score: best.score, depth: cfg.depth, nodes: searcher.nodes };
  }

  const r = searcher.think({ depth: cfg.depth, timeMs: cfg.timeMs });
  return { move: r.move ? toAiMove(r.move) : null, score: r.score, depth: r.depth, nodes: r.nodes };
}

/** Dica para o jogador: lance sugerido pelo motor com busca curta. */
export function suggestMove(fen: string, history: string[] = []): AiMove | null {
  const pos = new Position(fen);
  if (history.length) pos.history = [...history.map((f) => new Position(f).hash), pos.hash];
  return toAiMoveOrNull(new Searcher(pos).think({ depth: 8, timeMs: 1200 }).move);
}

function toAiMoveOrNull(m: number) {
  return m ? toAiMove(m) : null;
}

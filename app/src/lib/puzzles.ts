/**
 * Banco de desafios de treino (gerado e conferido por computador).
 * Cada desafio: posição (FEN, brancas jogam), lances da solução em UCI (o jogador e as respostas do
 * adversário, alternados) e o objetivo: dar mate ou ganhar material.
 * Conferidos em src/lib/__tests__/puzzles.test.ts (lances legais, mate forçado, ganho de material).
 */

export type PuzzleGoal = 'mate' | 'win';

export interface Puzzle {
  id: string;
  /** 1 = primeiros passos … 5 = mestre. */
  tier: 1 | 2 | 3 | 4 | 5;
  theme: string;
  fen: string;
  moves: string[];
  goal: PuzzleGoal;
}

export const PUZZLES: Puzzle[] = [
  { id: 't1-rook', tier: 1, theme: 'move_rook', fen: '7k/8/n7/8/8/8/8/R5K1 w - - 0 1', moves: ['a1a6'], goal: 'win' },
  { id: 't1-bishop', tier: 1, theme: 'move_bishop', fen: '6k1/8/7r/8/8/8/8/2B3K1 w - - 0 1', moves: ['c1h6'], goal: 'win' },
  { id: 't1-knight', tier: 1, theme: 'move_knight', fen: '6k1/8/5q2/8/4N3/8/8/6K1 w - - 0 1', moves: ['e4f6'], goal: 'win' },
  { id: 't1-queen', tier: 1, theme: 'move_queen', fen: '7k/3r4/8/8/8/8/8/3QK3 w - - 0 1', moves: ['d1d7'], goal: 'win' },
  { id: 't1-pawn', tier: 1, theme: 'move_pawn', fen: '4k3/8/8/3r4/4P3/8/8/4K3 w - - 0 1', moves: ['e4d5'], goal: 'win' },
  { id: 't1-king', tier: 1, theme: 'move_king', fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', moves: ['e1d2'], goal: 'win' },
  { id: 't1-check', tier: 1, theme: 'escape_check', fen: '4k3/8/8/8/1b6/P7/8/4K3 w - - 0 1', moves: ['a3b4'], goal: 'win' },
  { id: 't1-promo', tier: 1, theme: 'promotion', fen: '8/P1k5/8/8/8/8/8/6K1 w - - 0 1', moves: ['a7a8q'], goal: 'win' },
  { id: 't1-backrank', tier: 1, theme: 'mate_backrank', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', moves: ['a1a8'], goal: 'mate' },
  { id: 't1-mateq', tier: 1, theme: 'mate_queen', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', moves: ['h1b7'], goal: 'mate' },
  { id: 't1-materk', tier: 1, theme: 'mate_rook', fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1', moves: ['a1a8'], goal: 'mate' },
  { id: 't2-scholar', tier: 2, theme: 'mate_scholar', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', moves: ['f3f7'], goal: 'mate' },
  { id: 't2-backq', tier: 2, theme: 'mate_backrank', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', moves: ['d1d8'], goal: 'mate' },
  { id: 't2-hanging', tier: 2, theme: 'hanging', fen: 'rnb1kbnr/pppp1ppp/8/4q3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', moves: ['f3e5'], goal: 'win' },
  { id: 't2-forkn', tier: 2, theme: 'fork_knight', fen: '4k3/8/8/8/2q1N3/8/8/4K3 w - - 0 1', moves: ['e4d6', 'e8d7', 'd6c4'], goal: 'win' },
  { id: 't2-ladder', tier: 2, theme: 'mate_ladder', fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', moves: ['b1b8'], goal: 'mate' },
  { id: 't2-qb', tier: 2, theme: 'mate_queen_bishop', fen: '6k1/5p1p/6pQ/8/8/8/1B6/6K1 w - - 0 1', moves: ['h6g7'], goal: 'mate' },
  { id: 't2-battery', tier: 2, theme: 'mate_battery', fen: '2r3k1/5ppp/8/8/8/8/2Q2PPP/2R3K1 w - - 0 1', moves: ['c2c8'], goal: 'mate' },
  { id: 't2-damiano', tier: 2, theme: 'mate_damiano', fen: '5rk1/6p1/6P1/7Q/8/8/8/6K1 w - - 0 1', moves: ['h5h7'], goal: 'mate' },
  { id: 't2-m1-1', tier: 2, theme: 'mate1', fen: '7k/6pp/8/2p5/8/6Q1/3BPP2/2K5 w - - 0 1', moves: ['g3b8'], goal: 'mate' },
  { id: 't2-m1-2', tier: 2, theme: 'mate1', fen: '6k1/1b2p1pp/8/BQ6/8/2N5/1P1P4/5K2 w - - 0 1', moves: ['b5e8'], goal: 'mate' },
  { id: 't2-m1-3', tier: 2, theme: 'mate1', fen: '5k2/4ppp1/B3r3/4Q3/B7/8/4PP2/2K5 w - - 0 1', moves: ['e5b8'], goal: 'mate' },
  { id: 't2-m1-4', tier: 2, theme: 'mate1', fen: '7k/6pp/8/1n2rQ2/8/6R1/2PR4/5K2 w - - 0 1', moves: ['f5f8'], goal: 'mate' },
  { id: 't2-m1-5', tier: 2, theme: 'mate1', fen: 'k7/pp4q1/8/B3R2R/8/8/1PP5/1K6 w - - 0 1', moves: ['e5e8'], goal: 'mate' },
  { id: 't2-m1-6', tier: 2, theme: 'mate1', fen: '1k6/p7/Bq2p3/8/8/2R5/4PP2/2K5 w - - 0 1', moves: ['c3c8'], goal: 'mate' },
  { id: 't2-m1-7', tier: 2, theme: 'mate1', fen: 'b4k2/4ppp1/8/1p5B/8/2BR4/P4P2/1K6 w - - 0 1', moves: ['d3d8'], goal: 'mate' },
  { id: 't3-pin', tier: 3, theme: 'pin', fen: '4k3/8/5p2/4n3/8/3P4/8/4RK2 w - - 0 1', moves: ['d3d4', 'e8d7', 'd4e5'], goal: 'win' },
  { id: 't3-skewer', tier: 3, theme: 'skewer', fen: '8/8/8/q3k3/8/8/8/6KR w - - 0 1', moves: ['h1h5', 'e5f4', 'h5a5'], goal: 'win' },
  { id: 't3-disc', tier: 3, theme: 'discovered', fen: '5q1k/8/8/8/3N4/8/1B6/6K1 w - - 0 1', moves: ['d4e6', 'h8g8', 'e6f8'], goal: 'win' },
  { id: 't3-smother', tier: 3, theme: 'mate_smothered', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', moves: ['g5f7'], goal: 'mate' },
  { id: 't3-arab', tier: 3, theme: 'mate_arabian', fen: '7k/8/5N2/8/8/8/8/6KR w - - 0 1', moves: ['h1h7'], goal: 'mate' },
  { id: 't3-m1-1', tier: 3, theme: 'mate1', fen: '6k1/5ppp/5r1R/3N4/8/8/2PP3Q/6K1 w - - 0 1', moves: ['h2b8'], goal: 'mate' },
  { id: 't3-m1-2', tier: 3, theme: 'mate1', fen: '1k5n/ppp2p2/8/7q/8/3Q3B/6PP/5K2 w - - 0 1', moves: ['d3d8'], goal: 'mate' },
  { id: 't3-m1-3', tier: 3, theme: 'mate1', fen: '6k1/5ppp/6N1/8/8/8/2P1R2P/6K1 w - - 0 1', moves: ['e2e8'], goal: 'mate' },
  { id: 't3-m1-4', tier: 3, theme: 'mate1', fen: '1k1q4/ppp5/8/3p4/7Q/1B6/P3P3/5K2 w - - 0 1', moves: ['h4d8'], goal: 'mate' },
  { id: 't3-m1-5', tier: 3, theme: 'mate1', fen: '1n3k2/5pp1/8/8/7Q/7R/1P3P2/6K1 w - - 0 1', moves: ['h4d8'], goal: 'mate' },
  { id: 't3-m1-6', tier: 3, theme: 'mate1', fen: '5k2/5pp1/3p1B2/4bN2/8/7Q/4P2P/6K1 w - - 0 1', moves: ['h3h8'], goal: 'mate' },
  { id: 't3-m1-7', tier: 3, theme: 'mate1', fen: '1k2r3/pp6/2Q5/8/8/2R5/P2R1P2/2K5 w - - 0 1', moves: ['c6e8'], goal: 'mate' },
  { id: 't3-m1-8', tier: 3, theme: 'mate1', fen: '5k2/4ppp1/8/2pR4/8/8/4PBQP/5K2 w - - 0 1', moves: ['d5d8'], goal: 'mate' },
  { id: 't3-m1-9', tier: 3, theme: 'mate1', fen: '5k2/2p1ppp1/6r1/1R6/8/6B1/1P4RP/2K5 w - - 0 1', moves: ['b5b8'], goal: 'mate' },
  { id: 't3-m1-10', tier: 3, theme: 'mate1', fen: '1k6/ppp5/4Q2r/5r2/8/7B/PN2P3/1K6 w - - 0 1', moves: ['e6e8'], goal: 'mate' },
  { id: 't4-morphy', tier: 4, theme: 'mate2_sacrifice', fen: 'r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 1 1', moves: ['d5d8', 'e7d8', 'e1e8'], goal: 'mate' },
  { id: 't4-philidor', tier: 4, theme: 'mate2_smothered', fen: '5r1k/6pp/7N/8/2Q5/8/8/6K1 w - - 0 1', moves: ['c4g8', 'f8g8', 'h6f7'], goal: 'mate' },
  { id: 't4-legal', tier: 4, theme: 'mate2_legal', fen: 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1', moves: ['d5f6', 'g7f6', 'c4f7'], goal: 'mate' },
  { id: 't4-m2-1', tier: 4, theme: 'mate2_check', fen: '1k6/1pp2p2/2B5/5r2/1R6/R7/4P1P1/1K6 w - - 0 1', moves: ['b4b7', 'b8c8', 'a3a8'], goal: 'mate' },
  { id: 't4-m2-2', tier: 4, theme: 'mate2_check', fen: '1k6/ppp5/2B2n2/7R/8/B7/P4P2/5K2 w - - 0 1', moves: ['h5h8', 'f6e8', 'h8e8'], goal: 'mate' },
  { id: 't4-m2-3', tier: 4, theme: 'mate2_check', fen: 'r6k/b6p/8/8/4R2Q/8/3P3P/1K6 w - - 0 1', moves: ['h4f6', 'h8g8', 'e4g4'], goal: 'mate' },
  { id: 't4-m2-4', tier: 4, theme: 'mate2_check', fen: '7k/4q1pp/8/1Q6/1B6/8/1P5P/5K2 w - - 0 1', moves: ['b5b8', 'e7d8', 'b8d8'], goal: 'mate' },
  { id: 't4-m2-5', tier: 4, theme: 'mate2_check', fen: 'k7/pp6/1p1n4/8/6QB/8/3P3B/1K6 w - - 0 1', moves: ['g4g8', 'd6e8', 'g8e8'], goal: 'mate' },
  { id: 't4-m2-6', tier: 4, theme: 'mate2_check', fen: '8/4nq1k/4R2p/5RpQ/8/8/5P1P/5K2 w - - 0 1', moves: ['h5f7', 'h7h8', 'e6h6'], goal: 'mate' },
  { id: 't4-m2-7', tier: 4, theme: 'mate2_check', fen: '7k/6pp/r4n2/8/3Q4/8/BPP5/1K6 w - - 0 1', moves: ['d4d8', 'f6e8', 'd8e8'], goal: 'mate' },
  { id: 't4-m2-8', tier: 4, theme: 'mate2_check', fen: '7k/1r4pp/8/1B3r2/4R2B/8/2P2P2/6K1 w - - 0 1', moves: ['e4e8', 'f5f8', 'e8f8'], goal: 'mate' },
  { id: 't4-m2-9', tier: 4, theme: 'mate2_check', fen: '1k6/p1p5/3Q3p/4b3/7B/4R3/P6P/2K5 w - - 0 1', moves: ['e3b3', 'b8c8', 'd6d8'], goal: 'mate' },
  { id: 't4-m2-10', tier: 4, theme: 'mate2_check', fen: '6k1/6pp/5R2/b7/7Q/8/2NP2P1/1K6 w - - 0 1', moves: ['h4c4', 'g8h8', 'f6f8'], goal: 'mate' },
  { id: 't4-m2-11', tier: 4, theme: 'mate2_check', fen: 'k7/pp3q2/7R/7B/8/8/2P4P/6K1 w - - 0 1', moves: ['h6h8', 'f7e8', 'h8e8'], goal: 'mate' },
  { id: 't4-m2-12', tier: 4, theme: 'mate2_check', fen: '1k6/ppp5/3rR3/8/R7/8/5P2/5K2 w - - 0 1', moves: ['e6e8', 'd6d8', 'e8d8'], goal: 'mate' },
  { id: 't4-m2-13', tier: 4, theme: 'mate2_check', fen: '6k1/4rp1p/7B/5p2/2R5/8/1PP5/5K2 w - - 0 1', moves: ['c4c8', 'e7e8', 'c8e8'], goal: 'mate' },
  { id: 't4-m2-14', tier: 4, theme: 'mate2_check', fen: 'k7/pp6/3r2p1/8/7Q/8/BP3P2/2K5 w - - 0 1', moves: ['h4h8', 'd6d8', 'h8d8'], goal: 'mate' },
  { id: 't5-m2-1', tier: 5, theme: 'mate2_sac', fen: 'kr6/pp3p2/8/8/N1R5/8/1P5P/6K1 w - - 0 1', moves: ['a4b6', 'a7b6', 'c4a4'], goal: 'mate' },
  { id: 't5-m2-2', tier: 5, theme: 'mate2_quiet', fen: '6k1/5p1p/1N5Q/8/8/8/P1P5/6K1 w - - 0 1', moves: ['b6d7', 'f7f5', 'h6f8'], goal: 'mate' },
  { id: 't5-m2-3', tier: 5, theme: 'mate2_quiet', fen: '5k2/4p1p1/1Q6/2p2B1p/6N1/8/2P2P2/1K6 w - - 0 1', moves: ['f5g6', 'h5g4', 'b6b8'], goal: 'mate' },
  { id: 't5-m2-4', tier: 5, theme: 'mate2_quiet', fen: 'k7/p7/2R3B1/8/8/4R3/6PP/6K1 w - - 0 1', moves: ['e3b3', 'a7a5', 'c6a6'], goal: 'mate' },
  { id: 't5-m2-5', tier: 5, theme: 'mate2_quiet', fen: '1k6/1p6/4Q3/7p/8/4N3/2P1P1B1/1K6 w - - 0 1', moves: ['e6d7', 'b7b6', 'd7b7'], goal: 'mate' },
  { id: 't5-m2-6', tier: 5, theme: 'mate2_quiet', fen: '7k/7p/1r6/8/6QN/1R6/3PP3/2K5 w - - 0 1', moves: ['b3b6', 'h7h5', 'b6h6'], goal: 'mate' },
  { id: 't5-m2-7', tier: 5, theme: 'mate2_quiet', fen: '8/7k/2p2Bp1/8/R7/8/1PBP4/6K1 w - - 0 1', moves: ['a4a8', 'c6c5', 'a8h8'], goal: 'mate' },
  { id: 't5-m2-8', tier: 5, theme: 'mate2_quiet', fen: '8/k7/p7/b6R/8/1R6/7P/2K5 w - - 0 1', moves: ['h5a5', 'a7a8', 'a5a6'], goal: 'mate' },
  { id: 't5-m2c-1', tier: 5, theme: 'mate2_check', fen: '8/7k/5Qp1/8/4B3/8/P2P4/6K1 w - - 0 1', moves: ['f6g6', 'h7h8', 'g6h7'], goal: 'mate' },
  { id: 't5-m2c-2', tier: 5, theme: 'mate2_check', fen: '5k2/2r1ppp1/4B1R1/p6b/4Q3/8/4P2P/6K1 w - - 0 1', moves: ['e4a8', 'c7c8', 'a8c8'], goal: 'mate' },
  { id: 't5-m2c-3', tier: 5, theme: 'mate2_check', fen: '1k6/ppp5/2r2R2/6q1/8/5Q2/2P3P1/5K2 w - - 0 1', moves: ['f6f8', 'g5d8', 'f8d8'], goal: 'mate' },
  { id: 't5-m2c-4', tier: 5, theme: 'mate2_check', fen: 'k7/pp1r4/8/1Bp2R2/8/8/B3P1P1/1K6 w - - 0 1', moves: ['f5f8', 'd7d8', 'f8d8'], goal: 'mate' },
  { id: 't5-m2c-5', tier: 5, theme: 'mate2_check', fen: 'k7/pp5p/4N1r1/1q6/8/8/P1P1RR2/2K5 w - - 0 1', moves: ['f2f8', 'b5e8', 'f8e8'], goal: 'mate' },
  { id: 't5-m2c-6', tier: 5, theme: 'mate2_check', fen: 'k7/pp6/2rR4/4r3/8/3B4/6PP/5K2 w - - 0 1', moves: ['d6d8', 'c6c8', 'd8c8'], goal: 'mate' },
  { id: 't5-m2c-7', tier: 5, theme: 'mate2_check', fen: 'k7/p3p3/1R4bR/1p3r2/8/4Q3/3P3P/6K1 w - - 0 1', moves: ['e3e4', 'f5d5', 'e4d5'], goal: 'mate' },
  { id: 't5-m2c-8', tier: 5, theme: 'mate2_check', fen: '6k1/1p3pp1/6Qp/6q1/R7/8/1P2P3/1K6 w - - 0 1', moves: ['a4a8', 'g5d8', 'a8d8'], goal: 'mate' },
];

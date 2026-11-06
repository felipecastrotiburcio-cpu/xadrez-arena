// Executar com: npx tsx --test src/ai/__tests__/engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { Position } from '../engine';
import { findBestMove } from '../index';

const PERFT: [string, number, number][] = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];

test('perft confere com valores de referência', () => {
  for (const [fen, depth, expected] of PERFT) {
    const pos = new Position(fen);
    const hash = pos.hash;
    assert.equal(pos.perft(depth), expected, fen);
    assert.equal(pos.hash, hash, 'hash restaurado após unmake');
    assert.equal(pos.computeHash(), hash, 'hash incremental consistente');
  }
});

test('encontra mate em 1', () => {
  // Mate do corredor: Td8#
  const r = findBestMove('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { level: 4 });
  assert.deepEqual(r.move, { from: 'd1', to: 'd8' });
});

test('captura a dama pendurada', () => {
  const r = findBestMove('rnb1kbnr/pppp1ppp/8/4p1q1/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 3', { level: 3, random: () => 0.5 });
  assert.deepEqual(r.move, { from: 'c1', to: 'g5' });
});

test('todos os níveis devolvem lances legais em partida inteira', () => {
  for (const level of [1, 2, 3, 4]) {
    const game = new Chess();
    const fens: string[] = [];
    let plies = 0;
    while (!game.isGameOver() && plies < 40) {
      const r = findBestMove(game.fen(), { level, history: fens });
      assert.ok(r.move, 'deve haver lance');
      fens.push(game.fen());
      game.move(r.move!); // lança exceção se ilegal
      plies++;
    }
  }
});

test('en passant: o motor gera a captura e a IA a escolhe quando ganha material', () => {
  // Brancas: peão em e5; pretas acabaram de jogar d7-d5.
  const fen = 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
  const chess = new Chess(fen);
  assert.ok(chess.moves({ verbose: true }).some((m) => m.isEnPassant() && m.to === 'd6'));
  assert.equal(new Position(fen).legalMoves().length, chess.moves().length);
  // A única captura possível é o en passant, que ganha um peão.
  const r = findBestMove('7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', { level: 5 });
  assert.deepEqual(r.move, { from: 'e5', to: 'd6' });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { PUZZLES } from '../puzzles';

/**
 * Confere o banco de desafios: posições válidas, lances legais, mate forçado de verdade
 * (todas as defesas levam ao mate) e ganho real de material nos desafios táticos.
 */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (c: Chess) => {
  let s = 0;
  for (const row of c.board()) for (const sq of row) if (sq) s += (sq.color === 'w' ? 1 : -1) * VALUE[sq.type];
  return s;
};
const play = (c: Chess, uci: string) => c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as 'q') ?? undefined });
const hasMateIn1 = (c: Chess) =>
  c.moves({ verbose: true }).some((m) => {
    c.move(m);
    const ok = c.isCheckmate();
    c.undo();
    return ok;
  });

test('ids únicos e todos os níveis com desafios suficientes', () => {
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length);
  for (const tier of [1, 2, 3, 4, 5]) assert.ok(PUZZLES.filter((p) => p.tier === tier).length >= 10, `nível ${tier}`);
});

for (const p of PUZZLES) {
  test(`desafio ${p.id}`, () => {
    const c = new Chess(p.fen);
    assert.equal(c.turn(), 'w', 'brancas jogam');
    assert.ok(!c.isGameOver(), 'posição em andamento');
    const before = material(c);
    p.moves.forEach((m, i) => {
      assert.ok(play(c, m), `lance ${i + 1} (${m}) legal`);
      // mate em 2: depois do 1º lance, TODA defesa do adversário deixa um mate em 1
      if (p.goal === 'mate' && i === 0 && p.moves.length === 3) {
        for (const r of c.moves({ verbose: true })) {
          c.move(r);
          assert.ok(hasMateIn1(c), `defesa ${r.san} ainda leva mate`);
          c.undo();
        }
      }
    });
    if (p.goal === 'mate') assert.ok(c.isCheckmate(), 'termina em xeque-mate');
    else assert.ok(material(c) - before >= 2, 'ganha material');
    assert.equal(p.moves.length % 2, 1, 'a solução termina com um lance do jogador');
  });
}

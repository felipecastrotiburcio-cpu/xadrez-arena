// Benchmark do motor: nós por segundo em posições de meio-jogo.
import { Position, Searcher } from '../engine';
const FENS = [
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 3 9',
];
let nodes = 0;
const t0 = Date.now();
for (const fen of FENS) {
  const s = new Searcher(new Position(fen));
  const r = s.think({ depth: 5, timeMs: 60_000 });
  nodes += r.nodes;
}
const ms = Date.now() - t0;
console.log(`nós=${nodes} tempo=${ms}ms nps=${Math.round((nodes / ms) * 1000)}`);

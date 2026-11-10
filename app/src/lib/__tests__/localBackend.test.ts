// Executar com: npm run test:local
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { configureLocalBackend, localApi, localEvents } from '../localBackend';

const mem = new Map<string, string>();
const deps = {
  storage: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
  },
  randomBytes: (n: number) => new Uint8Array(crypto.randomBytes(n)),
};
configureLocalBackend(deps);

const call = <T = any>(path: string, body?: unknown, token: string | null = null, method?: string) =>
  localApi<T>(path, method ?? (body !== undefined ? 'POST' : 'GET'), body, token);

test('cadastro guarda a senha protegida e valida os dados', async () => {
  await assert.rejects(call('/auth/register', { username: 'a', password: '12345678' }), /3 a 20/);
  await assert.rejects(call('/auth/register', { username: 'ana', password: 'curta' }), /8 a 128/);
  const r = await call('/auth/register', { username: 'ana', password: 'segredo123' });
  assert.match(r.token, /^local_[0-9a-f]{48}$/);
  assert.equal(r.user.coins, 300);
  assert.equal(r.user.equipped.move, 'move_jamal');
  await assert.rejects(call('/auth/register', { username: 'ANA', password: 'segredo123' }), /já existe/);
  const stored = JSON.parse([...mem.values()][0]);
  assert.ok(!JSON.stringify(stored).includes('segredo123'), 'senha nunca é gravada em texto');
  assert.match(stored.users[0].passwordHash, /^[0-9a-f]{64}$/);
});

test('login: senha correta entra, errada é recusada', async () => {
  await assert.rejects(call('/auth/login', { username: 'ana', password: 'errada123' }), /incorretos/);
  const r = await call('/auth/login', { username: 'Ana', password: 'segredo123' });
  const me = await call('/me', undefined, r.token);
  assert.equal(me.user.username, 'ana');
  await assert.rejects(call('/me', undefined, 'local_invalido'), /Sessão expirada/);
});

test('loja: saldo, compra, equipar e bônus diário', async () => {
  const { token } = await call('/auth/register', { username: 'bia', password: 'segredo123' });
  await assert.rejects(call('/shop/buy', { itemId: 'board_lava' }, token), /Faltam 1300 moedas/);
  // Lendários são compra real (Google Play / App Store), não saem por moedas.
  await assert.rejects(call('/shop/buy', { itemId: 'board_galaxy' }, token), /compra no app/);
  const buy = await call('/shop/buy', { itemId: 'board_tournament' }, token);
  assert.equal(buy.user.coins, 150);
  assert.equal(buy.user.equipped.board, 'board_tournament');
  await assert.rejects(call('/shop/buy', { itemId: 'board_tournament' }, token), /já possui/);
  await assert.rejects(call('/shop/equip', { itemId: 'move_flip' }, token), /Compre o item/);
  const eq = await call('/shop/equip', { itemId: 'move_67' }, token);
  assert.equal(eq.user.equipped.move, 'move_67');
  const daily = await call('/rewards/daily', {}, token);
  assert.equal(daily.user.coins, 200);
  await assert.rejects(call('/rewards/daily', {}, token), /já resgatou/);
  const catalog = await call('/shop/catalog');
  assert.ok(catalog.items.length >= 50);
});

test('vencer a IA dá moedas, rating, histórico e notificação', async () => {
  const { token, user } = await call('/auth/register', { username: 'caio', password: 'segredo123' });
  const events: string[] = [];
  const off = localEvents.onNotification((e) => events.push(e.notification.type));
  const r = await call('/ai/result', { level: 3, score: 1, reason: 'xeque-mate', color: 'white' }, token);
  off();
  assert.equal(r.coins, 25, 'nível 3: 10 + 3×5');
  assert.equal(r.user.coins, 325);
  assert.ok(r.ratingChange > 0);
  assert.equal(r.user.wins, 1);
  assert.deepEqual(events, ['game_result']);
  const profile = await call(`/users/${user.id}`, undefined, token);
  assert.equal(profile.games[0].opponentName, 'Bispo Estrategista (IA)');
  assert.equal(profile.games[0].outcome, 'win');
  const notes = await call('/notifications', undefined, token);
  assert.equal(notes.unread, 2); // boas-vindas + resultado
  await call('/notifications/read', {}, token);
  assert.equal((await call('/notifications', undefined, token)).unread, 0);
  const board = await call('/leaderboard', undefined, token);
  assert.equal(board.players[0].username, 'caio');
});

test('recursos online avisam que precisam do servidor', async () => {
  const { token } = await call('/auth/register', { username: 'davi', password: 'segredo123' });
  await assert.rejects(call('/friends', undefined, token), /servidor online/);
});

test('sair de todos os aparelhos invalida as sessões', async () => {
  const a = await call('/auth/login', { username: 'ana', password: 'segredo123' });
  const b = await call('/auth/login', { username: 'ana', password: 'segredo123' });
  await call('/auth/logout-all', {}, a.token);
  await assert.rejects(call('/me', undefined, b.token), /Sessão expirada/);
});

test('dados continuam após reiniciar o app', async () => {
  configureLocalBackend(deps); // descarta o cache em memória, como num app reiniciado
  const r = await call('/auth/login', { username: 'bia', password: 'segredo123' });
  assert.equal(r.user.coins, 200);
  assert.ok(r.user.inventory.includes('board_tournament'));
});

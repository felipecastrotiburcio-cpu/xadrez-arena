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

test('troca de nome: vira o novo login e não repete nome de outra conta', async () => {
  const { token } = await call('/auth/register', { username: 'nome1', password: 'segredo123' });
  await call('/auth/register', { username: 'nome2', password: 'segredo123' });
  await assert.rejects(call('/me/username', { username: 'x' }, token), /3 a 20/);
  await assert.rejects(call('/me/username', { username: 'NOME2' }, token), /em uso/);
  const r = await call('/me/username', { username: 'Nome_Novo' }, token);
  assert.equal(r.user.username, 'Nome_Novo');
  await assert.rejects(call('/auth/login', { username: 'nome1', password: 'segredo123' }), /incorretos/);
  assert.ok((await call('/auth/login', { username: 'nome_novo', password: 'segredo123' })).token);
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
  // 1ª vitória contra esta IA: avisa do emblema novo e do resultado.
  assert.deepEqual(events, ['reward', 'game_result']);
  assert.equal(r.newBadge, 'ai_3');
  const profile = await call(`/users/${user.id}`, undefined, token);
  assert.equal(profile.games[0].opponentName, 'Bispo Estrategista (IA)');
  assert.equal(profile.games[0].outcome, 'win');
  const notes = await call('/notifications', undefined, token);
  assert.equal(notes.unread, 3); // boas-vindas + emblema + resultado
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

test('modo desenvolvedor: senha errada recusada; com a senha certa a loja sai de graça', async () => {
  const { token } = await call('/auth/register', { username: 'devlocal', password: 'segredo123' });
  assert.equal((await call('/me', undefined, token)).user.devMode, false);
  await assert.rejects(call('/dev/unlock', { password: 'errada123' }, token), /incorreta/);
  // A senha certa não fica no repositório (ele é público): só é testada quando vem de fora.
  const pw = process.env.DEV_MODE_PASSWORD;
  if (!pw) return;
  const on = await call('/dev/unlock', { password: pw }, token);
  assert.equal(on.user.devMode, true);
  const r = await call('/shop/buy', { itemId: 'board_galaxy' }, token);
  assert.equal(r.user.coins, on.user.coins);
  const r2 = await call('/shop/buy', { itemId: 'board_lava' }, token);
  assert.equal(r2.user.coins, on.user.coins, 'item caro de moedas também é grátis');
  assert.equal((await call('/dev/lock', {}, token)).user.devMode, false);
  await assert.rejects(call('/shop/buy', { itemId: 'board_royal' }, token), /compra no app/);
});

test('emblemas: 1ª vitória contra a IA dá emblema e recompensa exclusiva (uma vez só)', async () => {
  const { token } = await call('/auth/register', { username: 'emblema', password: 'segredo123' });
  // Recompensas não são vendidas na loja.
  await assert.rejects(call('/shop/buy', { itemId: 'pieces_royal' }, token), /recompensa/);
  await assert.rejects(call('/badges/select', { badge: 'ai_5' }, token), /não conquistou/);

  const loss = await call('/ai/result', { level: 5, score: 0 }, token);
  assert.equal(loss.newBadge, null);
  const win = await call('/ai/result', { level: 5, score: 1 }, token);
  assert.equal(win.newBadge, 'ai_5');
  assert.equal(win.rewardItem, 'pieces_royal');
  assert.deepEqual(win.user.badges, ['ai_5']);
  assert.equal(win.user.badge, 'ai_5', 'o 1º emblema já aparece no perfil');
  assert.ok(win.user.inventory.includes('pieces_royal'));

  const again = await call('/ai/result', { level: 5, score: 1 }, token);
  assert.equal(again.newBadge, null, 'o emblema não repete');
  assert.equal(again.user.inventory.filter((i: string) => i === 'pieces_royal').length, 1);

  const w1 = await call('/ai/result', { level: 1, score: 1 }, token);
  assert.equal(w1.rewardItem, 'avatar_pawn_medal');
  assert.equal(w1.user.badge, 'ai_5', 'continua mostrando o emblema escolhido');
  const sel = await call('/badges/select', { badge: 'ai_1' }, token);
  assert.equal(sel.user.badge, 'ai_1');
  const none = await call('/badges/select', { badge: null }, token);
  assert.equal(none.user.badge, null);
  // A recompensa pode ser equipada como qualquer item.
  const eq = await call('/shop/equip', { itemId: 'pieces_royal' }, token);
  assert.equal(eq.user.equipped.pieces, 'pieces_royal');
});

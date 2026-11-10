import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

let ctx: ReturnType<typeof createApp>;
let base = '';

before(async () => {
  ctx = createApp({ dbFile: null });
  await new Promise<void>((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${(ctx.server.address() as AddressInfo).port}`;
});

after(async () => {
  await ctx.close();
  ctx.server.close();
});

async function api(path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: opts.body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as any };
}

const register = async (username: string) =>
  (await api('/auth/register', { body: { username, password: 'senhaforte123' } })).data;

test('novo jogador começa com moedas e itens padrão equipados', async () => {
  const { user } = await register('gui');
  assert.equal(user.coins, 300);
  assert.deepEqual(user.equipped, {
    board: 'board_classic', pieces: 'pieces_classic', avatar: 'avatar_letter', character: 'char_rookie', move: 'move_jamal',
  });
  assert.ok(user.inventory.includes('move_67'), 'movimento do 67 é padrão');
});

test('catálogo ordenado por preço e compra sem saldo recusada', async () => {
  const { token } = await register('hugo');
  const catalog = (await api('/shop/catalog')).data.items;
  assert.ok(catalog.length > 30);
  // Preço cresce com a raridade.
  const boards = catalog.filter((i: any) => i.type === 'board');
  assert.ok(boards.at(-1).price > boards[1].price);

  const caro = await api('/shop/buy', { token, body: { itemId: 'board_lava' } });
  assert.equal(caro.status, 402);
  // Lendários são compra real (Google Play / App Store), não saem por moedas.
  assert.equal((await api('/shop/buy', { token, body: { itemId: 'board_galaxy' } })).status, 400);
  assert.match(caro.data.error, /Faltam 1300 moedas/);
  assert.equal((await api('/shop/buy', { token, body: { itemId: 'nao_existe' } })).status, 404);
});

test('compra bem-sucedida desconta, equipa e não repete', async () => {
  const { token } = await register('iris');
  const r = await api('/shop/buy', { token, body: { itemId: 'board_tournament' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.coins, 150);
  assert.equal(r.data.user.equipped.board, 'board_tournament');
  assert.equal((await api('/shop/buy', { token, body: { itemId: 'board_tournament' } })).status, 409);
  const eq = await api('/shop/equip', { token, body: { itemId: 'move_67' } });
  assert.equal(eq.data.user.equipped.move, 'move_67');
  assert.equal((await api('/shop/equip', { token, body: { itemId: 'move_lightning' } })).status, 403);
});

test('bônus diário só uma vez por dia', async () => {
  const { token } = await register('joao');
  const r = await api('/rewards/daily', { token, body: {} });
  assert.equal(r.data.user.coins, 350);
  assert.equal(r.data.user.dailyBonusAvailable, false);
  assert.equal((await api('/rewards/daily', { token, body: {} })).status, 409);
});

test('JWT: rejeita token adulterado, alg none, emissor errado e token revogado', async () => {
  const { token, user } = await register('kaio');
  assert.equal((await api('/me', { token })).status, 200);

  const [h, p] = token.split('.');
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'outro' })).toString('base64url')}.${token.split('.')[2]}`;
  assert.equal((await api('/me', { token: forged })).status, 401);

  const none = jwt.sign({ ver: 0 }, '', { algorithm: 'none', subject: user.id, issuer: 'xadrez-arena', audience: 'xadrez-arena-app' });
  assert.equal((await api('/me', { token: none })).status, 401);

  const wrongIss = jwt.sign({ ver: 0 }, ctx.config.jwt.secret, { subject: user.id, issuer: 'outro', audience: 'xadrez-arena-app' });
  assert.equal((await api('/me', { token: wrongIss })).status, 401);

  assert.equal((await api('/auth/logout-all', { token, body: {} })).status, 200);
  assert.equal((await api('/me', { token })).status, 401, 'token antigo foi revogado');
});

test('cabeçalhos de segurança presentes', async () => {
  const res = await fetch(`${base}/api/shop/catalog`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('config de produção exige segredo forte e HTTPS', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '1' }), /JWT_SECRET é obrigatório/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '1', JWT_SECRET: 'curto' }), /muito curto/);
  const strong = 'k'.repeat(20) + 'Zq8!vR2#pL9@wX4$mN7^';
  assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: strong }), /HTTPS obrigatório/);
  const cfg = loadConfig({ NODE_ENV: 'production', JWT_SECRET: strong, TRUST_PROXY: '1', CORS_ORIGINS: 'https://xadrez.app' });
  assert.equal(cfg.forceHttps, true);
  assert.deepEqual(cfg.corsOrigins, ['https://xadrez.app']);
});

test('bônus de sequência de vitórias', async () => {
  const { streakBonus } = await import('./catalog.js');
  assert.deepEqual([1, 2, 3, 4, 5, 10].map(streakBonus), [0, 0, 10, 20, 30, 50]);
});

test('catálogo do app é igual ao do servidor', async () => {
  const server = await import('./catalog.js');
  const app = await import('../../app/src/lib/catalog.ts');
  assert.deepEqual(app.CATALOG, server.CATALOG);
  assert.deepEqual(app.DEFAULT_EQUIPPED, server.DEFAULT_EQUIPPED);
  assert.equal(app.STARTING_COINS, server.STARTING_COINS);
});

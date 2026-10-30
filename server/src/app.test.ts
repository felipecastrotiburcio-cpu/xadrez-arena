import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { createApp } from './app.js';

let ctx: ReturnType<typeof createApp>;
let base = '';
const sockets: Socket[] = [];

before(async () => {
  ctx = createApp({ dbFile: null, matchmakingTickMs: 50 });
  await new Promise<void>((r) => ctx.server.listen(0, r));
  base = `http://127.0.0.1:${(ctx.server.address() as AddressInfo).port}`;
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  await ctx.close();
  ctx.server.close();
});

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function player(username: string) {
  const { data } = await api('/auth/register', { body: { username, password: 'segredo123' } });
  const socket = connect(base, { auth: { token: data.token }, transports: ['websocket'] });
  sockets.push(socket);
  await new Promise<void>((r) => socket.once('session', () => r()));
  return { token: data.token as string, user: data.user, socket };
}

const once = <T = any>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r));
const emit = <T = any>(s: Socket, ev: string, payload?: unknown) =>
  new Promise<T>((r) => s.emit(ev, payload ?? {}, r));

test('cadastro e login validam credenciais', async () => {
  const bad = await api('/auth/register', { body: { username: 'a', password: '1' } });
  assert.equal(bad.status, 400);
  await api('/auth/register', { body: { username: 'carlos', password: 'segredo123' } });
  const dup = await api('/auth/register', { body: { username: 'Carlos', password: 'segredo123' } });
  assert.equal(dup.status, 409);
  const wrong = await api('/auth/login', { body: { username: 'carlos', password: 'errada' } });
  assert.equal(wrong.status, 401);
  const ok = await api('/auth/login', { body: { username: 'carlos', password: 'segredo123' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.rating, 1000);
  assert.equal(ok.data.user.levelName, 'Amador');
});

test('amizade, convite, partida com mate e atualização de rating', async () => {
  const ana = await player('ana');
  const bruno = await player('bruno');

  // Sem amizade não pode convidar.
  const denied = await emit(ana.socket, 'invite:send', { toUserId: bruno.user.id, timeControl: '5+0' });
  assert.match(denied.error, /amigos/);

  const req = await api('/friends/requests', { token: ana.token, body: { username: 'bruno' } });
  assert.equal(req.data.status, 'outgoing');
  const pending = await api('/friends', { token: bruno.token });
  assert.equal(pending.data.incoming.length, 1);
  await api(`/friends/requests/${req.data.id}/accept`, { token: bruno.token, method: 'POST' });
  const friends = await api('/friends', { token: ana.token });
  assert.equal(friends.data.friends[0].user.username, 'bruno');
  assert.equal(friends.data.friends[0].online, true);

  const received = once(bruno.socket, 'invite:received');
  const sent = await emit(ana.socket, 'invite:send', {
    toUserId: bruno.user.id,
    timeControl: '5+0',
    rated: true,
    color: 'black',
  });
  assert.ok(sent.ok, JSON.stringify(sent));
  const invite = await received;
  assert.equal(invite.from.username, 'ana');

  const started = once(ana.socket, 'game:start');
  const accepted = await emit(bruno.socket, 'invite:accept', { inviteId: invite.id });
  assert.ok(accepted.ok);
  const game = await started;
  assert.equal(game.black.username, 'ana');
  assert.equal(game.white.username, 'bruno');

  // Lance fora da vez é rejeitado.
  const wrongTurn = await emit(ana.socket, 'game:move', { gameId: game.id, from: 'e7', to: 'e5' });
  assert.match(wrongTurn.error, /vez/);

  // Mate do louco: bruno (brancas) leva mate.
  const over = once(ana.socket, 'game:over');
  for (const [s, from, to] of [
    [bruno, 'f2', 'f3'],
    [ana, 'e7', 'e5'],
    [bruno, 'g2', 'g4'],
    [ana, 'd8', 'h4'],
  ] as const) {
    const r = await emit(s.socket, 'game:move', { gameId: game.id, from, to });
    assert.ok(r.ok, JSON.stringify(r));
  }
  const result = await over;
  assert.equal(result.result, '0-1');
  assert.equal(result.reason, 'xeque-mate');
  assert.equal(result.ratingChanges.black, 20);
  assert.equal(result.ratingChanges.white, -20);
  // Vencedor ganha 30 moedas (ranqueada), perdedor 5.
  assert.deepEqual(result.coinRewards, { black: 30, white: 5 });
  assert.equal(result.black.cosmetics.move, 'move_jamal');
  assert.deepEqual(result.streaks, { black: 1, white: 0 });

  const profile = await api(`/users/${ana.user.id}`, { token: bruno.token });
  assert.equal(profile.data.user.rating, 1020);
  assert.equal(profile.data.user.wins, 1);
  assert.equal(profile.data.games[0].outcome, 'win');
  assert.equal(profile.data.friendship.status, 'friends');

  const me = await api('/me', { token: ana.token });
  assert.equal(me.data.user.coins, 330);
  const notes = await api('/notifications', { token: ana.token });
  const types = notes.data.notifications.map((n: any) => n.type);
  assert.ok(types.includes('welcome') && types.includes('friend_accepted') && types.includes('game_result'), types.join());
  assert.ok(notes.data.unread >= 3);
  await api('/notifications/read', { token: ana.token, body: {} });
  assert.equal((await api('/notifications', { token: ana.token })).data.unread, 0);

  const board = await api('/leaderboard', { token: ana.token });
  assert.equal(board.data.players[0].username, 'ana');
});

test('matchmaking pareia jogadores e desistência encerra a partida', async () => {
  const c = await player('clara');
  const d = await player('diego');
  const startC = once(c.socket, 'game:start');
  const startD = once(d.socket, 'game:start');
  assert.ok((await emit(c.socket, 'queue:join', { timeControl: '3+2' })).ok);
  assert.ok((await emit(d.socket, 'queue:join', { timeControl: '3+2' })).ok);
  const [game] = await Promise.all([startC, startD]);
  assert.equal(game.rated, true);
  assert.equal(game.timeControl.id, '3+2');

  const white = game.white.username === 'clara' ? c : d;
  const black = white === c ? d : c;
  await emit(white.socket, 'game:move', { gameId: game.id, from: 'e2', to: 'e4' });
  await emit(black.socket, 'game:move', { gameId: game.id, from: 'e7', to: 'e5' });

  // Proposta de empate recusada e depois desistência.
  await emit(white.socket, 'game:offerDraw', { gameId: game.id });
  const declined = await emit(black.socket, 'game:respondDraw', { gameId: game.id, accept: false });
  assert.ok(declined.ok);
  const over = once(black.socket, 'game:over');
  await emit(white.socket, 'game:resign', { gameId: game.id });
  const result = await over;
  assert.equal(result.reason, 'desistência');
  assert.equal(result.result, '0-1');
});

test('desistir antes do primeiro lance cancela sem alterar rating', async () => {
  const e = await player('elisa');
  const f = await player('fabio');
  const startE = once(e.socket, 'game:start');
  await emit(e.socket, 'queue:join', { timeControl: '1+0' });
  await emit(f.socket, 'queue:join', { timeControl: '1+0' });
  const game = await startE;
  const over = once(f.socket, 'game:over');
  await emit(e.socket, 'game:resign', { gameId: game.id });
  const result = await over;
  assert.equal(result.result, null);
  assert.equal(result.reason, 'cancelada');
  const me = await api('/me', { token: e.token });
  assert.equal(me.data.user.rating, 1000);
  assert.equal(me.data.user.gamesPlayed, 0);
});

import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import type { Server } from 'socket.io';
import { privateUser, publicUser, type Auth, type AuthedRequest } from './auth.js';
import { STARTING_COINS } from './catalog.js';
import type { Database } from './db.js';
import type { Notifier } from './notifications.js';
import { INITIAL_RATING, LEVELS } from './levels.js';
import type { Presence } from './presence.js';
import { TIME_CONTROLS } from './timeControls.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function createRoutes(db: Database, presence: Presence, io: Server, authService: Auth, notifier: Notifier) {
  const r = Router();
  const auth = authService.requireAuth;
  // Freia tentativas de adivinhar senha: 20 tentativas a cada 15 min por IP.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
  });

  const notifyFriends = (...userIds: string[]) => {
    for (const id of userIds) io.to(`user:${id}`).emit('friends:changed');
  };

  const fail = (res: Response, status: number, error: string) => res.status(status).json({ error });

  r.get('/meta', (_req, res) => {
    res.json({ timeControls: TIME_CONTROLS, levels: LEVELS });
  });

  // ------------------------------------------------------------ autenticação
  r.post('/auth/register', authLimiter, async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return fail(res, 400, 'Nome de usuário deve ter 3 a 20 letras, números ou _.');
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return fail(res, 400, 'A senha precisa ter de 8 a 128 caracteres.');
    }
    if (db.getUserByName(username)) return fail(res, 409, 'Esse nome de usuário já existe.');
    const user = db.createUser({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      rating: INITIAL_RATING,
      peakRating: INITIAL_RATING,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
    notifier.notify(user.id, {
      type: 'welcome',
      title: 'Bem-vindo à Xadrez Arena!',
      body: `Você ganhou ${STARTING_COINS} moedas para gastar na loja. Boa sorte nas partidas!`,
    });
    res.status(201).json({ token: authService.signToken(user), user: privateUser(user) });
  });

  r.post('/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body ?? {};
    const user = typeof username === 'string' ? db.getUserByName(username) : undefined;
    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return fail(res, 401, 'Usuário ou senha incorretos.');
    }
    res.json({ token: authService.signToken(user), user: privateUser(user) });
  });

  // Revoga todos os tokens emitidos (sair de todos os aparelhos).
  r.post('/auth/logout-all', auth, (req: AuthedRequest, res) => {
    const user = db.getUser(req.userId!)!;
    db.updateUser(user.id, { tokenVersion: user.tokenVersion + 1 });
    for (const s of io.sockets.sockets.values()) if (s.data.userId === user.id) s.disconnect(true);
    res.json({ ok: true });
  });

  r.get('/me', auth, (req: AuthedRequest, res) => {
    const user = db.getUser(req.userId!)!;
    res.json({
      user: privateUser(user),
      rank: db.rankOf(user.id),
      activeGameId: presence.gameOf(user.id),
      unreadNotifications: db.unreadCount(user.id),
    });
  });

  // ------------------------------------------------------------ usuários
  r.get('/users/search', auth, (req: AuthedRequest, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const users = db
      .searchUsers(q)
      .filter((u) => u.id !== req.userId)
      .map((u) => ({ ...publicUser(u), friendship: friendshipStatus(req.userId!, u.id) }));
    res.json({ users });
  });

  r.get('/users/:id', auth, (req: AuthedRequest, res) => {
    const user = db.getUser(String(req.params.id));
    if (!user) return fail(res, 404, 'Jogador não encontrado.');
    const games = db.gamesOf(user.id, 20).map((g) => gameSummary(g, user.id));
    res.json({
      user: publicUser(user),
      rank: db.rankOf(user.id),
      ...presence.status(user.id),
      friendship: friendshipStatus(req.userId!, user.id),
      games,
    });
  });

  r.get('/leaderboard', auth, (_req, res) => {
    res.json({
      players: db.leaderboard(100).map((u, i) => ({ rank: i + 1, ...publicUser(u), online: presence.isOnline(u.id) })),
    });
  });

  // ------------------------------------------------------------ amizades
  function friendshipStatus(me: string, other: string) {
    const f = db.friendshipBetween(me, other);
    if (!f) return { status: 'none' as const };
    if (f.status === 'accepted') return { status: 'friends' as const, id: f.id };
    return { status: f.from === me ? ('outgoing' as const) : ('incoming' as const), id: f.id };
  }

  r.get('/friends', auth, (req: AuthedRequest, res) => {
    const me = req.userId!;
    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const f of db.friendshipsOf(me)) {
      const otherId = f.from === me ? f.to : f.from;
      const other = db.getUser(otherId);
      if (!other) continue;
      const entry = { requestId: f.id, user: publicUser(other), ...presence.status(otherId), since: f.createdAt };
      if (f.status === 'accepted') friends.push(entry);
      else if (f.from === me) outgoing.push(entry);
      else incoming.push(entry);
    }
    // Online primeiro, depois por rating.
    friends.sort((a, b) => Number(b.online) - Number(a.online) || b.user.rating - a.user.rating);
    res.json({ friends, incoming, outgoing });
  });

  r.post('/friends/requests', auth, (req: AuthedRequest, res) => {
    const me = req.userId!;
    const { username, userId } = req.body ?? {};
    const target = userId ? db.getUser(String(userId)) : db.getUserByName(String(username ?? ''));
    if (!target) return fail(res, 404, 'Jogador não encontrado.');
    if (target.id === me) return fail(res, 400, 'Você não pode adicionar a si mesmo.');
    const existing = db.friendshipBetween(me, target.id);
    if (existing?.status === 'accepted') return fail(res, 409, 'Vocês já são amigos.');
    if (existing && existing.from === me) return fail(res, 409, 'Pedido já enviado.');
    if (existing) {
      // Ele já tinha me convidado: aceita automaticamente.
      db.acceptFriendship(existing.id);
      notifyFriends(me, target.id);
      notifier.notify(target.id, {
        type: 'friend_accepted',
        title: 'Nova amizade',
        body: `${db.getUser(me)!.username} aceitou seu pedido de amizade.`,
        data: { userId: me },
      });
      return res.json({ status: 'friends', id: existing.id });
    }
    const f = db.createFriendRequest(me, target.id);
    notifyFriends(target.id);
    notifier.notify(target.id, {
      type: 'friend_request',
      title: 'Pedido de amizade',
      body: `${db.getUser(me)!.username} quer ser seu amigo.`,
      data: { userId: me },
    });
    res.status(201).json({ status: 'outgoing', id: f.id });
  });

  r.post('/friends/requests/:id/accept', auth, (req: AuthedRequest, res) => {
    const f = db.getFriendship(String(req.params.id));
    if (!f || f.to !== req.userId || f.status !== 'pending') return fail(res, 404, 'Pedido não encontrado.');
    db.acceptFriendship(f.id);
    notifyFriends(f.from, f.to);
    notifier.notify(f.from, {
      type: 'friend_accepted',
      title: 'Nova amizade',
      body: `${db.getUser(f.to)!.username} aceitou seu pedido de amizade.`,
      data: { userId: f.to },
    });
    res.json({ status: 'friends', id: f.id });
  });

  // Recusar pedido recebido, cancelar pedido enviado ou desfazer amizade.
  r.delete('/friends/requests/:id', auth, (req: AuthedRequest, res) => {
    const f = db.getFriendship(String(req.params.id));
    if (!f || (f.from !== req.userId && f.to !== req.userId)) return fail(res, 404, 'Pedido não encontrado.');
    db.deleteFriendship(f.id);
    notifyFriends(f.from, f.to);
    res.json({ status: 'none' });
  });

  // ------------------------------------------------------------ partidas
  function gameSummary(g: ReturnType<Database['gamesOf']>[number], perspective: string) {
    const isWhite = g.white === perspective;
    const opp = db.getUser(isWhite ? g.black : g.white);
    const outcome =
      g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === isWhite ? 'win' : 'loss';
    return {
      id: g.id,
      color: isWhite ? 'white' : 'black',
      opponent: opp ? publicUser(opp) : null,
      result: g.result,
      outcome,
      reason: g.reason,
      rated: g.rated,
      timeControl: g.timeControl,
      ratingChange: isWhite ? g.whiteRatingChange : g.blackRatingChange,
      endedAt: g.endedAt,
    };
  }

  r.get('/games/:id', auth, (req, res) => {
    const g = db.getGame(String(req.params.id));
    if (!g) return fail(res, 404, 'Partida não encontrada.');
    const w = db.getUser(g.white);
    const b = db.getUser(g.black);
    res.json({ game: { ...g, white: w && publicUser(w), black: b && publicUser(b) } });
  });

  return r;
}

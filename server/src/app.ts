import http from 'node:http';
import https from 'node:https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server, type Socket } from 'socket.io';
import { createAuth } from './auth.js';
import { loadConfig, type Config } from './config.js';
import { Database } from './db.js';
import { GameManager, type MoveInput } from './games.js';
import { InviteManager, type InviteInput } from './invites.js';
import { Matchmaker } from './matchmaking.js';
import { Notifier } from './notifications.js';
import { Presence } from './presence.js';
import { createRoutes } from './routes.js';
import { createShopRoutes } from './shop.js';
import { getTimeControl } from './timeControls.js';

export interface AppOptions {
  /** Caminho do arquivo JSON; null mantém tudo em memória (testes). */
  dbFile: string | null;
  matchmakingTickMs?: number;
  config?: Config;
}

type Ack = (res: unknown) => void;

export function createApp({ dbFile, matchmakingTickMs, config = loadConfig() }: AppOptions) {
  const app = express();
  // Com TLS configurado o próprio Node atende HTTPS (e WSS para o Socket.IO).
  const server = config.tls ? https.createServer(config.tls, app) : http.createServer(app);
  const corsOrigin = config.corsOrigins.includes('*') ? '*' : config.corsOrigins;
  const io = new Server(server, { cors: { origin: corsOrigin }, maxHttpBufferSize: 64 * 1024 });
  const db = new Database(dbFile);
  const auth = createAuth(config.jwt, db);
  const notifier = new Notifier(io, db);
  const presence = new Presence();
  const notifyFriendsPresence = (userId: string) => {
    const status = { userId, ...presence.status(userId) };
    for (const f of db.friendshipsOf(userId)) {
      if (f.status !== 'accepted') continue;
      io.to(`user:${f.from === userId ? f.to : f.from}`).emit('friends:presence', status);
    }
  };

  const games = new GameManager(io, db, presence, notifier, (ids) => ids.forEach((id) => notifyFriendsPresence(id)));
  const matchmaker = new Matchmaker(io, db, games, matchmakingTickMs);
  const invites = new InviteManager(io, db, presence, games, matchmaker, notifier);

  // Atrás de Caddy/Nginx: confia no X-Forwarded-Proto para saber se a conexão original era HTTPS.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  if (config.forceHttps) {
    app.use((req, res, next) => {
      if (req.secure) return next();
      // 308 preserva método e corpo (POST continua POST).
      res.redirect(308, `https://${config.publicHost ?? req.hostname}${req.originalUrl}`);
    });
  }
  app.use(
    helmet({
      // HSTS só faz sentido quando o tráfego é HTTPS.
      strictTransportSecurity: config.forceHttps ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createRoutes(db, presence, io, auth, notifier));
  app.use('/api', createShopRoutes(db, auth, notifier));

  io.use((socket, next) => {
    const userId = auth.verifyToken(String(socket.handshake.auth?.token ?? ''));
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId;
    socket.join(`user:${userId}`);
    if (presence.connect(userId, socket.id)) notifyFriendsPresence(userId);
    games.playerReconnected(userId);

    const active = games.activeGameOf(userId);
    socket.emit('session', {
      activeGame: active ? games.state(active) : null,
      invites: invites.pendingFor(userId),
      unreadNotifications: db.unreadCount(userId),
    });

    const safe = (fn: (...args: any[]) => unknown) => (...args: unknown[]) => {
      const ack = typeof args[args.length - 1] === 'function' ? (args.pop() as Ack) : null;
      try {
        const out = fn(...args);
        ack?.(out ?? { ok: true });
      } catch (e) {
        console.error(e);
        ack?.({ error: 'Erro interno.' });
      }
    };

    // Matchmaking
    socket.on('queue:join', safe(({ timeControl }: { timeControl: string }) => {
      const tc = getTimeControl(timeControl);
      if (!tc) return { error: 'Ritmo de jogo inválido.' };
      if (presence.gameOf(userId)) return { error: 'Você já está em uma partida.' };
      matchmaker.join(userId, tc);
      return { ok: true };
    }));
    socket.on('queue:leave', safe(() => ({ ok: matchmaker.leave(userId) })));

    // Convites
    socket.on('invite:send', safe((input: InviteInput) => invites.send(userId, input)));
    socket.on('invite:accept', safe(({ inviteId }: { inviteId: string }) => invites.accept(userId, inviteId)));
    socket.on('invite:decline', safe(({ inviteId }: { inviteId: string }) => invites.decline(userId, inviteId)));

    // Partida
    socket.on('game:sync', safe(({ gameId }: { gameId: string }) => {
      const g = games.get(gameId);
      if (!g || (g.whiteId !== userId && g.blackId !== userId)) return { error: 'Partida não encontrada.' };
      return { ok: true, state: games.state(g) };
    }));
    socket.on('game:move', safe(({ gameId, ...move }: MoveInput & { gameId: string }) => games.move(userId, gameId, move)));
    socket.on('game:resign', safe(({ gameId }: { gameId: string }) => games.resign(userId, gameId)));
    socket.on('game:offerDraw', safe(({ gameId }: { gameId: string }) => games.offerDraw(userId, gameId)));
    socket.on('game:respondDraw', safe(({ gameId, accept }: { gameId: string; accept: boolean }) =>
      games.respondDraw(userId, gameId, accept)));

    socket.on('disconnect', () => {
      if (presence.disconnect(userId, socket.id)) {
        matchmaker.leave(userId);
        invites.userOffline(userId);
        games.playerDisconnected(userId);
        notifyFriendsPresence(userId);
      }
    });
  });

  return {
    app,
    server,
    io,
    config,
    db,
    games,
    close: async () => {
      matchmaker.shutdown();
      invites.shutdown();
      games.shutdown();
      db.flush();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

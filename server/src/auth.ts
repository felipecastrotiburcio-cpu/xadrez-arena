import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { Config } from './config.js';
import type { Database, User } from './db.js';
import { levelFor } from './levels.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * JWT com HS256 fixo (impede ataques de troca de algoritmo, ex: "none"),
 * issuer/audience validados, expiração curta e `ver` (tokenVersion) para
 * revogar todos os tokens de um usuário de uma vez.
 */
export function createAuth(cfg: Config['jwt'], db: Database) {
  const signToken = (user: User) =>
    jwt.sign({ ver: user.tokenVersion }, cfg.secret, {
      algorithm: 'HS256',
      subject: user.id,
      issuer: cfg.issuer,
      audience: cfg.audience,
      expiresIn: cfg.expiresIn,
    });

  const verifyToken = (token: string): string | null => {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, cfg.secret, {
        algorithms: ['HS256'],
        issuer: cfg.issuer,
        audience: cfg.audience,
      });
      if (typeof payload !== 'object' || typeof payload.sub !== 'string') return null;
      const user = db.getUser(payload.sub);
      if (!user || payload.ver !== user.tokenVersion) return null;
      return user.id;
    } catch {
      return null;
    }
  };

  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const userId = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!userId) {
      res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
      return;
    }
    req.userId = userId;
    next();
  };

  return { signToken, verifyToken, requireAuth };
}

export type Auth = ReturnType<typeof createAuth>;

export type PublicUser = ReturnType<typeof publicUser>;

/** Dados visíveis para qualquer jogador (inclui a aparência equipada). */
export function publicUser(u: User) {
  const level = levelFor(u.rating);
  return {
    id: u.id,
    username: u.username,
    rating: u.rating,
    peakRating: u.peakRating,
    level: level.level,
    levelName: level.name,
    gamesPlayed: u.gamesPlayed,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
    createdAt: u.createdAt,
    winStreak: u.winStreak,
    bestStreak: u.bestStreak,
    cosmetics: {
      avatar: u.equipped.avatar,
      character: u.equipped.character,
      move: u.equipped.move,
    },
  };
}

/** Dados que só o próprio usuário vê. */
export function privateUser(u: User) {
  return {
    ...publicUser(u),
    coins: u.coins,
    inventory: u.inventory,
    equipped: u.equipped,
    dailyBonusAvailable: u.lastDailyBonus !== today(),
  };
}

export const today = () => new Date().toISOString().slice(0, 10);

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_EQUIPPED, DEFAULT_ITEMS, STARTING_COINS, type ItemType } from './catalog.js';

/**
 * Persistência simples em arquivo JSON, suficiente para desenvolvimento e
 * pequenas instalações. Para produção, troque por Postgres mantendo a mesma API.
 */

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
  coins: number;
  inventory: string[];
  equipped: Record<ItemType, string>;
  /** Dia (AAAA-MM-DD, UTC) do último bônus diário resgatado. */
  lastDailyBonus: string | null;
  /** Vitórias seguidas em partidas online. */
  winStreak: number;
  bestStreak: number;
  /** Incrementado para invalidar todos os tokens JWT emitidos (ex: "sair de todos os aparelhos"). */
  tokenVersion: number;
}

export type NotificationType =
  | 'welcome'
  | 'friend_request'
  | 'friend_accepted'
  | 'invite_missed'
  | 'game_result'
  | 'level_up'
  | 'reward';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Dados para o app navegar (ex: { userId } ou { gameId }). */
  data: Record<string, string>;
  read: boolean;
  createdAt: number;
}

const MAX_NOTIFICATIONS_PER_USER = 100;

export interface Friendship {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted';
  createdAt: number;
}

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export interface GameRecord {
  id: string;
  white: string;
  black: string;
  timeControl: string;
  rated: boolean;
  pgn: string;
  result: GameResult;
  reason: string;
  whiteRatingChange: number;
  blackRatingChange: number;
  startedAt: number;
  endedAt: number;
}

interface Data {
  users: User[];
  friendships: Friendship[];
  games: GameRecord[];
  notifications: Notification[];
}

export class Database {
  private data: Data = { users: [], friendships: [], games: [], notifications: [] };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string | null) {
    if (file && fs.existsSync(file)) {
      this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    }
    // Migração: usuários criados antes da loja/notificações.
    for (const u of this.data.users) {
      u.coins ??= STARTING_COINS;
      u.inventory = [...new Set([...(u.inventory ?? []), ...DEFAULT_ITEMS])];
      u.equipped = { ...DEFAULT_EQUIPPED, ...(u.equipped ?? {}) };
      u.lastDailyBonus ??= null;
      u.tokenVersion ??= 0;
      u.winStreak ??= 0;
      u.bestStreak ??= 0;
    }
  }

  private persist() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.flush(), 200);
  }

  flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  // ------------------------------------------------------------ usuários
  createUser(
    u: Omit<User, 'id' | 'createdAt' | 'coins' | 'inventory' | 'equipped' | 'lastDailyBonus' | 'tokenVersion' | 'winStreak' | 'bestStreak'>,
  ): User {
    const user: User = {
      ...u,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      coins: STARTING_COINS,
      inventory: [...DEFAULT_ITEMS],
      equipped: { ...DEFAULT_EQUIPPED },
      lastDailyBonus: null,
      tokenVersion: 0,
      winStreak: 0,
      bestStreak: 0,
    };
    this.data.users.push(user);
    this.persist();
    return user;
  }

  getUser(id: string) {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByName(username: string) {
    const lower = username.toLowerCase();
    return this.data.users.find((u) => u.username.toLowerCase() === lower);
  }

  searchUsers(q: string, limit = 20) {
    const lower = q.toLowerCase();
    return this.data.users.filter((u) => u.username.toLowerCase().includes(lower)).slice(0, limit);
  }

  updateUser(id: string, patch: Partial<User>) {
    const u = this.getUser(id);
    if (!u) return;
    Object.assign(u, patch);
    this.persist();
    return u;
  }

  leaderboard(limit = 50) {
    return [...this.data.users]
      .filter((u) => u.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  rankOf(id: string) {
    const idx = this.leaderboard(Infinity).findIndex((u) => u.id === id);
    return idx === -1 ? null : idx + 1;
  }

  // ------------------------------------------------------------ amizades
  friendshipBetween(a: string, b: string) {
    return this.data.friendships.find(
      (f) => (f.from === a && f.to === b) || (f.from === b && f.to === a),
    );
  }

  getFriendship(id: string) {
    return this.data.friendships.find((f) => f.id === id);
  }

  createFriendRequest(from: string, to: string): Friendship {
    const f: Friendship = { id: crypto.randomUUID(), from, to, status: 'pending', createdAt: Date.now() };
    this.data.friendships.push(f);
    this.persist();
    return f;
  }

  acceptFriendship(id: string) {
    const f = this.getFriendship(id);
    if (f) f.status = 'accepted';
    this.persist();
    return f;
  }

  deleteFriendship(id: string) {
    this.data.friendships = this.data.friendships.filter((f) => f.id !== id);
    this.persist();
  }

  friendshipsOf(userId: string) {
    return this.data.friendships.filter((f) => f.from === userId || f.to === userId);
  }

  areFriends(a: string, b: string) {
    return this.friendshipBetween(a, b)?.status === 'accepted';
  }

  // ------------------------------------------------------------ partidas
  saveGame(g: GameRecord) {
    this.data.games.push(g);
    this.persist();
  }

  gamesOf(userId: string, limit = 30) {
    return this.data.games
      .filter((g) => g.white === userId || g.black === userId)
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, limit);
  }

  getGame(id: string) {
    return this.data.games.find((g) => g.id === id);
  }

  // ------------------------------------------------------------ notificações
  addNotification(n: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
    const notification: Notification = { ...n, id: crypto.randomUUID(), read: false, createdAt: Date.now() };
    this.data.notifications.push(notification);
    const mine = this.data.notifications.filter((x) => x.userId === n.userId);
    if (mine.length > MAX_NOTIFICATIONS_PER_USER) {
      const drop = new Set(mine.slice(0, mine.length - MAX_NOTIFICATIONS_PER_USER).map((x) => x.id));
      this.data.notifications = this.data.notifications.filter((x) => !drop.has(x.id));
    }
    this.persist();
    return notification;
  }

  notificationsOf(userId: string, limit = 50) {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  unreadCount(userId: string) {
    return this.data.notifications.filter((n) => n.userId === userId && !n.read).length;
  }

  markNotificationsRead(userId: string, id?: string) {
    for (const n of this.data.notifications) {
      if (n.userId === userId && (!id || n.id === id)) n.read = true;
    }
    this.persist();
  }
}

import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { AI_LEVELS } from '../ai';
import { ApiError } from './apiError';
import {
  aiCoinReward,
  CATALOG,
  DAILY_BONUS,
  DEFAULT_EQUIPPED,
  DEFAULT_ITEMS,
  getItem,
  LEVEL_UP_BONUS,
  STARTING_COINS,
  streakBonus,
  type ItemType,
} from './catalog';
import { INITIAL_RATING, levelFor, ratingDelta } from './levels';
import type { AppNotification, GameSummary } from './types';

/**
 * "Servidor local": responde às mesmas rotas da API do servidor, guardando
 * contas, moedas, itens, notificações e histórico de partidas contra a IA no
 * próprio aparelho. É usado quando nenhum servidor online está configurado.
 *
 * Senhas: PBKDF2-SHA256 (10 mil iterações) com sal aleatório de 16 bytes.
 */

const STORAGE_KEY = 'xadrez.local.v1';
const PBKDF2_ITERATIONS = 10_000;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const ONLINE_ONLY = 'Amigos, convites e partidas online precisam do servidor online, que ainda não está disponível.';

interface LocalUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
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
  lastDailyBonus: string | null;
  winStreak: number;
  bestStreak: number;
}

interface LocalGame extends Omit<GameSummary, 'opponent'> {
  userId: string;
  opponentName: string;
}

interface Data {
  users: LocalUser[];
  /** token de sessão → id do usuário */
  sessions: Record<string, string>;
  notifications: (AppNotification & { userId: string })[];
  games: LocalGame[];
}

// ------------------------------------------------------------------ dependências do aparelho (injetadas)
export interface LocalDeps {
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
  randomBytes(n: number): Uint8Array;
}
let deps: LocalDeps | null = null;
/** Liga o servidor local ao armazenamento e ao gerador aleatório do aparelho (ver localDevice.ts). */
export function configureLocalBackend(d: LocalDeps) {
  deps = d;
  cache = null;
}
const need = () => {
  if (!deps) throw new Error('Servidor local não configurado');
  return deps;
};

// ------------------------------------------------------------------ armazenamento
let cache: Data | null = null;
let saving: Promise<void> = Promise.resolve();

async function load(): Promise<Data> {
  if (cache) return cache;
  try {
    const raw = await need().storage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : null;
  } catch {
    cache = null;
  }
  cache ??= { users: [], sessions: {}, notifications: [], games: [] };
  // Itens novos gratuitos (ex.: depois de uma atualização) entram no inventário de todos.
  for (const u of cache.users) {
    u.inventory = [...new Set([...u.inventory, ...DEFAULT_ITEMS])];
    u.equipped = { ...DEFAULT_EQUIPPED, ...u.equipped };
  }
  return cache;
}

function save() {
  const snapshot = JSON.stringify(cache);
  // Grava em fila, para escritas não se atropelarem.
  saving = saving.then(() => need().storage.setItem(STORAGE_KEY, snapshot)).catch(() => {});
  return saving;
}

// ------------------------------------------------------------------ eventos (substituem o socket no modo local)
type Listener = (e: { notification: AppNotification; unread: number }) => void;
const listeners = new Set<Listener>();
export const localEvents = {
  onNotification(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ------------------------------------------------------------------ utilidades
const randomHex = (bytes: number) => bytesToHex(need().randomBytes(bytes));
const today = () => new Date().toISOString().slice(0, 10);

async function hashPassword(password: string, salt: string) {
  const key = await pbkdf2Async(sha256, password, salt, { c: PBKDF2_ITERATIONS, dkLen: 32 });
  return bytesToHex(key);
}

/** Comparação em tempo constante. */
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function publicUser(u: LocalUser) {
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
    cosmetics: { avatar: u.equipped.avatar, character: u.equipped.character, move: u.equipped.move },
  };
}

function privateUser(u: LocalUser) {
  return {
    ...publicUser(u),
    coins: u.coins,
    inventory: u.inventory,
    equipped: u.equipped,
    dailyBonusAvailable: u.lastDailyBonus !== today(),
  };
}

function notify(data: Data, userId: string, n: Pick<AppNotification, 'type' | 'title' | 'body'> & { data?: Record<string, string> }) {
  const notification = {
    id: randomHex(8),
    userId,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? {},
    read: false,
    createdAt: Date.now(),
  };
  data.notifications.push(notification);
  // Guarda no máximo 100 por conta.
  const mine = data.notifications.filter((x) => x.userId === userId);
  if (mine.length > 100) {
    const drop = new Set(mine.slice(0, mine.length - 100).map((x) => x.id));
    data.notifications = data.notifications.filter((x) => !drop.has(x.id));
  }
  const unread = data.notifications.filter((x) => x.userId === userId && !x.read).length;
  listeners.forEach((fn) => fn({ notification, unread }));
}

function rankOf(data: Data, id: string) {
  const idx = ranking(data).findIndex((u) => u.id === id);
  return idx === -1 ? null : idx + 1;
}

const ranking = (data: Data) =>
  data.users.filter((u) => u.gamesPlayed > 0).sort((a, b) => b.rating - a.rating);

function requireUser(data: Data, token: string | null) {
  const id = token ? data.sessions[token] : undefined;
  const user = id ? data.users.find((u) => u.id === id) : undefined;
  if (!user) throw new ApiError('Sessão expirada. Entre novamente.', 401);
  return user;
}

// ------------------------------------------------------------------ rotas
type Body = Record<string, unknown> | undefined;

export async function localApi<T>(path: string, method: string, rawBody: unknown, token: string | null): Promise<T> {
  const data = await load();
  const body = (rawBody ?? {}) as Body & Record<string, unknown>;
  const [route] = path.split('?');
  const out = await handle(data, method, route, body, token);
  await save();
  return out as T;
}

async function handle(data: Data, method: string, route: string, body: Record<string, unknown>, token: string | null) {
  // ---- contas
  if (method === 'POST' && route === '/auth/register') {
    const username = String(body.username ?? '');
    const password = String(body.password ?? '');
    if (!USERNAME_RE.test(username)) throw new ApiError('Nome de usuário deve ter 3 a 20 letras, números ou _.', 400);
    if (password.length < 8 || password.length > 128) throw new ApiError('A senha precisa ter de 8 a 128 caracteres.', 400);
    if (data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new ApiError('Esse nome de usuário já existe neste aparelho.', 409);
    }
    const salt = randomHex(16);
    const user: LocalUser = {
      id: `local-${randomHex(8)}`,
      username,
      passwordHash: await hashPassword(password, salt),
      salt,
      rating: INITIAL_RATING,
      peakRating: INITIAL_RATING,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: Date.now(),
      coins: STARTING_COINS,
      inventory: [...DEFAULT_ITEMS],
      equipped: { ...DEFAULT_EQUIPPED },
      lastDailyBonus: null,
      winStreak: 0,
      bestStreak: 0,
    };
    data.users.push(user);
    const t = `local_${randomHex(24)}`;
    data.sessions[t] = user.id;
    notify(data, user.id, {
      type: 'welcome',
      title: 'Bem-vindo à Xadrez Arena!',
      body: `Você ganhou ${STARTING_COINS} moedas para gastar na loja. Vença a IA para ganhar mais!`,
    });
    return { token: t, user: privateUser(user) };
  }

  if (method === 'POST' && route === '/auth/login') {
    const username = String(body.username ?? '').toLowerCase();
    const user = data.users.find((u) => u.username.toLowerCase() === username);
    const ok = user && sameHash(await hashPassword(String(body.password ?? ''), user.salt), user.passwordHash);
    if (!user || !ok) throw new ApiError('Usuário ou senha incorretos.', 401);
    const t = `local_${randomHex(24)}`;
    data.sessions[t] = user.id;
    return { token: t, user: privateUser(user) };
  }

  if (method === 'POST' && route === '/auth/logout-all') {
    const user = requireUser(data, token);
    for (const [t, id] of Object.entries(data.sessions)) if (id === user.id) delete data.sessions[t];
    return { ok: true };
  }

  if (method === 'GET' && route === '/me') {
    const user = requireUser(data, token);
    return {
      user: privateUser(user),
      rank: rankOf(data, user.id),
      activeGameId: null,
      unreadNotifications: data.notifications.filter((n) => n.userId === user.id && !n.read).length,
    };
  }

  // ---- loja
  if (method === 'GET' && route === '/shop/catalog') return { items: CATALOG };

  if (method === 'POST' && (route === '/shop/buy' || route === '/shop/equip')) {
    const user = requireUser(data, token);
    const item = getItem(String(body.itemId ?? ''));
    if (!item) throw new ApiError('Item não encontrado.', 404);
    if (route === '/shop/buy') {
      if (user.inventory.includes(item.id)) throw new ApiError('Você já possui este item.', 409);
      if (item.iap) {
        throw new ApiError('Este item é vendido como compra no app (Google Play / App Store).', 400);
      }
      if (user.coins < item.price) {
        throw new ApiError(`Faltam ${item.price - user.coins} moedas para comprar ${item.name}.`, 402);
      }
      user.coins -= item.price;
      user.inventory.push(item.id);
    } else if (!user.inventory.includes(item.id)) {
      throw new ApiError('Compre o item antes de equipar.', 403);
    }
    // Comprar já equipa: é o que o jogador quer ver em seguida.
    user.equipped = { ...user.equipped, [item.type]: item.id };
    return { user: privateUser(user) };
  }

  if (method === 'POST' && route === '/rewards/daily') {
    const user = requireUser(data, token);
    if (user.lastDailyBonus === today()) throw new ApiError('Você já resgatou o bônus de hoje. Volte amanhã!', 409);
    user.coins += DAILY_BONUS;
    user.lastDailyBonus = today();
    notify(data, user.id, { type: 'reward', title: 'Bônus diário resgatado', body: `+${DAILY_BONUS} moedas. Volte amanhã para mais!` });
    return { user: privateUser(user), amount: DAILY_BONUS };
  }

  // ---- partidas contra a IA (recompensas)
  if (method === 'POST' && route === '/ai/result') {
    const user = requireUser(data, token);
    const level = AI_LEVELS.find((l) => l.id === Number(body.level)) ?? AI_LEVELS[0];
    const score = Number(body.score);
    if (![0, 0.5, 1].includes(score)) throw new ApiError('Resultado inválido.', 400);
    const before = user.rating;
    const change = ratingDelta(before, level.elo, score, user.gamesPlayed);
    const rating = Math.max(100, before + change);
    const levelUp = levelFor(rating).level > levelFor(before).level;
    const winStreak = score === 1 ? user.winStreak + 1 : 0;
    const coins = aiCoinReward(score, level.id) + (score === 1 ? streakBonus(winStreak) : 0) + (levelUp ? LEVEL_UP_BONUS : 0);
    Object.assign(user, {
      rating,
      peakRating: Math.max(user.peakRating, rating),
      gamesPlayed: user.gamesPlayed + 1,
      wins: user.wins + (score === 1 ? 1 : 0),
      losses: user.losses + (score === 0 ? 1 : 0),
      draws: user.draws + (score === 0.5 ? 1 : 0),
      coins: user.coins + coins,
      winStreak,
      bestStreak: Math.max(user.bestStreak, winStreak),
    });
    const outcome = score === 1 ? 'win' : score === 0 ? 'loss' : 'draw';
    const color = body.color === 'black' ? 'black' : 'white';
    data.games.push({
      id: randomHex(8),
      userId: user.id,
      color,
      opponentName: `${level.name} (IA)`,
      result: score === 0.5 ? '1/2-1/2' : (score === 1) === (color === 'white') ? '1-0' : '0-1',
      outcome,
      reason: String(body.reason ?? ''),
      rated: true,
      timeControl: 'IA',
      ratingChange: rating - before,
      endedAt: Date.now(),
    });
    const verdict = score === 1 ? 'Vitória' : score === 0 ? 'Derrota' : 'Empate';
    notify(data, user.id, {
      type: 'game_result',
      title: `${verdict} contra ${level.name}`,
      body: `${rating - before >= 0 ? '+' : ''}${rating - before} de rating · +${coins} moedas${winStreak >= 3 ? ` · 🔥 ${winStreak} vitórias seguidas!` : ''}`,
    });
    if (levelUp) {
      const l = levelFor(rating);
      notify(data, user.id, {
        type: 'level_up',
        title: `Você subiu para o Nível ${l.level}!`,
        body: `Agora você é ${l.name}. Bônus de ${LEVEL_UP_BONUS} moedas!`,
      });
    }
    return { user: privateUser(user), ratingChange: rating - before, coins, levelUp };
  }

  // ---- notificações
  if (method === 'GET' && route === '/notifications') {
    const user = requireUser(data, token);
    const mine = data.notifications.filter((n) => n.userId === user.id);
    return {
      notifications: [...mine].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50),
      unread: mine.filter((n) => !n.read).length,
    };
  }

  if (method === 'POST' && route === '/notifications/read') {
    const user = requireUser(data, token);
    for (const n of data.notifications) if (n.userId === user.id && (!body.id || n.id === body.id)) n.read = true;
    return { unread: data.notifications.filter((n) => n.userId === user.id && !n.read).length };
  }

  // ---- perfil e ranking (das contas deste aparelho)
  if (method === 'GET' && route === '/leaderboard') {
    requireUser(data, token);
    return { players: ranking(data).map((u, i) => ({ rank: i + 1, ...publicUser(u), online: false })) };
  }

  const profile = /^\/users\/([^/]+)$/.exec(route);
  if (method === 'GET' && profile && profile[1] !== 'search') {
    requireUser(data, token);
    const user = data.users.find((u) => u.id === profile[1]);
    if (!user) throw new ApiError('Jogador não encontrado.', 404);
    const games = data.games
      .filter((g) => g.userId === user.id)
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, 20)
      .map(({ userId: _u, ...g }) => ({ ...g, opponent: null }));
    return { user: publicUser(user), rank: rankOf(data, user.id), online: false, inGame: false, friendship: { status: 'none' }, games };
  }

  // ---- recursos que só existem online
  if (route.startsWith('/friends') || route.startsWith('/users/search') || route.startsWith('/games/')) {
    throw new ApiError(ONLINE_ONLY, 503);
  }

  throw new ApiError('Recurso indisponível sem o servidor online.', 404);
}


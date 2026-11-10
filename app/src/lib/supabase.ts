import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import { ApiError } from './apiError';
import { levelFor } from './levels';
import type { PublicUser } from './types';

/**
 * Servidor online no Supabase (partidas pelo mundo). Ligado quando o app é compilado com
 * EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (a chave "anon" é pública:
 * o que protege os dados são as permissões do banco e a função "arena").
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = () => !!URL && !!ANON_KEY && process.env.EXPO_PUBLIC_SERVER_URL !== 'none';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

/**
 * As contas usam nome de usuário + senha. O Supabase Auth pede um e-mail, então cada nome
 * vira um endereço interno que não recebe mensagens (domínio .invalid, reservado).
 */
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@jogadores.xadrezarena.invalid`;

/** Chama a função de borda "arena" e transforma erros em ApiError com a mensagem do servidor. */
export async function arena<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase().functions.invoke('arena', { body: { action, ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let message = 'Não foi possível falar com o servidor.';
    let status = 0;
    if (ctx && typeof ctx.json === 'function') {
      status = ctx.status;
      const payload = await ctx.json().catch(() => null);
      if (payload?.error) message = payload.error;
    }
    throw new ApiError(message, status);
  }
  return data as T;
}

/** Erro do PostgREST/RPC → ApiError com a mensagem do banco (as funções SQL já escrevem em português). */
export function dbError(e: { message: string; code?: string } | null): never | void {
  if (!e) return;
  const status = e.code === 'P0002' ? 404 : e.code === '42501' ? 403 : e.code === '23505' ? 409 : 400;
  throw new ApiError(e.message, status);
}

export interface ProfileRow {
  id: string;
  username: string;
  country: string | null;
  rating: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_streak: number;
  best_streak: number;
  equipped: Record<string, string>;
  created_at: string;
}

/** Linha da tabela profiles → PublicUser (mesmo formato do servidor). */
export function publicUser(p: ProfileRow): PublicUser {
  const level = levelFor(p.rating);
  return {
    id: p.id,
    username: p.username,
    country: p.country,
    rating: p.rating,
    peakRating: p.peak_rating,
    level: level.level,
    levelName: level.name,
    gamesPlayed: p.games_played,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    createdAt: Date.parse(p.created_at),
    winStreak: p.win_streak,
    bestStreak: p.best_streak,
    cosmetics: { avatar: p.equipped.avatar, character: p.equipped.character, move: p.equipped.move },
  };
}

/** País do aparelho (código ISO de 2 letras), para a bandeira no perfil. */
export function deviceCountry(): string | null {
  try {
    const region = getLocales()[0]?.regionCode;
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
    const locale = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.language : '';
    const m = /[-_]([A-Za-z]{2})\b/.exec(locale ?? '');
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ presença (quem está online)

type PresenceMap = Record<string, { online: boolean; inGame: boolean }>;
let presence: PresenceMap = {};
export const presenceOf = (userId: string) => presence[userId] ?? { online: false, inGame: false };
export const setPresenceMap = (p: PresenceMap) => {
  presence = p;
};

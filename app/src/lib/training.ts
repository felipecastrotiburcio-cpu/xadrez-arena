import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { PUZZLES, type Puzzle } from './puzzles';
import type { PrivateUser } from './types';

/**
 * Treino diário: 3 desafios por dia, do nível que combina com o rating do jogador.
 * Do básico (como as peças andam) ao avançado (mate em 2 com sacrifício).
 * O progresso fica salvo no aparelho, separado por perfil (cada conta tem o seu).
 */
export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIERS: Tier[] = [1, 2, 3, 4, 5];
/** Rating mínimo de cada nível de treino (quem começa, com 1000, vê o básico). */
export const TIER_MIN: Record<Tier, number> = { 1: 0, 2: 1050, 3: 1200, 4: 1350, 5: 1550 };
export const DAILY_COUNT = 3;

export function tierForRating(rating: number): Tier {
  return ([5, 4, 3, 2, 1] as Tier[]).find((t) => rating >= TIER_MIN[t]) ?? 1;
}
export const puzzlesOfTier = (tier: Tier) => PUZZLES.filter((p) => p.tier === tier);
export const getPuzzle = (id: string) => PUZZLES.find((p) => p.id === id);

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Desafios do dia: a lista do nível é embaralhada uma vez por jogador e percorrida 3 a 3,
 * dia após dia — passa por todos antes de repetir.
 */
export function dailyPuzzles(profileKey: string, tier: Tier, d = new Date()): Puzzle[] {
  const list = puzzlesOfTier(tier)
    .map((p) => ({ p, k: hash(profileKey + p.id) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
  const start = (dayNumber(d) * DAILY_COUNT) % list.length;
  return Array.from({ length: Math.min(DAILY_COUNT, list.length) }, (_, i) => list[(start + i) % list.length]);
}

// ---------------------------------------------------------------- progresso (por perfil)
export interface TrainingProgress {
  /** Desafios já resolvidos alguma vez. */
  solved: string[];
  /** Desafios do dia resolvidos, por data (AAAA-MM-DD). */
  days: Record<string, string[]>;
  /** Sequência de dias com os 3 desafios do dia completos. */
  streak: number;
  lastFullDay: string | null;
}
const EMPTY: TrainingProgress = { solved: [], days: {}, streak: 0, lastFullDay: null };
const key = (profileKey: string) => `xadrez.training.v1.${profileKey}`;

const cache = new Map<string, TrainingProgress>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(profileKey: string) {
  if (cache.has(profileKey)) return cache.get(profileKey)!;
  let p = EMPTY;
  try {
    const raw = await AsyncStorage.getItem(key(profileKey));
    if (raw) p = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // sem armazenamento: começa do zero
  }
  cache.set(profileKey, p);
  return p;
}

/** Marca um desafio como resolvido (e conta para o dia, se for um dos desafios de hoje). */
export async function markSolved(profileKey: string, puzzle: Puzzle, tier: Tier) {
  const p = await load(profileKey);
  const today = todayKey();
  const daily = dailyPuzzles(profileKey, tier).map((x) => x.id);
  const day = p.days[today] ?? [];
  const next: TrainingProgress = {
    ...p,
    solved: p.solved.includes(puzzle.id) ? p.solved : [...p.solved, puzzle.id],
    days: { ...p.days, [today]: daily.includes(puzzle.id) && !day.includes(puzzle.id) ? [...day, puzzle.id] : day },
  };
  // Completou os 3 de hoje: aumenta a sequência (ou recomeça se pulou um dia).
  if ((next.days[today] ?? []).length >= daily.length && p.lastFullDay !== today) {
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    next.streak = p.lastFullDay === yesterday ? p.streak + 1 : 1;
    next.lastFullDay = today;
  }
  // Guarda só os últimos 30 dias.
  next.days = Object.fromEntries(Object.entries(next.days).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 30));
  cache.set(profileKey, next);
  emit();
  try {
    await AsyncStorage.setItem(key(profileKey), JSON.stringify(next));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export const profileKeyOf = (user: PrivateUser | null | undefined) => user?.id ?? 'convidado';

/** Progresso do perfil atual (atualiza sozinho quando um desafio é resolvido). */
export function useTraining(user: PrivateUser | null | undefined) {
  const profileKey = profileKeyOf(user);
  const rating = user?.rating ?? 1000;
  const tier = tierForRating(rating);
  const [progress, setProgress] = useState<TrainingProgress>(cache.get(profileKey) ?? EMPTY);
  useEffect(() => {
    let alive = true;
    const refresh = () => load(profileKey).then((p) => alive && setProgress(p));
    refresh();
    listeners.add(refresh);
    return () => {
      alive = false;
      listeners.delete(refresh);
    };
  }, [profileKey]);
  const today = dailyPuzzles(profileKey, tier);
  const doneToday = new Set(progress.days[todayKey()] ?? []);
  const yesterday = todayKey(new Date(Date.now() - 86_400_000));
  // A sequência só vale se o último dia completo foi hoje ou ontem.
  const streak = progress.lastFullDay === todayKey() || progress.lastFullDay === yesterday ? progress.streak : 0;
  return { profileKey, rating, tier, today, doneToday, solved: new Set(progress.solved), streak };
}

/** Resumo para a tela inicial: quantos dos desafios de hoje já foram feitos. */
export function useTrainingSummary(user: PrivateUser | null | undefined) {
  const t = useTraining(user);
  return { done: t.today.filter((p) => t.doneToday.has(p.id)).length, total: t.today.length, tier: t.tier };
}

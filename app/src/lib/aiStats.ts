import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'xadrez.aiStats';

export type AiRecord = { wins: number; losses: number; draws: number };
export type AiStats = Record<number, AiRecord>;

export async function loadAiStats(): Promise<AiStats> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
  } catch {
    return {};
  }
}

export async function recordAiResult(level: number, outcome: 'win' | 'loss' | 'draw') {
  const stats = await loadAiStats();
  const r = stats[level] ?? { wins: 0, losses: 0, draws: 0 };
  if (outcome === 'win') r.wins++;
  else if (outcome === 'loss') r.losses++;
  else r.draws++;
  stats[level] = r;
  await AsyncStorage.setItem(KEY, JSON.stringify(stats));
  return stats;
}

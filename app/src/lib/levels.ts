// Sistema de níveis baseado no rating Elo. Mantenha em sincronia com server/src/levels.ts.

export interface Level {
  level: number;
  name: string;
  minRating: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Iniciante', minRating: 0 },
  { level: 2, name: 'Aprendiz', minRating: 800 },
  { level: 3, name: 'Amador', minRating: 1000 },
  { level: 4, name: 'Jogador de Clube', minRating: 1200 },
  { level: 5, name: 'Competidor', minRating: 1400 },
  { level: 6, name: 'Experiente', minRating: 1600 },
  { level: 7, name: 'Especialista', minRating: 1800 },
  { level: 8, name: 'Candidato a Mestre', minRating: 2000 },
  { level: 9, name: 'Mestre', minRating: 2200 },
  { level: 10, name: 'Grande Mestre', minRating: 2400 },
];

export const INITIAL_RATING = 1000;

export function levelFor(rating: number): Level {
  let current = LEVELS[0];
  for (const l of LEVELS) if (rating >= l.minRating) current = l;
  return current;
}

/** Fator K: jogadores novos sobem/descem mais rápido. */
export function kFactor(gamesPlayed: number, rating: number) {
  if (gamesPlayed < 30) return 40;
  if (rating >= 2400) return 10;
  return 20;
}

export function expectedScore(rating: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** Variação de rating para um jogador. `score`: 1 vitória, 0.5 empate, 0 derrota. */
export function ratingDelta(rating: number, opponent: number, score: number, gamesPlayed: number) {
  return Math.round(kFactor(gamesPlayed, rating) * (score - expectedScore(rating, opponent)));
}

/** Progresso (0..1) até o próximo nível. */
export function levelProgress(rating: number) {
  const current = levelFor(rating);
  const next = LEVELS.find((l) => l.level === current.level + 1);
  if (!next) return { current, next: null, progress: 1 };
  return { current, next, progress: (rating - current.minRating) / (next.minRating - current.minRating) };
}

export const LEVEL_ICONS = ['♙', '♙', '♘', '♘', '♗', '♗', '♖', '♖', '♕', '♔'];

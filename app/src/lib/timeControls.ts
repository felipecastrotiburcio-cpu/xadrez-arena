import type { TimeControl } from './types';

// Mantenha em sincronia com server/src/timeControls.ts.
export const TIME_CONTROLS: TimeControl[] = [
  { id: '1+0', label: 'Bullet 1 min', initialMs: 60_000, incrementMs: 0 },
  { id: '3+0', label: 'Blitz 3 min', initialMs: 180_000, incrementMs: 0 },
  { id: '3+2', label: 'Blitz 3 | 2', initialMs: 180_000, incrementMs: 2_000 },
  { id: '5+0', label: 'Blitz 5 min', initialMs: 300_000, incrementMs: 0 },
  { id: '10+0', label: 'Rápida 10 min', initialMs: 600_000, incrementMs: 0 },
  { id: '15+10', label: 'Rápida 15 | 10', initialMs: 900_000, incrementMs: 10_000 },
];

export function formatClock(ms: number) {
  const total = Math.max(0, ms);
  if (total < 10_000) return (total / 1000).toFixed(1);
  const s = Math.ceil(total / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

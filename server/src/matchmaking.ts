import type { Server } from 'socket.io';
import type { Database } from './db.js';
import type { GameManager } from './games.js';
import type { TimeControl } from './timeControls.js';

interface QueueEntry {
  userId: string;
  rating: number;
  timeControl: TimeControl;
  joinedAt: number;
}

/**
 * Fila de partidas ranqueadas. A faixa de rating aceita começa em ±100 e
 * cresce com o tempo de espera, para ninguém ficar esperando para sempre.
 */
export class Matchmaker {
  private queue: QueueEntry[] = [];
  private interval: NodeJS.Timeout;

  constructor(
    private io: Server,
    private db: Database,
    private games: GameManager,
    tickMs = 1000,
  ) {
    this.interval = setInterval(() => this.tick(), tickMs);
  }

  static range(waitedMs: number) {
    return Math.min(100 + Math.floor(waitedMs / 1000) * 25, 800);
  }

  join(userId: string, timeControl: TimeControl) {
    this.leave(userId);
    const user = this.db.getUser(userId)!;
    this.queue.push({ userId, rating: user.rating, timeControl, joinedAt: Date.now() });
    this.tick();
  }

  leave(userId: string) {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.userId !== userId);
    return before !== this.queue.length;
  }

  isQueued(userId: string) {
    return this.queue.some((e) => e.userId === userId);
  }

  tick() {
    const now = Date.now();
    const matched = new Set<string>();
    const sorted = [...this.queue].sort((a, b) => a.joinedAt - b.joinedAt);
    for (const a of sorted) {
      if (matched.has(a.userId)) continue;
      let best: QueueEntry | null = null;
      for (const b of sorted) {
        if (b === a || matched.has(b.userId) || b.timeControl.id !== a.timeControl.id) continue;
        const diff = Math.abs(a.rating - b.rating);
        // Os dois precisam aceitar a diferença dentro da faixa atual.
        if (diff > Matchmaker.range(now - a.joinedAt) || diff > Matchmaker.range(now - b.joinedAt)) continue;
        if (!best || diff < Math.abs(a.rating - best.rating)) best = b;
      }
      if (!best) continue;
      matched.add(a.userId);
      matched.add(best.userId);
      const [white, black] = Math.random() < 0.5 ? [a, best] : [best, a];
      this.games.create(white.userId, black.userId, a.timeControl, true);
    }
    if (matched.size) this.queue = this.queue.filter((e) => !matched.has(e.userId));

    for (const e of this.queue) {
      this.io.to(`user:${e.userId}`).emit('queue:status', {
        timeControl: e.timeControl.id,
        waitedMs: now - e.joinedAt,
        range: Matchmaker.range(now - e.joinedAt),
        playersSearching: this.queue.filter((q) => q.timeControl.id === e.timeControl.id).length,
      });
    }
  }

  shutdown() {
    clearInterval(this.interval);
  }
}

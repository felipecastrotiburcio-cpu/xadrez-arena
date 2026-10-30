import crypto from 'node:crypto';
import { Chess } from 'chess.js';
import type { Server } from 'socket.io';
import type { Database, GameResult } from './db.js';
import type { Presence } from './presence.js';
import type { Notifier } from './notifications.js';
import { coinReward, LEVEL_UP_BONUS, streakBonus } from './catalog.js';
import { publicUser } from './auth.js';
import { levelFor, ratingDelta } from './levels.js';
import type { TimeControl } from './timeControls.js';

type Side = 'w' | 'b';

/** Tempo para o primeiro lance de cada lado antes de a partida ser cancelada. */
export const FIRST_MOVE_MS = 30_000;
/** Tempo para reconectar antes de perder por abandono. */
export const RECONNECT_MS = 60_000;

export interface LiveGame {
  id: string;
  whiteId: string;
  blackId: string;
  chess: Chess;
  timeControl: TimeControl;
  rated: boolean;
  clocks: Record<Side, number>;
  /** Momento em que o relógio do lado da vez começou a correr. */
  turnStartedAt: number;
  startedAt: number;
  drawOffer: Side | null;
  lastMove: { from: string; to: string } | null;
  timer: NodeJS.Timeout | null;
  abandonTimers: Map<string, NodeJS.Timeout>;
  over: boolean;
}

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}

export class GameManager {
  private games = new Map<string, LiveGame>();

  constructor(
    private io: Server,
    private db: Database,
    private presence: Presence,
    private notifier: Notifier,
    /** Chamado quando jogadores entram ou saem de partida (status para os amigos). */
    private onPlayersChanged: (userIds: string[]) => void = () => {},
  ) {}

  get(id: string) {
    return this.games.get(id);
  }

  activeGameOf(userId: string) {
    const id = this.presence.gameOf(userId);
    return id ? this.games.get(id) : undefined;
  }

  private emit(game: LiveGame, event: string, payload: unknown) {
    this.io.to(`user:${game.whiteId}`).to(`user:${game.blackId}`).emit(event, payload);
  }

  private sideOf(game: LiveGame, userId: string): Side | null {
    if (game.whiteId === userId) return 'w';
    if (game.blackId === userId) return 'b';
    return null;
  }

  /** Ambos já jogaram o primeiro lance: a partida vale e os relógios correm. */
  private clocksRunning(game: LiveGame) {
    return game.chess.history().length >= 2;
  }

  /** Relógios com o tempo decorrido do lado da vez já descontado. */
  clocksNow(game: LiveGame) {
    const clocks = { ...game.clocks };
    if (!game.over && this.clocksRunning(game)) {
      const turn = game.chess.turn();
      clocks[turn] = Math.max(0, clocks[turn] - (Date.now() - game.turnStartedAt));
    }
    return clocks;
  }

  state(game: LiveGame) {
    const white = this.db.getUser(game.whiteId)!;
    const black = this.db.getUser(game.blackId)!;
    const clocks = this.clocksNow(game);
    return {
      id: game.id,
      white: publicUser(white),
      black: publicUser(black),
      fen: game.chess.fen(),
      pgn: game.chess.pgn(),
      moves: game.chess.history(),
      lastMove: game.lastMove,
      turn: game.chess.turn(),
      inCheck: game.chess.inCheck(),
      clocks: { white: clocks.w, black: clocks.b },
      clocksRunning: this.clocksRunning(game),
      timeControl: game.timeControl,
      rated: game.rated,
      drawOffer: game.drawOffer,
      serverTime: Date.now(),
    };
  }

  create(whiteId: string, blackId: string, timeControl: TimeControl, rated: boolean) {
    const game: LiveGame = {
      id: crypto.randomUUID(),
      whiteId,
      blackId,
      chess: new Chess(),
      timeControl,
      rated,
      clocks: { w: timeControl.initialMs, b: timeControl.initialMs },
      turnStartedAt: Date.now(),
      startedAt: Date.now(),
      drawOffer: null,
      lastMove: null,
      timer: null,
      abandonTimers: new Map(),
      over: false,
    };
    this.games.set(game.id, game);
    this.presence.setGame(whiteId, game.id);
    this.presence.setGame(blackId, game.id);
    this.schedule(game);
    this.emit(game, 'game:start', this.state(game));
    this.onPlayersChanged([whiteId, blackId]);
    return game;
  }

  /** Agenda queda de bandeira ou cancelamento por falta do primeiro lance. */
  private schedule(game: LiveGame) {
    if (game.timer) clearTimeout(game.timer);
    if (game.over) return;
    if (!this.clocksRunning(game)) {
      game.timer = setTimeout(() => this.finish(game, null, 'cancelada'), FIRST_MOVE_MS);
      return;
    }
    const turn = game.chess.turn();
    const remaining = this.clocksNow(game)[turn];
    game.timer = setTimeout(() => this.flag(game), remaining + 50);
  }

  private flag(game: LiveGame) {
    if (game.over) return;
    const turn = game.chess.turn();
    if (this.clocksNow(game)[turn] > 0) return this.schedule(game);
    game.clocks[turn] = 0;
    // Quem ainda tem tempo só vence se tiver material para dar mate.
    const winner: Side = turn === 'w' ? 'b' : 'w';
    if (!hasMatingMaterial(game.chess, winner)) return this.finish(game, '1/2-1/2', 'tempo esgotado sem material');
    this.finish(game, winner === 'w' ? '1-0' : '0-1', 'tempo');
  }

  move(userId: string, gameId: string, input: MoveInput) {
    const game = this.games.get(gameId);
    if (!game || game.over) return { error: 'Partida não está ativa.' };
    const side = this.sideOf(game, userId);
    if (!side) return { error: 'Você não está nesta partida.' };
    if (game.chess.turn() !== side) return { error: 'Não é a sua vez.' };

    const now = Date.now();
    if (this.clocksRunning(game)) {
      const left = game.clocks[side] - (now - game.turnStartedAt);
      if (left <= 0) {
        this.flag(game);
        return { error: 'Seu tempo acabou.' };
      }
      game.clocks[side] = left + game.timeControl.incrementMs;
    }

    let san: string;
    try {
      const m = game.chess.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
      san = m.san;
      game.lastMove = { from: m.from, to: m.to };
    } catch {
      return { error: 'Lance ilegal.' };
    }

    game.turnStartedAt = now;
    if (game.drawOffer && game.drawOffer !== side) game.drawOffer = null;
    this.schedule(game);
    this.emit(game, 'game:state', this.state(game));

    const c = game.chess;
    if (c.isCheckmate()) this.finish(game, side === 'w' ? '1-0' : '0-1', 'xeque-mate');
    else if (c.isStalemate()) this.finish(game, '1/2-1/2', 'afogamento');
    else if (c.isInsufficientMaterial()) this.finish(game, '1/2-1/2', 'material insuficiente');
    else if (c.isThreefoldRepetition()) this.finish(game, '1/2-1/2', 'repetição tripla');
    else if (c.isDrawByFiftyMoves()) this.finish(game, '1/2-1/2', 'regra dos 50 lances');
    return { ok: true, san };
  }

  resign(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    const side = game && this.sideOf(game, userId);
    if (!game || !side || game.over) return { error: 'Partida não está ativa.' };
    if (!this.clocksRunning(game)) {
      this.finish(game, null, 'cancelada');
    } else {
      this.finish(game, side === 'w' ? '0-1' : '1-0', 'desistência');
    }
    return { ok: true };
  }

  offerDraw(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    const side = game && this.sideOf(game, userId);
    if (!game || !side || game.over) return { error: 'Partida não está ativa.' };
    if (game.drawOffer && game.drawOffer !== side) {
      this.finish(game, '1/2-1/2', 'acordo');
      return { ok: true };
    }
    game.drawOffer = side;
    this.emit(game, 'game:state', this.state(game));
    return { ok: true };
  }

  respondDraw(userId: string, gameId: string, accept: boolean) {
    const game = this.games.get(gameId);
    const side = game && this.sideOf(game, userId);
    if (!game || !side || game.over) return { error: 'Partida não está ativa.' };
    if (!game.drawOffer || game.drawOffer === side) return { error: 'Não há proposta de empate.' };
    if (accept) {
      this.finish(game, '1/2-1/2', 'acordo');
    } else {
      game.drawOffer = null;
      this.emit(game, 'game:state', this.state(game));
    }
    return { ok: true };
  }

  /** Jogador perdeu a última conexão: começa a contagem para abandono. */
  playerDisconnected(userId: string) {
    const game = this.activeGameOf(userId);
    if (!game || game.over) return;
    const side = this.sideOf(game, userId)!;
    this.emit(game, 'game:opponentConnection', { userId, connected: false, timeoutMs: RECONNECT_MS });
    game.abandonTimers.set(
      userId,
      setTimeout(() => {
        if (game.over) return;
        if (!this.clocksRunning(game)) return this.finish(game, null, 'cancelada');
        this.finish(game, side === 'w' ? '0-1' : '1-0', 'abandono');
      }, RECONNECT_MS),
    );
  }

  playerReconnected(userId: string) {
    const game = this.activeGameOf(userId);
    if (!game) return;
    const t = game.abandonTimers.get(userId);
    if (t) {
      clearTimeout(t);
      game.abandonTimers.delete(userId);
      this.emit(game, 'game:opponentConnection', { userId, connected: true });
    }
  }

  /** Encerra a partida. `result` null = cancelada (não conta para o rating). */
  finish(game: LiveGame, result: GameResult | null, reason: string) {
    if (game.over) return;
    game.clocks = this.clocksNow(game);
    game.over = true;
    if (game.timer) clearTimeout(game.timer);
    for (const t of game.abandonTimers.values()) clearTimeout(t);
    this.presence.setGame(game.whiteId, null);
    this.presence.setGame(game.blackId, null);
    this.games.delete(game.id);

    const white = this.db.getUser(game.whiteId)!;
    const black = this.db.getUser(game.blackId)!;
    const changes = { w: 0, b: 0 };
    const coins = { w: 0, b: 0 };
    const levelUp = { w: false, b: false };
    const streaks = { w: white.winStreak, b: black.winStreak };

    if (result) {
      const ws = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
      if (game.rated) {
        changes.w = ratingDelta(white.rating, black.rating, ws, white.gamesPlayed);
        changes.b = ratingDelta(black.rating, white.rating, 1 - ws, black.gamesPlayed);
      }
      for (const [side, u, opp, score] of [
        ['w', white, black, ws],
        ['b', black, white, 1 - ws],
      ] as const) {
        const before = u.rating;
        const rating = Math.max(100, before + changes[side]);
        const newLevel = levelFor(rating);
        levelUp[side] = newLevel.level > levelFor(before).level;
        const winStreak = score === 1 ? u.winStreak + 1 : 0;
        coins[side] = coinReward(score, game.rated) + (levelUp[side] ? LEVEL_UP_BONUS : 0) + (score === 1 ? streakBonus(winStreak) : 0);
        streaks[side] = winStreak;
        this.db.updateUser(u.id, {
          rating,
          peakRating: Math.max(u.peakRating, rating),
          gamesPlayed: u.gamesPlayed + 1,
          wins: u.wins + (score === 1 ? 1 : 0),
          losses: u.losses + (score === 0 ? 1 : 0),
          draws: u.draws + (score === 0.5 ? 1 : 0),
          coins: u.coins + coins[side],
          winStreak,
          bestStreak: Math.max(u.bestStreak, winStreak),
        });

        const verdict = score === 1 ? 'Vitória' : score === 0 ? 'Derrota' : 'Empate';
        const delta = changes[side];
        this.notifier.notify(u.id, {
          type: 'game_result',
          title: `${verdict} contra ${opp.username}`,
          body: `${game.rated ? `${delta >= 0 ? '+' : ''}${delta} de rating · ` : ''}+${coins[side]} moedas (${reason})${winStreak >= 3 ? ` · 🔥 ${winStreak} vitórias seguidas!` : ''}`,
          data: { gameId: game.id, userId: opp.id },
        });
        if (levelUp[side]) {
          this.notifier.notify(u.id, {
            type: 'level_up',
            title: `Você subiu para o Nível ${newLevel.level}!`,
            body: `Agora você é ${newLevel.name}. Bônus de ${LEVEL_UP_BONUS} moedas!`,
          });
        }
        this.notifier.walletChanged(u.id);
      }
      game.chess.setHeader('Event', game.rated ? 'Partida ranqueada' : 'Partida amistosa');
      game.chess.setHeader('White', white.username);
      game.chess.setHeader('Black', black.username);
      game.chess.setHeader('Result', result);
      this.db.saveGame({
        id: game.id,
        white: white.id,
        black: black.id,
        timeControl: game.timeControl.id,
        rated: game.rated,
        pgn: game.chess.pgn(),
        result,
        reason,
        whiteRatingChange: changes.w,
        blackRatingChange: changes.b,
        startedAt: game.startedAt,
        endedAt: Date.now(),
      });
    }

    this.emit(game, 'game:over', {
      ...this.state(game),
      result,
      reason,
      ratingChanges: { white: changes.w, black: changes.b },
      coinRewards: { white: coins.w, black: coins.b },
      levelUp: { white: levelUp.w, black: levelUp.b },
      streaks: { white: streaks.w, black: streaks.b },
    });
    this.onPlayersChanged([game.whiteId, game.blackId]);
  }

  shutdown() {
    for (const g of this.games.values()) {
      if (g.timer) clearTimeout(g.timer);
      for (const t of g.abandonTimers.values()) clearTimeout(t);
    }
  }
}

/** Material mínimo para conseguir dar mate (regra de queda de bandeira da FIDE simplificada). */
function hasMatingMaterial(chess: Chess, side: Side) {
  let minors = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== side) continue;
      if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true;
      if (sq.type === 'n' || sq.type === 'b') minors++;
    }
  }
  return minors >= 2;
}

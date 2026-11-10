// Função de borda "arena" do Xadrez Arena (Supabase Edge Functions / Deno).
// Tudo que precisa de regra de xadrez ou mexe em rating/moedas passa por aqui:
// fila, convites aceitos, lances (validados com chess.js), desistência, empate,
// queda de bandeira, loja, bônus diário, moedas da IA e compras reais.
// O app chama com o token do jogador; a função usa a chave de serviço para gravar.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { CATALOG, DAILY_BONUS, LEVEL_UP_BONUS, aiCoinReward, coinReward, getItem, streakBonus } from '../_shared/catalog.ts';
import { levelFor, ratingDelta } from '../_shared/levels.ts';
import { getTimeControl, type TimeControl } from '../_shared/timeControls.ts';
import { PurchaseError, verifyPurchase } from './purchases.ts';

type Side = 'w' | 'b';
type Json = Record<string, unknown>;

/** Tempo para o primeiro lance de cada lado antes de a partida poder ser cancelada. */
const FIRST_MOVE_MS = 30_000;
/** Teto diário de moedas ganhas contra a IA (o resultado vem do aparelho). */
const AI_DAILY_CAP = 300;
const AI_LEVELS_COUNT = 5;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------ jogadores

interface ProfileRow {
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

interface WalletRow {
  user_id: string;
  coins: number;
  inventory: string[];
  last_daily: string | null;
}

/** Mesmo formato de PublicUser do app (mais o país). */
function publicUser(p: ProfileRow) {
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

function privateUser(p: ProfileRow, w: WalletRow) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...publicUser(p),
    coins: w.coins,
    inventory: w.inventory,
    equipped: p.equipped,
    dailyBonusAvailable: w.last_daily !== today,
  };
}

// ------------------------------------------------------------------ partidas

interface GameRow {
  id: string;
  white_id: string;
  black_id: string;
  time_control: string;
  rated: boolean;
  status: 'active' | 'over';
  result: string | null;
  reason: string | null;
  pgn: string;
  fen: string;
  clock_w: number;
  clock_b: number;
  turn_started_at: string;
  draw_offer: Side | null;
  version: number;
  state: Json;
  created_at: string;
}

function loadChess(row: Pick<GameRow, 'pgn'>) {
  const chess = new Chess();
  if (row.pgn) chess.loadPgn(row.pgn);
  return chess;
}

/** Ambos já jogaram o primeiro lance: a partida vale e os relógios correm. */
const clocksRunning = (chess: Chess) => chess.history().length >= 2;

/** Relógios com o tempo do lado da vez já descontado. */
function clocksNow(row: GameRow, chess: Chess, now = Date.now()) {
  const clocks = { w: row.clock_w, b: row.clock_b };
  if (row.status === 'active' && clocksRunning(chess)) {
    const turn = chess.turn();
    clocks[turn] = Math.max(0, clocks[turn] - (now - Date.parse(row.turn_started_at)));
  }
  return clocks;
}

function lastMoveOf(chess: Chess) {
  const h = chess.history({ verbose: true });
  const m = h[h.length - 1];
  return m ? { from: m.from, to: m.to } : null;
}

/** Estado para o app (formato GameState). */
function buildState(
  row: Pick<GameRow, 'id' | 'rated' | 'draw_offer'>,
  chess: Chess,
  players: { white: ReturnType<typeof publicUser>; black: ReturnType<typeof publicUser> },
  tc: TimeControl,
  clocks: { w: number; b: number },
) {
  return {
    id: row.id,
    white: players.white,
    black: players.black,
    fen: chess.fen(),
    pgn: chess.pgn(),
    moves: chess.history(),
    lastMove: lastMoveOf(chess),
    turn: chess.turn(),
    inCheck: chess.inCheck(),
    clocks: { white: clocks.w, black: clocks.b },
    clocksRunning: clocksRunning(chess),
    timeControl: tc,
    rated: row.rated,
    drawOffer: row.draw_offer,
    serverTime: Date.now(),
  };
}

/** Material mínimo para dar mate (quem fica sem tempo empata se o outro não tiver). */
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

class Arena {
  constructor(private db: SupabaseClient, private userId: string) {}

  // ---------------------------------------------------------------- leitura

  async profile(id: string): Promise<ProfileRow> {
    const { data, error } = await this.db.from('profiles').select('*').eq('id', id).single();
    if (error || !data) throw new UserError('Jogador não encontrado.', 404);
    return data as ProfileRow;
  }

  async wallet(id = this.userId): Promise<WalletRow> {
    const { data, error } = await this.db.from('wallets').select('*').eq('user_id', id).single();
    if (error || !data) throw new UserError('Carteira não encontrada.', 404);
    return data as WalletRow;
  }

  async me() {
    const [p, w] = await Promise.all([this.profile(this.userId), this.wallet()]);
    return privateUser(p, w);
  }

  async game(id: string): Promise<GameRow> {
    const { data, error } = await this.db.from('games').select('*').eq('id', id).single();
    if (error || !data) throw new UserError('Partida não encontrada.', 404);
    return data as GameRow;
  }

  sideOf(row: GameRow): Side | null {
    if (row.white_id === this.userId) return 'w';
    if (row.black_id === this.userId) return 'b';
    return null;
  }

  // ---------------------------------------------------------------- criação

  async createGame(whiteId: string, blackId: string, tc: TimeControl, rated: boolean) {
    const [white, black] = await Promise.all([this.profile(whiteId), this.profile(blackId)]);
    const chess = new Chess();
    const id = crypto.randomUUID();
    const clocks = { w: tc.initialMs, b: tc.initialMs };
    const state = buildState({ id, rated, draw_offer: null }, chess, { white: publicUser(white), black: publicUser(black) }, tc, clocks);
    const { error } = await this.db.from('games').insert({
      id,
      white_id: whiteId,
      black_id: blackId,
      time_control: tc.id,
      rated,
      clock_w: clocks.w,
      clock_b: clocks.b,
      fen: chess.fen(),
      state,
    });
    if (error) throw new Error(error.message);
    return state;
  }

  /** Partida ativa do jogador; se ela já deveria ter terminado (tempo/abandono), encerra antes. */
  async activeGameOf(userId: string): Promise<GameRow | null> {
    const { data } = await this.db
      .from('games')
      .select('*')
      .eq('status', 'active')
      .or(`white_id.eq.${userId},black_id.eq.${userId}`)
      .limit(1);
    const row = (data?.[0] as GameRow | undefined) ?? null;
    if (!row) return null;
    const ended = await this.resolveExpired(row);
    return ended ? null : row;
  }

  // ---------------------------------------------------------------- fila

  async queue(timeControl: string): Promise<Json> {
    const tc = getTimeControl(timeControl);
    if (!tc) throw new UserError('Ritmo de jogo inválido.');
    if (await this.activeGameOf(this.userId)) throw new UserError('Termine sua partida atual primeiro.', 409);
    const { data: oppId, error } = await this.db.rpc('mm_try_pair', { p_user: this.userId, p_time_control: tc.id });
    if (error) throw new Error(error.message);
    if (oppId) {
      // O adversário pode ter entrado numa partida por convite enquanto esperava.
      if (await this.activeGameOf(oppId as string)) return this.queue(timeControl);
      const [w, b] = Math.random() < 0.5 ? [this.userId, oppId as string] : [oppId as string, this.userId];
      const state = await this.createGame(w, b, tc, true);
      return { matched: true, gameId: state.id, state };
    }
    const { data: me } = await this.db.from('queue').select('joined_at').eq('user_id', this.userId).single();
    const waitedMs = me ? Date.now() - Date.parse(me.joined_at) : 0;
    const { count } = await this.db
      .from('queue')
      .select('user_id', { count: 'exact', head: true })
      .eq('time_control', tc.id)
      .gt('seen_at', new Date(Date.now() - 20_000).toISOString());
    return {
      matched: false,
      status: { timeControl: tc.id, waitedMs, range: Math.min(100 + Math.floor(waitedMs / 1000) * 25, 800), playersSearching: count ?? 1 },
    };
  }

  async leaveQueue() {
    await this.db.from('queue').delete().eq('user_id', this.userId);
    return { ok: true };
  }

  // ---------------------------------------------------------------- convites

  async acceptInvite(inviteId: string) {
    const { data: inv } = await this.db
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)
      .eq('to_id', this.userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .select('*')
      .single();
    if (!inv) throw new UserError('Convite não encontrado ou expirado.', 404);
    if ((await this.activeGameOf(inv.from_id)) || (await this.activeGameOf(inv.to_id))) {
      await this.db.from('invites').update({ status: 'cancelled' }).eq('id', inviteId);
      throw new UserError('Um dos jogadores já está em outra partida.', 409);
    }
    const tc = getTimeControl(inv.time_control)!;
    const inviterWhite = inv.color === 'white' || (inv.color === 'random' && Math.random() < 0.5);
    const [w, b] = inviterWhite ? [inv.from_id, inv.to_id] : [inv.to_id, inv.from_id];
    const state = await this.createGame(w, b, tc, inv.rated);
    await this.db.from('invites').update({ game_id: state.id }).eq('id', inviteId);
    await this.db.from('queue').delete().in('user_id', [w, b]);
    return { gameId: state.id, state };
  }

  // ---------------------------------------------------------------- lances e fim de partida

  async move(gameId: string, input: { from: string; to: string; promotion?: string }) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.game(gameId);
      if (row.status !== 'active') throw new UserError('Partida não está ativa.', 409);
      const side = this.sideOf(row);
      if (!side) throw new UserError('Você não está nesta partida.', 403);
      const chess = loadChess(row);
      if (chess.turn() !== side) throw new UserError('Não é a sua vez.', 409);

      const now = Date.now();
      const tc = getTimeControl(row.time_control)!;
      const clocks = { w: row.clock_w, b: row.clock_b };
      if (clocksRunning(chess)) {
        const left = clocks[side] - (now - Date.parse(row.turn_started_at));
        if (left <= 0) {
          await this.resolveExpired(row);
          throw new UserError('Seu tempo acabou.', 409);
        }
        clocks[side] = left + tc.incrementMs;
      }
      try {
        chess.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
      } catch {
        throw new UserError('Lance ilegal.');
      }
      const drawOffer = row.draw_offer && row.draw_offer !== side ? null : row.draw_offer;

      const end = chess.isCheckmate()
        ? { result: side === 'w' ? '1-0' : '0-1', reason: 'xeque-mate' }
        : chess.isStalemate()
          ? { result: '1/2-1/2', reason: 'afogamento' }
          : chess.isInsufficientMaterial()
            ? { result: '1/2-1/2', reason: 'material insuficiente' }
            : chess.isThreefoldRepetition()
              ? { result: '1/2-1/2', reason: 'repetição tripla' }
              : chess.isDrawByFiftyMoves()
                ? { result: '1/2-1/2', reason: 'regra dos 50 lances' }
                : null;
      if (end) {
        const st = await this.finish(row, chess, end.result as GameResult, end.reason, clocks);
        if (st) return { ok: true, state: st };
        continue; // outra ação mudou a partida ao mesmo tempo: tenta de novo
      }

      const players = { white: row.state.white as ReturnType<typeof publicUser>, black: row.state.black as ReturnType<typeof publicUser> };
      const state = buildState({ id: row.id, rated: row.rated, draw_offer: drawOffer }, chess, players, tc, clocks);
      const { data } = await this.db
        .from('games')
        .update({
          pgn: chess.pgn(),
          fen: chess.fen(),
          clock_w: clocks.w,
          clock_b: clocks.b,
          turn_started_at: new Date(now).toISOString(),
          draw_offer: drawOffer,
          version: row.version + 1,
          state,
        })
        .eq('id', row.id)
        .eq('version', row.version)
        .select('id');
      if (data?.length) return { ok: true, state };
    }
    throw new UserError('A partida mudou ao mesmo tempo. Tente de novo.', 409);
  }

  /**
   * Encerra a partida (result null = cancelada, não conta). Aplica rating, moedas, sequência,
   * notificações e devolve o estado final (GameOver). Retorna null se outra ação chegou antes.
   */
  async finish(row: GameRow, chess: Chess, result: GameResult | null, reason: string, clocks = clocksNow(row, chess)) {
    const [white, black] = await Promise.all([this.profile(row.white_id), this.profile(row.black_id)]);
    const changes = { w: 0, b: 0 };
    const coins = { w: 0, b: 0 };
    const levelUp = { w: false, b: false };
    const streaks = { w: white.win_streak, b: black.win_streak };
    const updated = { w: { ...white }, b: { ...black } };
    const players: Json[] = [];
    const notes: Json[] = [];

    if (result) {
      const ws = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
      if (row.rated) {
        changes.w = ratingDelta(white.rating, black.rating, ws, white.games_played);
        changes.b = ratingDelta(black.rating, white.rating, 1 - ws, black.games_played);
      }
      for (const [side, u, opp, score] of [
        ['w', white, black, ws],
        ['b', black, white, 1 - ws],
      ] as const) {
        const rating = Math.max(100, u.rating + changes[side]);
        const newLevel = levelFor(rating);
        levelUp[side] = newLevel.level > levelFor(u.rating).level;
        const winStreak = score === 1 ? u.win_streak + 1 : 0;
        coins[side] = coinReward(score, row.rated) + (levelUp[side] ? LEVEL_UP_BONUS : 0) + (score === 1 ? streakBonus(winStreak) : 0);
        streaks[side] = winStreak;
        players.push({
          id: u.id,
          rating,
          win: score === 1 ? 1 : 0,
          loss: score === 0 ? 1 : 0,
          draw: score === 0.5 ? 1 : 0,
          winStreak,
          coins: coins[side],
        });
        updated[side] = {
          ...u,
          rating,
          peak_rating: Math.max(u.peak_rating, rating),
          games_played: u.games_played + 1,
          wins: u.wins + (score === 1 ? 1 : 0),
          losses: u.losses + (score === 0 ? 1 : 0),
          draws: u.draws + (score === 0.5 ? 1 : 0),
          win_streak: winStreak,
          best_streak: Math.max(u.best_streak, winStreak),
        };
        const verdict = score === 1 ? 'Vitória' : score === 0 ? 'Derrota' : 'Empate';
        const delta = changes[side];
        notes.push({
          userId: u.id,
          type: 'game_result',
          title: `${verdict} contra ${opp.username}`,
          body: `${row.rated ? `${delta >= 0 ? '+' : ''}${delta} de rating · ` : ''}+${coins[side]} moedas (${reason})${winStreak >= 3 ? ` · 🔥 ${winStreak} vitórias seguidas!` : ''}`,
          data: { gameId: row.id, userId: opp.id },
        });
        if (levelUp[side]) {
          notes.push({
            userId: u.id,
            type: 'level_up',
            title: `Você subiu para o Nível ${newLevel.level}!`,
            body: `Agora você é ${newLevel.name}. Bônus de ${LEVEL_UP_BONUS} moedas!`,
            data: {},
          });
        }
      }
      chess.setHeader('Event', row.rated ? 'Partida ranqueada' : 'Partida amistosa');
      chess.setHeader('White', white.username);
      chess.setHeader('Black', black.username);
      chess.setHeader('Result', result);
    }

    const tc = getTimeControl(row.time_control)!;
    const base = buildState(
      { id: row.id, rated: row.rated, draw_offer: null },
      chess,
      { white: publicUser(updated.w), black: publicUser(updated.b) },
      tc,
      clocks,
    );
    const state = {
      ...base,
      result,
      reason,
      ratingChanges: { white: changes.w, black: changes.b },
      coinRewards: { white: coins.w, black: coins.b },
      levelUp: { white: levelUp.w, black: levelUp.b },
      streaks: { white: streaks.w, black: streaks.b },
    };
    const { data: ok, error } = await this.db.rpc('finish_game', {
      p_game: row.id,
      p_version: row.version,
      p_state: state,
      p_result: result,
      p_reason: reason,
      p_pgn: chess.pgn(),
      p_fen: chess.fen(),
      p_clock_w: clocks.w,
      p_clock_b: clocks.b,
      p_players: players,
      p_notifications: notes,
    });
    if (error) throw new Error(error.message);
    return ok ? state : null;
  }

  /** Encerra a partida se o tempo de alguém acabou ou se o primeiro lance não veio a tempo. */
  async resolveExpired(row: GameRow): Promise<Json | null> {
    if (row.status !== 'active') return null;
    const chess = loadChess(row);
    const now = Date.now();
    if (!clocksRunning(chess)) {
      if (now - Date.parse(row.turn_started_at) > FIRST_MOVE_MS) return this.finish(row, chess, null, 'cancelada');
      return null;
    }
    const clocks = clocksNow(row, chess, now);
    const turn = chess.turn();
    if (clocks[turn] > 0) return null;
    const winner: Side = turn === 'w' ? 'b' : 'w';
    if (!hasMatingMaterial(chess, winner)) return this.finish(row, chess, '1/2-1/2', 'tempo esgotado sem material', clocks);
    return this.finish(row, chess, winner === 'w' ? '1-0' : '0-1', 'tempo', clocks);
  }

  /** Qualquer jogador pode pedir para o servidor conferir o tempo (o relógio da tela zerou). */
  async claim(gameId: string) {
    const row = await this.game(gameId);
    if (!this.sideOf(row)) throw new UserError('Você não está nesta partida.', 403);
    const state = await this.resolveExpired(row);
    return state ? { ok: true, state } : { ok: false, state: await this.sync(gameId) };
  }

  async resign(gameId: string) {
    const row = await this.game(gameId);
    const side = this.sideOf(row);
    if (!side || row.status !== 'active') throw new UserError('Partida não está ativa.', 409);
    const chess = loadChess(row);
    const state = clocksRunning(chess)
      ? await this.finish(row, chess, side === 'w' ? '0-1' : '1-0', 'desistência')
      : await this.finish(row, chess, null, 'cancelada');
    if (!state) throw new UserError('A partida mudou ao mesmo tempo. Tente de novo.', 409);
    return { ok: true, state };
  }

  async offerDraw(gameId: string) {
    const row = await this.game(gameId);
    const side = this.sideOf(row);
    if (!side || row.status !== 'active') throw new UserError('Partida não está ativa.', 409);
    const chess = loadChess(row);
    if (row.draw_offer && row.draw_offer !== side) {
      const state = await this.finish(row, chess, '1/2-1/2', 'acordo');
      if (!state) throw new UserError('A partida mudou ao mesmo tempo. Tente de novo.', 409);
      return { ok: true, state };
    }
    return this.updateDrawOffer(row, chess, side);
  }

  async respondDraw(gameId: string, accept: boolean) {
    const row = await this.game(gameId);
    const side = this.sideOf(row);
    if (!side || row.status !== 'active') throw new UserError('Partida não está ativa.', 409);
    if (!row.draw_offer || row.draw_offer === side) throw new UserError('Não há proposta de empate.', 409);
    const chess = loadChess(row);
    if (accept) {
      const state = await this.finish(row, chess, '1/2-1/2', 'acordo');
      if (!state) throw new UserError('A partida mudou ao mesmo tempo. Tente de novo.', 409);
      return { ok: true, state };
    }
    return this.updateDrawOffer(row, chess, null);
  }

  private async updateDrawOffer(row: GameRow, chess: Chess, offer: Side | null) {
    const tc = getTimeControl(row.time_control)!;
    const players = { white: row.state.white as ReturnType<typeof publicUser>, black: row.state.black as ReturnType<typeof publicUser> };
    const state = buildState({ id: row.id, rated: row.rated, draw_offer: offer }, chess, players, tc, clocksNow(row, chess));
    // O relógio de quem está na vez continua correndo: guarda os valores originais.
    const { data } = await this.db
      .from('games')
      .update({ draw_offer: offer, version: row.version + 1, state })
      .eq('id', row.id)
      .eq('version', row.version)
      .select('id');
    if (!data?.length) throw new UserError('A partida mudou ao mesmo tempo. Tente de novo.', 409);
    return { ok: true, state };
  }

  /** Estado atual com os relógios do momento (ao abrir a tela ou reconectar). */
  async sync(gameId: string) {
    const row = await this.game(gameId);
    if (row.status === 'over') return row.state;
    const ended = await this.resolveExpired(row);
    if (ended) return ended;
    const chess = loadChess(row);
    return { ...row.state, clocks: (() => { const c = clocksNow(row, chess); return { white: c.w, black: c.b }; })(), serverTime: Date.now() };
  }

  /** Partida ativa do jogador (ao abrir o app). */
  async session() {
    const row = await this.activeGameOf(this.userId);
    return { activeGame: row ? await this.sync(row.id) : null };
  }

  // ---------------------------------------------------------------- loja

  async buy(itemId: string) {
    const item = getItem(itemId);
    if (!item) throw new UserError('Item não encontrado.', 404);
    if (item.iap) throw new UserError('Este item é vendido como compra no app (Google Play / App Store).');
    const { data: left, error } = await this.db.rpc('buy_item', { p_user: this.userId, p_item: item.id, p_price: item.price });
    if (error) throw new Error(error.message);
    if (left === null) {
      const w = await this.wallet();
      if (w.inventory.includes(item.id)) throw new UserError('Você já possui este item.', 409);
      throw new UserError(`Faltam ${item.price - w.coins} moedas para comprar ${item.name}.`, 402);
    }
    await this.db.rpc('equip_item', { p_user: this.userId, p_type: item.type, p_item: item.id });
    return { user: await this.me() };
  }

  async equip(itemId: string) {
    const item = getItem(itemId);
    if (!item) throw new UserError('Item não encontrado.', 404);
    const { data: ok } = await this.db.rpc('equip_item', { p_user: this.userId, p_type: item.type, p_item: item.id });
    if (!ok) throw new UserError('Compre o item antes de equipar.', 403);
    return { user: await this.me() };
  }

  async daily() {
    const { data } = await this.db.rpc('claim_daily', { p_user: this.userId, p_amount: DAILY_BONUS });
    if (data === null) throw new UserError('Você já resgatou o bônus de hoje. Volte amanhã!', 409);
    return { user: await this.me(), amount: DAILY_BONUS };
  }

  /** Partida contra a IA no modo online: só moedas (o rating online não muda, o resultado vem do aparelho). */
  async aiResult(level: number, score: number) {
    if (![0, 0.5, 1].includes(score)) throw new UserError('Resultado inválido.');
    const lv = Math.min(AI_LEVELS_COUNT, Math.max(1, Math.round(level) || 1));
    const { data: granted } = await this.db.rpc('ai_reward', {
      p_user: this.userId,
      p_coins: aiCoinReward(score, lv),
      p_daily_cap: AI_DAILY_CAP,
    });
    return { user: await this.me(), coins: granted ?? 0, ratingChange: 0, levelUp: false };
  }

  async purchase(input: Json) {
    const r = await verifyPurchase(input);
    const item = CATALOG.find((i) => i.iap === r.productId);
    if (!item) throw new UserError('Produto desconhecido.', 404);
    const { data: ok, error } = await this.db.rpc('grant_purchase', {
      p_user: this.userId,
      p_platform: r.platform,
      p_product: r.productId,
      p_item: item.id,
      p_transaction: r.transactionId,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new UserError('Esta compra pertence a outra conta.', 409);
    return { user: await this.me(), itemId: item.id };
  }
}

type GameResult = '1-0' | '0-1' | '1/2-1/2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await db.auth.getUser(token);
    if (!auth?.user) return json({ error: 'Entre na sua conta.' }, 401);
    const arena = new Arena(db, auth.user.id);
    const body = (await req.json().catch(() => ({}))) as Json;
    const s = (k: string) => String(body[k] ?? '');

    switch (body.action) {
      case 'session':
        return json(await arena.session());
      case 'queue':
        return json(await arena.queue(s('timeControl')));
      case 'queue_leave':
        return json(await arena.leaveQueue());
      case 'invite_accept':
        return json(await arena.acceptInvite(s('inviteId')));
      case 'move':
        return json(await arena.move(s('gameId'), { from: s('from'), to: s('to'), promotion: body.promotion ? s('promotion') : undefined }));
      case 'resign':
        return json(await arena.resign(s('gameId')));
      case 'offer_draw':
        return json(await arena.offerDraw(s('gameId')));
      case 'respond_draw':
        return json(await arena.respondDraw(s('gameId'), body.accept === true));
      case 'claim':
        return json(await arena.claim(s('gameId')));
      case 'sync':
        return json({ state: await arena.sync(s('gameId')) });
      case 'buy':
        return json(await arena.buy(s('itemId')));
      case 'equip':
        return json(await arena.equip(s('itemId')));
      case 'daily':
        return json(await arena.daily());
      case 'ai_result':
        return json(await arena.aiResult(Number(body.level), Number(body.score)));
      case 'purchase':
        return json(await arena.purchase(body));
      case 'me':
        return json({ user: await arena.me() });
      default:
        return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof UserError || e instanceof PurchaseError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Erro no servidor. Tente de novo.' }, 500);
  }
});

import type { RealtimeChannel } from '@supabase/supabase-js';
import { TIME_CONTROLS } from './timeControls';
import { arena, presenceOf, publicUser, setPresenceMap, supabase, type ProfileRow } from './supabase';
import { toNotification } from './supabaseApi';
import type { Ack, GameOver, GameState, Invite } from './types';

type Listener = (...args: any[]) => void;

const getTimeControl = (id: string) => TIME_CONTROLS.find((t) => t.id === id);

/**
 * Substitui o socket.io quando o servidor é o Supabase. Fala a mesma "língua" de eventos que as
 * telas já usam (game:start, game:state, game:over, invite:received, notification:new...),
 * alimentada pelo Realtime do Supabase, e atende os mesmos pedidos (emit) pela função "arena".
 */
export class SupabaseLink {
  connected = false;
  private listeners = new Map<string, Set<Listener>>();
  private channels: RealtimeChannel[] = [];
  private presenceChannel: RealtimeChannel | null = null;
  private unread = 0;
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  private queueTc: string | null = null;
  private claimTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private inviteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeGameId: string | null = null;
  private profiles = new Map<string, ProfileRow>();
  private closed = false;
  /** O mesmo evento chega pela resposta da função e pelo Realtime: entrega só uma vez. */
  private started = new Set<string>();
  private finished = new Set<string>();
  private lastPly = new Map<string, number>();
  /** Último estado de partida recebido (para a rede de segurança abaixo). */
  private lastGameUpdate = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private watchTick = 0;

  private me = '';

  constructor() {
    this.start().catch(() => this.fire('disconnect'));
  }

  // ---------------------------------------------------------------- API parecida com a do socket.io

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return this;
  }

  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }

  removeAllListeners() {
    this.listeners.clear();
    return this;
  }

  disconnect() {
    this.closed = true;
    this.connected = false;
    this.stopQueue();
    if (this.watchdog) clearInterval(this.watchdog);
    for (const t of [...this.claimTimers.values(), ...this.inviteTimers.values()]) clearTimeout(t);
    const sb = supabase();
    for (const ch of this.channels) sb.removeChannel(ch);
    if (this.presenceChannel) sb.removeChannel(this.presenceChannel);
    this.channels = [];
    return this;
  }

  timeout(_ms: number) {
    return {
      emit: (event: string, payload: any, cb: (err: Error | null, res: Ack) => void) => {
        this.handle(event, payload ?? {})
          .then((r) => cb(null, r))
          .catch((e: Error) => cb(null, { error: e.message }));
      },
    };
  }

  private fire(event: string, ...args: unknown[]) {
    for (const fn of this.listeners.get(event) ?? []) fn(...args);
  }

  /** Eventos de partida sem repetição e sem voltar no tempo (Realtime pode chegar depois da resposta). */
  private fireGame(kind: 'start' | 'state' | 'over', state: GameState | GameOver) {
    const id = state.id;
    if (kind === 'start') {
      if (this.started.has(id)) return;
      this.started.add(id);
    } else if (kind === 'over') {
      if (this.finished.has(id)) return;
      this.finished.add(id);
    } else {
      if (this.finished.has(id)) return;
      const ply = state.moves.length;
      const prev = this.lastPly.get(id) ?? -1;
      if (ply < prev) return;
      this.lastPly.set(id, ply);
    }
    this.lastGameUpdate = Date.now();
    this.fire(`game:${kind}`, state);
  }

  /**
   * Rede de segurança caso um aviso ao vivo se perca (rede ruim, aparelho em segundo plano):
   * durante a partida, sem novidade há 4 s, pergunta o estado ao servidor; a cada 12 s confere
   * convites recebidos.
   */
  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(async () => {
      if (this.closed) return;
      this.watchTick++;
      const id = this.activeGameId;
      if (id && Date.now() - this.lastGameUpdate > 4000) {
        this.lastGameUpdate = Date.now();
        try {
          const r = await arena<{ state: GameState | GameOver }>('sync', { gameId: id });
          if ('reason' in r.state && r.state.reason) {
            this.untrackGame(id);
            this.fireGame('over', r.state);
          } else {
            this.fireGame('state', r.state as GameState);
          }
        } catch {
          // sem conexão agora: tenta no próximo ciclo
        }
      }
      if (this.watchTick % 3 === 0) {
        const { data } = await supabase()
          .from('invites')
          .select('*')
          .eq('to_id', this.me)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString());
        for (const row of (data ?? []) as any[]) if (!this.inviteTimers.has(row.id)) await this.onInvite(row);
      }
    }, 4000);
  }

  // ---------------------------------------------------------------- conexão e eventos ao vivo

  private async start() {
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    if (!data.session || this.closed) return;
    // O Realtime usa o mesmo login (para as permissões das tabelas valerem).
    sb.realtime.setAuth(data.session.access_token);
    this.me = data.session.user.id;
    const me = this.me;
    const games = sb
      .channel(`games-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `white_id=eq.${me}` }, (p) => this.onGame(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `black_id=eq.${me}` }, (p) => this.onGame(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites', filter: `to_id=eq.${me}` }, (p) => this.onInvite(p.new as any))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'invites', filter: `from_id=eq.${me}` }, (p) => this.onInvite(p.new as any))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${me}` }, () => this.fire('friends:changed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${me}` }, () => this.fire('friends:changed'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, (p) => {
        this.unread += 1;
        this.fire('notification:new', { notification: toNotification(p.new), unread: this.unread });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${me}` }, () => this.fire('wallet:changed'))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.connected = true;
          this.fire('connect');
          this.startWatchdog();
          await this.sendSession();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (this.connected) {
            this.connected = false;
            this.fire('disconnect');
          }
        }
      });
    this.channels.push(games);
    this.joinPresence();
  }

  /** Estado inicial: partida em andamento, convites pendentes e notificações não lidas. */
  private async sendSession() {
    const sb = supabase();
    const [session, inv, unread] = await Promise.all([
      arena<{ activeGame: GameState | null }>('session').catch(() => ({ activeGame: null })),
      sb.from('invites').select('*').eq('to_id', this.me).eq('status', 'pending').gt('expires_at', new Date().toISOString()),
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    ]);
    this.unread = unread.count ?? 0;
    const invites = (await Promise.all(((inv.data ?? []) as any[]).map((r) => this.toInvite(r)))).filter(Boolean) as Invite[];
    for (const i of invites) this.scheduleInviteExpiry(i);
    if (session.activeGame) this.trackGame(session.activeGame);
    this.fire('session', { activeGame: session.activeGame, invites, unreadNotifications: this.unread });
  }

  private onGame(p: { eventType: string; new: any }) {
    const row = p.new;
    if (!row?.state) return;
    const state = row.state as GameState | GameOver;
    if (p.eventType === 'INSERT') {
      this.stopQueue();
      this.trackGame(state);
      this.fireGame('start', state);
      return;
    }
    if (row.status === 'over') {
      this.untrackGame(row.id);
      this.fireGame('over', state);
    } else {
      this.trackGame(state);
      this.fireGame('state', state);
    }
  }

  // ---------------------------------------------------------------- relógio: pede ao servidor para conferir o tempo

  /**
   * O servidor não tem relógio rodando sozinho: quando o tempo de quem joga acaba (ou o primeiro
   * lance não vem em 30 s), os aparelhos pedem a conferência e o servidor encerra a partida.
   */
  private trackGame(state: GameState) {
    this.activeGameId = state.id;
    this.updatePresence();
    const old = this.claimTimers.get(state.id);
    if (old) clearTimeout(old);
    const turnKey = state.turn === 'w' ? 'white' : 'black';
    const wait = state.clocksRunning ? state.clocks[turnKey] + 400 : 30_500;
    const t = setTimeout(() => {
      arena<{ ok: boolean; state: GameState | GameOver }>('claim', { gameId: state.id })
        .then((r) => {
          if (!r.ok && r.state && !('reason' in r.state)) this.trackGame(r.state);
        })
        .catch(() => {});
    }, Math.max(500, wait));
    this.claimTimers.set(state.id, t);
  }

  private untrackGame(id: string) {
    const t = this.claimTimers.get(id);
    if (t) clearTimeout(t);
    this.claimTimers.delete(id);
    if (this.activeGameId === id) this.activeGameId = null;
    this.updatePresence();
  }

  // ---------------------------------------------------------------- convites

  private async profile(id: string) {
    const cached = this.profiles.get(id);
    if (cached) return cached;
    const { data } = await supabase().from('profiles').select('*').eq('id', id).maybeSingle();
    if (data) this.profiles.set(id, data as ProfileRow);
    return (data as ProfileRow) ?? null;
  }

  private async toInvite(r: any): Promise<Invite | null> {
    const [from, to] = await Promise.all([this.profile(r.from_id), this.profile(r.to_id)]);
    const tc = getTimeControl(r.time_control);
    if (!from || !to || !tc) return null;
    return {
      id: r.id,
      from: publicUser(from),
      to: publicUser(to),
      timeControl: tc,
      rated: r.rated,
      color: r.color,
      createdAt: Date.parse(r.created_at),
      expiresAt: Date.parse(r.expires_at),
    };
  }

  private scheduleInviteExpiry(inv: Invite) {
    const t = setTimeout(() => this.fire('invite:expired', inv), Math.max(0, inv.expiresAt - Date.now()));
    this.inviteTimers.set(inv.id, t);
  }

  private async onInvite(row: any) {
    if (!row) return;
    const inv = await this.toInvite(row);
    if (!inv) return;
    const t = this.inviteTimers.get(inv.id);
    if (row.status === 'pending' && row.to_id === this.me) {
      if (!t && inv.expiresAt > Date.now()) {
        this.scheduleInviteExpiry(inv);
        this.fire('invite:received', inv);
      }
      return;
    }
    if (t) clearTimeout(t);
    this.inviteTimers.delete(inv.id);
    if (row.status === 'declined') this.fire('invite:declined', inv);
    else if (row.status === 'cancelled') this.fire('invite:cancelled', inv);
    else if (row.status === 'accepted' && row.to_id === this.me) this.fire('invite:cancelled', { ...inv, to: { ...inv.to, id: '' } });
  }

  // ---------------------------------------------------------------- presença (amigos online)

  private joinPresence() {
    const ch = supabase().channel('online', { config: { presence: { key: this.me } } });
    const sync = () => {
      const state = ch.presenceState<{ inGame?: boolean }>();
      const before = new Set(Object.keys(state));
      const map: Record<string, { online: boolean; inGame: boolean }> = {};
      for (const [id, metas] of Object.entries(state)) map[id] = { online: true, inGame: metas.some((m) => m.inGame) };
      // Quem saiu: avisa como offline (amigos e adversário da partida).
      for (const id of Object.keys(lastPresence)) {
        if (!before.has(id)) {
          this.fire('friends:presence', { userId: id, online: false, inGame: false });
          // Só avisa "desconectado" se a pessoa continuar fora por 5 s (atualizar o status ou uma
          // queda rápida de rede fazem ela sair e voltar em seguida).
          if (!offlineTimers.has(id)) {
            offlineTimers.set(
              id,
              setTimeout(() => {
                offlineTimers.delete(id);
                if (!lastPresence[id]) this.fire('game:opponentConnection', { userId: id, connected: false });
              }, 5000),
            );
          }
        }
      }
      for (const id of before) {
        const t = offlineTimers.get(id);
        if (t) {
          clearTimeout(t);
          offlineTimers.delete(id);
        }
        if (!lastPresence[id]) this.fire('game:opponentConnection', { userId: id, connected: true });
      }
      for (const [id, s] of Object.entries(map)) {
        const prev = lastPresence[id];
        if (!prev || prev.inGame !== s.inGame) this.fire('friends:presence', { userId: id, ...s });
      }
      // Adversário caiu ou voltou durante a partida
      lastPresence = map;
      setPresenceMap(map);
    };
    let lastPresence: Record<string, { online: boolean; inGame: boolean }> = {};
    const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Usa só o estado completo ("sync"): atualizar o próprio status gera "saiu"+"entrou" seguidos,
    // que fora de ordem marcariam o adversário como desconectado sem estar.
    ch.on('presence', { event: 'sync' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') this.updatePresence();
      });
    this.presenceChannel = ch;
  }

  private updatePresence() {
    if (this.closed || !this.presenceChannel) return;
    this.presenceChannel.track({ inGame: !!this.activeGameId }).catch(() => {});
  }

  // ---------------------------------------------------------------- fila

  private stopQueue() {
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
    this.queueTc = null;
  }

  /** Consulta a fila a cada 3 s (a faixa de rating aceita cresce com a espera). */
  private async pollQueue() {
    if (!this.queueTc || this.closed) return;
    try {
      const r = await arena<{ matched: boolean; state?: GameState; status?: unknown }>('queue', { timeControl: this.queueTc });
      if (r.matched && r.state) {
        this.stopQueue();
        // A partida também chega pelo Realtime; o app ignora o evento repetido.
        this.trackGame(r.state);
        this.fireGame('start', r.state);
        return;
      }
      this.fire('queue:status', r.status);
    } catch {
      // erro momentâneo: tenta de novo no próximo ciclo
    }
    if (this.queueTc) this.queueTimer = setTimeout(() => this.pollQueue(), 3000);
  }

  // ---------------------------------------------------------------- pedidos das telas (emit)

  private async handle(event: string, p: any): Promise<Ack> {
    const sb = supabase();
    switch (event) {
      case 'queue:join': {
        this.stopQueue();
        this.queueTc = String(p.timeControl);
        const first = await arena<{ matched: boolean; state?: GameState; status?: unknown }>('queue', { timeControl: this.queueTc });
        if (first.matched && first.state) {
          this.stopQueue();
          this.trackGame(first.state);
          this.fireGame('start', first.state);
        } else {
          this.fire('queue:status', first.status);
          this.queueTimer = setTimeout(() => this.pollQueue(), 3000);
        }
        return { ok: true };
      }
      case 'queue:leave':
        this.stopQueue();
        await arena('queue_leave').catch(() => {});
        return { ok: true };
      case 'invite:send': {
        const { data, error } = await sb.rpc('send_invite', {
          p_to: p.toUserId,
          p_time_control: p.timeControl,
          p_rated: !!p.rated,
          p_color: p.color ?? 'random',
        });
        if (error) return { error: error.message };
        if (!presenceOf(p.toUserId).online) {
          // Convite enviado mesmo assim; avisa que o amigo pode não ver agora.
          return { ok: true, invite: await this.toInvite(data), warning: 'offline' };
        }
        return { ok: true, invite: await this.toInvite(data) };
      }
      case 'invite:accept': {
        const r = await arena<{ gameId: string; state: GameState }>('invite_accept', { inviteId: p.inviteId });
        this.trackGame(r.state);
        this.fireGame('start', r.state);
        return { ok: true, gameId: r.gameId };
      }
      case 'invite:decline': {
        const { data } = await sb.from('invites').select('from_id').eq('id', p.inviteId).maybeSingle();
        const action = data?.from_id === this.me ? 'cancel' : 'decline';
        const { error } = await sb.rpc('respond_invite', { p_invite: p.inviteId, p_action: action });
        return error ? { error: error.message } : { ok: true };
      }
      case 'game:sync': {
        const r = await arena<{ state: GameState | GameOver }>('sync', { gameId: p.gameId });
        if (!('reason' in r.state)) this.trackGame(r.state);
        return { ok: true, state: r.state };
      }
      case 'game:move':
        return this.gameAction('move', { gameId: p.gameId, from: p.from, to: p.to, promotion: p.promotion });
      case 'game:resign':
        return this.gameAction('resign', { gameId: p.gameId });
      case 'game:offerDraw':
        return this.gameAction('offer_draw', { gameId: p.gameId });
      case 'game:respondDraw':
        return this.gameAction('respond_draw', { gameId: p.gameId, accept: !!p.accept });
      default:
        return { error: 'Ação não suportada.' };
    }
  }

  /** Ações de partida: a resposta já traz o estado novo (a tela atualiza sem esperar o Realtime). */
  private async gameAction(action: string, body: Record<string, unknown>): Promise<Ack> {
    const r = await arena<{ ok: boolean; state: GameState | GameOver }>(action, body);
    if (r.state) {
      if ('reason' in r.state && r.state.reason) {
        this.untrackGame(r.state.id);
        this.fireGame('over', r.state);
      } else {
        this.trackGame(r.state as GameState);
        this.fireGame('state', r.state as GameState);
      }
    }
    return { ok: true };
  }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import { api, getServerUrl, isLocalMode, usingSupabase } from './api';
import { SupabaseLink } from './supabaseLink';
import { localEvents } from './localDevice';
import { useAuth } from './auth';
import { translateServerText, tStatic } from './i18n';
import { useToast } from './toast';
import type { Ack, AppNotification, GameOver, GameState, Invite } from './types';

export interface QueueStatus {
  timeControl: string;
  waitedMs: number;
  range: number;
  playersSearching: number;
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  emit: (event: string, payload?: unknown) => Promise<Ack>;
  invites: Invite[];
  activeGame: GameState | null;
  /** Último estado conhecido de cada partida (para abrir a tela sem esperar). */
  gameCache: Map<string, GameState | GameOver>;
  queueStatus: QueueStatus | null;
  setQueueStatus: (s: QueueStatus | null) => void;
  presence: Record<string, { online: boolean; inGame: boolean }>;
  /** Muda sempre que a lista de amigos muda no servidor. */
  friendsVersion: number;
  unreadNotifications: number;
  setUnreadNotifications: (n: number) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user, refresh } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [presence, setPresence] = useState<SocketContextValue['presence']>({});
  const [friendsVersion, setFriendsVersion] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const gameCache = useRef(new Map<string, GameState | GameOver>()).current;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      setInvites([]);
      setActiveGame(null);
      setUnreadNotifications(0);
      return;
    }
    // Modo local (sem servidor): não há socket; as notificações vêm do servidor local do aparelho.
    if (isLocalMode()) {
      setSocket(null);
      setConnected(false);
      api<{ unread: number }>('/notifications')
        .then((r) => setUnreadNotifications(r.unread))
        .catch(() => {});
      return localEvents.onNotification(({ notification, unread }) => {
        setUnreadNotifications(unread);
        if (notification.type !== 'game_result' && notification.type !== 'reward') toast(`🔔 ${translateServerText(notification.title)}`, 'success');
      });
    }
    // Supabase: eventos ao vivo pelo Realtime, no mesmo formato do socket.io.
    const s = usingSupabase()
      ? (new SupabaseLink() as unknown as Socket)
      : io(getServerUrl(), { auth: { token }, transports: ['websocket'] });
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('session', ({ activeGame, invites, unreadNotifications }: { activeGame: GameState | null; invites: Invite[]; unreadNotifications: number }) => {
      setInvites(invites);
      setUnreadNotifications(unreadNotifications ?? 0);
      setActiveGame(activeGame);
      if (activeGame) gameCache.set(activeGame.id, activeGame);
    });

    s.on('game:start', (state: GameState) => {
      gameCache.set(state.id, state);
      setActiveGame(state);
      setQueueStatus(null);
      setInvites([]);
      router.push(`/game/${state.id}`);
    });
    s.on('game:state', (state: GameState) => gameCache.set(state.id, state));
    s.on('game:over', (state: GameOver) => {
      gameCache.set(state.id, state);
      setActiveGame((g) => (g?.id === state.id ? null : g));
      refresh();
    });

    s.on('queue:status', setQueueStatus);

    const removeInvite = (inv: Invite) => setInvites((list) => list.filter((i) => i.id !== inv.id));
    s.on('invite:received', (inv: Invite) => {
      setInvites((list) => [...list.filter((i) => i.id !== inv.id), inv]);
    });
    s.on('invite:declined', (inv: Invite) => {
      removeInvite(inv);
      toast(tStatic('socket.inviteDeclined', { name: inv.to.username }));
    });
    s.on('invite:cancelled', (inv: Invite) => {
      removeInvite(inv);
      if (inv.to.id === userRef.current?.id) toast(tStatic('socket.inviteCancelled', { name: inv.from.username }));
    });
    s.on('invite:expired', (inv: Invite) => {
      removeInvite(inv);
      if (inv.from.id === userRef.current?.id) toast(tStatic('socket.inviteExpired', { name: inv.to.username }));
    });

    s.on('friends:changed', () => setFriendsVersion((v) => v + 1));
    // Notificações: contador do sininho + aviso rápido na tela.
    s.on('notification:new', ({ notification, unread }: { notification: AppNotification; unread: number }) => {
      setUnreadNotifications(unread);
      // Resultado de partida já aparece na tela do jogo.
      // Resultado de partida e bônus já têm aviso na própria tela.
      if (notification.type !== 'game_result' && notification.type !== 'reward') toast(`🔔 ${translateServerText(notification.title)}`, 'success');
    });
    // Moedas/inventário mudaram (fim de partida, bônus): recarrega o perfil.
    s.on('wallet:changed', () => refresh());
    s.on('friends:presence', ({ userId, online, inGame }: { userId: string; online: boolean; inGame: boolean }) =>
      setPresence((p) => ({ ...p, [userId]: { online, inGame } })),
    );

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [token, gameCache, refresh, toast]);

  const emit = useCallback(
    (event: string, payload: unknown = {}) =>
      new Promise<Ack>((resolve) => {
        if (!socket?.connected) {
          resolve({ error: 'Sem conexão com o servidor.' });
          return;
        }
        socket.timeout(8000).emit(event, payload, (err: Error | null, res: Ack) => {
          resolve(err ? { error: 'O servidor não respondeu.' } : res);
        });
      }),
    [socket],
  );

  const value = useMemo(
    () => ({
      socket,
      connected,
      emit,
      invites,
      activeGame,
      gameCache,
      queueStatus,
      setQueueStatus,
      presence,
      friendsVersion,
      unreadNotifications,
      setUnreadNotifications,
    }),
    [socket, connected, emit, invites, activeGame, gameCache, queueStatus, presence, friendsVersion, unreadNotifications],
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket precisa estar dentro de <SocketProvider>');
  return ctx;
}

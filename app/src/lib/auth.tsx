import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, loadServerUrl, setAuthToken, usingSupabase } from './api';
import { supabase } from './supabase';
import { secureStorage } from './secureStorage';
import type { PrivateUser } from './types';

const TOKEN_KEY = 'xadrez.token';

interface AuthContextValue {
  ready: boolean;
  token: string | null;
  user: PrivateUser | null;
  rank: number | null;
  /** Atualiza o usuário com a resposta de uma compra/resgate. */
  setUser: (u: PrivateUser) => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PrivateUser | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const applySession = useCallback(async (t: string | null, u: PrivateUser | null) => {
    setAuthToken(t);
    setToken(t);
    setUser(u);
    if (t) await secureStorage.set(TOKEN_KEY, t);
    else await secureStorage.remove(TOKEN_KEY);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: PrivateUser; rank: number | null }>('/me');
      setUser(me.user);
      setRank(me.rank);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await applySession(null, null);
    }
  }, [applySession]);

  useEffect(() => {
    (async () => {
      try {
        await loadServerUrl();
        // Supabase guarda e renova a sessão sozinho; os outros servidores usam o token salvo.
        const saved = usingSupabase()
          ? ((await supabase().auth.getSession()).data.session?.access_token ?? null)
          : await secureStorage.get(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          setToken(saved);
          try {
            const me = await api<{ user: PrivateUser; rank: number | null }>('/me');
            setUser(me.user);
            setRank(me.rank);
          } catch (e) {
            // Token inválido: sai. Servidor fora do ar: mantém a sessão para tentar depois.
            if (e instanceof ApiError && e.status === 401) await applySession(null, null);
          }
        }
      } catch {
        // Armazenamento indisponível: abre o app sem sessão em vez de ficar carregando.
      } finally {
        setReady(true);
      }
    })();
  }, [applySession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await api<{ token: string; user: PrivateUser }>('/auth/login', { body: { username, password } });
      await applySession(r.token, r.user);
      refresh();
    },
    [applySession, refresh],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const r = await api<{ token: string; user: PrivateUser }>('/auth/register', { body: { username, password } });
      await applySession(r.token, r.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    if (usingSupabase()) await supabase().auth.signOut().catch(() => {});
    await applySession(null, null);
  }, [applySession]);

  const value = useMemo(
    () => ({ ready, token, user, rank, setUser, login, register, logout, refresh }),
    [ready, token, user, rank, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

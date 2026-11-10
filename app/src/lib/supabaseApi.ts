import { ApiError } from './apiError';
import { CATALOG } from './catalog';
import { arena, dbError, deviceCountry, emailFor, presenceOf, publicUser, supabase, type ProfileRow } from './supabase';
import type { AppNotification, FriendEntry, FriendshipStatus, GameSummary, PrivateUser } from './types';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Mesmas rotas do servidor antigo (/auth/login, /me, /friends, /shop/buy...), atendidas pelo
 * Supabase. Assim as telas do app funcionam igual com qualquer servidor.
 */
export async function supabaseApi<T = any>(path: string, method: string, body: any): Promise<T> {
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const sb = supabase();

  // ---- contas
  if (method === 'POST' && route === '/auth/register') {
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!USERNAME_RE.test(username)) throw new ApiError('Nome de usuário deve ter 3 a 20 letras, números ou _.', 400);
    if (password.length < 8 || password.length > 128) throw new ApiError('A senha precisa ter de 8 a 128 caracteres.', 400);
    const { data: free, error: e1 } = await sb.rpc('username_available', { p_username: username });
    dbError(e1);
    if (!free) throw new ApiError('Esse nome de usuário já existe.', 409);
    const country = typeof body?.country === 'string' ? body.country : deviceCountry();
    const { data, error } = await sb.auth.signUp({ email: emailFor(username), password, options: { data: { username, country } } });
    if (error) throw new ApiError(/registered|exists/i.test(error.message) ? 'Esse nome de usuário já existe.' : error.message, 400);
    if (!data.session) throw new ApiError('Conta criada, mas o servidor pediu confirmação de e-mail. Desligue "Confirm email" no Supabase.', 400);
    const me = await arena<{ user: PrivateUser }>('me');
    return { token: data.session.access_token, user: me.user } as T;
  }
  if (method === 'POST' && route === '/auth/login') {
    const { data, error } = await sb.auth.signInWithPassword({ email: emailFor(String(body?.username ?? '')), password: String(body?.password ?? '') });
    if (error || !data.session) {
      if (error && /fetch|network/i.test(error.message)) throw new ApiError('Não foi possível conectar ao servidor.', 0);
      throw new ApiError('Usuário ou senha incorretos.', 401);
    }
    const me = await arena<{ user: PrivateUser }>('me');
    return { token: data.session.access_token, user: me.user } as T;
  }
  if (method === 'POST' && route === '/auth/logout-all') {
    await sb.auth.signOut({ scope: 'global' });
    return { ok: true } as T;
  }

  const { data: sess } = await sb.auth.getSession();
  const me = sess.session?.user.id;
  if (!me) throw new ApiError('Sessão expirada. Entre novamente.', 401);

  if (method === 'GET' && route === '/me') {
    const [r, rank, unread] = await Promise.all([
      arena<{ user: PrivateUser }>('me'),
      sb.rpc('my_rank'),
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    ]);
    return { user: r.user, rank: rank.data ?? null, unreadNotifications: unread.count ?? 0 } as T;
  }
  if (method === 'POST' && route === '/me/country') {
    dbError((await sb.rpc('set_country', { p_country: body?.country ?? null })).error);
    return (await arena('me')) as T;
  }

  // ---- jogadores
  if (method === 'GET' && route === '/users/search') {
    const q = (params.get('q') ?? '').trim();
    if (q.length < 2) return { users: [] } as T;
    const { data, error } = await sb.from('profiles').select('*').ilike('username', `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`).neq('id', me).limit(20);
    dbError(error);
    const status = await friendshipMap(me);
    return { users: (data as ProfileRow[]).map((p) => ({ ...publicUser(p), friendship: status.get(p.id) ?? { status: 'none' } })) } as T;
  }
  if (method === 'GET' && route.startsWith('/users/')) {
    const id = route.slice('/users/'.length);
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
    dbError(error);
    if (!p) throw new ApiError('Jogador não encontrado.', 404);
    const [rank, games, status] = await Promise.all([rankOf(p as ProfileRow), gamesOf(id), friendshipMap(me)]);
    return {
      user: publicUser(p as ProfileRow),
      rank,
      ...presenceOf(id),
      friendship: status.get(id) ?? { status: 'none' },
      games,
    } as T;
  }
  if (method === 'GET' && route === '/leaderboard') {
    const { data, error } = await sb.from('profiles').select('*').gt('games_played', 0).order('rating', { ascending: false }).limit(100);
    dbError(error);
    return { players: (data as ProfileRow[]).map((p, i) => ({ rank: i + 1, ...publicUser(p), online: presenceOf(p.id).online })) } as T;
  }

  // ---- amigos
  if (method === 'GET' && route === '/friends') {
    const { data, error } = await sb
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)');
    dbError(error);
    const friends: FriendEntry[] = [];
    const incoming: FriendEntry[] = [];
    const outgoing: FriendEntry[] = [];
    for (const f of data as any[]) {
      const mine = f.requester_id === me;
      const other = (mine ? f.addressee : f.requester) as ProfileRow;
      const entry = { requestId: f.id, user: publicUser(other), ...presenceOf(other.id), since: Date.parse(f.created_at) };
      if (f.status === 'accepted') friends.push(entry);
      else if (mine) outgoing.push(entry);
      else incoming.push(entry);
    }
    friends.sort((a, b) => Number(b.online) - Number(a.online) || b.user.rating - a.user.rating);
    return { friends, incoming, outgoing } as T;
  }
  if (method === 'POST' && route === '/friends/requests') {
    let username = body?.username as string | undefined;
    if (!username && body?.userId) {
      const { data } = await sb.from('profiles').select('username').eq('id', body.userId).maybeSingle();
      username = data?.username;
    }
    const { data, error } = await sb.rpc('send_friend_request', { p_username: String(username ?? '') });
    dbError(error);
    return { status: (data as { status: string }).status === 'accepted' ? 'friends' : 'outgoing' } as T;
  }
  const accept = /^\/friends\/requests\/([^/]+)\/accept$/.exec(route);
  if (method === 'POST' && accept) {
    dbError((await sb.rpc('accept_friend_request', { p_request: accept[1] })).error);
    return { status: 'friends', id: accept[1] } as T;
  }
  const del = /^\/friends\/requests\/([^/]+)$/.exec(route);
  if (method === 'DELETE' && del) {
    dbError((await sb.rpc('remove_friendship', { p_request: del[1] })).error);
    return { status: 'none' } as T;
  }

  // ---- loja, recompensas e IA
  if (method === 'GET' && route === '/shop/catalog') return { items: CATALOG } as T;
  if (method === 'POST' && route === '/shop/buy') return arena<T>('buy', { itemId: body?.itemId });
  if (method === 'POST' && route === '/shop/equip') return arena<T>('equip', { itemId: body?.itemId });
  if (method === 'POST' && route === '/rewards/daily') return arena<T>('daily');
  if (method === 'POST' && route === '/ai/result') return arena<T>('ai_result', { level: body?.level, score: body?.score });
  if (method === 'POST' && route === '/shop/purchase') return arena<T>('purchase', body ?? {});

  // ---- notificações
  if (method === 'GET' && route === '/notifications') {
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    dbError(error);
    const notifications: AppNotification[] = (data as any[]).map(toNotification);
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false);
    return { notifications, unread: count ?? 0 } as T;
  }
  if (method === 'POST' && route === '/notifications/read') {
    dbError((await sb.rpc('mark_notifications_read')).error);
    return { ok: true } as T;
  }

  throw new ApiError('Recurso não encontrado.', 404);
}

export function toNotification(n: any): AppNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? {},
    read: n.read,
    createdAt: Date.parse(n.created_at),
  };
}

async function friendshipMap(me: string) {
  const { data } = await supabase().from('friendships').select('*');
  const map = new Map<string, FriendshipStatus>();
  for (const f of (data ?? []) as any[]) {
    const other = f.requester_id === me ? f.addressee_id : f.requester_id;
    map.set(other, f.status === 'accepted' ? { status: 'friends', id: f.id } : { status: f.requester_id === me ? 'outgoing' : 'incoming', id: f.id });
  }
  return map;
}

async function rankOf(p: ProfileRow) {
  if (!p.games_played) return null;
  const { count } = await supabase().from('profiles').select('id', { count: 'exact', head: true }).gt('rating', p.rating).gt('games_played', 0);
  return (count ?? 0) + 1;
}

async function gamesOf(userId: string): Promise<GameSummary[]> {
  const { data } = await supabase()
    .from('games')
    .select('id, white_id, black_id, result, reason, rated, time_control, ended_at, state')
    .eq('status', 'over')
    .not('result', 'is', null)
    .or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .order('ended_at', { ascending: false })
    .limit(20);
  return ((data ?? []) as any[]).map((g) => {
    const isWhite = g.white_id === userId;
    const st = g.state ?? {};
    return {
      id: g.id,
      color: isWhite ? 'white' : 'black',
      opponent: (isWhite ? st.black : st.white) ?? null,
      result: g.result,
      outcome: g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === isWhite ? 'win' : 'loss',
      reason: g.reason,
      rated: g.rated,
      timeControl: g.time_control,
      ratingChange: (isWhite ? st.ratingChanges?.white : st.ratingChanges?.black) ?? 0,
      endedAt: Date.parse(g.ended_at),
    };
  });
}

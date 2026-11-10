-- Xadrez Arena — servidor online no Supabase.
-- Regras de segurança:
--   * o app (chave "anon" + login do jogador) só LÊ dados permitidos pelas políticas (RLS);
--   * tudo que mexe em partida, rating, moedas ou itens passa pela função de borda "arena"
--     (que valida os lances com chess.js) ou por funções SQL "security definer" que conferem
--     quem está chamando (auth.uid()).

create extension if not exists citext;

-- ------------------------------------------------------------------ jogadores

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  country text check (country ~ '^[A-Z]{2}$'),
  rating int not null default 1000,
  peak_rating int not null default 1000,
  games_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  win_streak int not null default 0,
  best_streak int not null default 0,
  equipped jsonb not null default '{"board":"board_classic","pieces":"pieces_classic","avatar":"avatar_letter","character":"char_rookie","move":"move_jamal"}',
  created_at timestamptz not null default now()
);
create index profiles_rating_idx on public.profiles (rating desc);

-- Dados privados: só o dono vê.
create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  coins int not null default 300 check (coins >= 0),
  -- Itens grátis (mesma lista de DEFAULT_ITEMS do catálogo; um teste confere).
  inventory text[] not null default array['board_classic','pieces_classic','avatar_letter','char_rookie','move_jamal','move_67'],
  last_daily date,
  last_ai_reward timestamptz,
  ai_coins_today int not null default 0,
  ai_coins_day date
);

-- ------------------------------------------------------------------ partidas

create table public.games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references public.profiles (id) on delete cascade,
  black_id uuid not null references public.profiles (id) on delete cascade,
  time_control text not null,
  rated boolean not null default true,
  status text not null default 'active' check (status in ('active', 'over')),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text,
  -- Motor (só a função de borda escreve):
  pgn text not null default '',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  clock_w int not null,
  clock_b int not null,
  turn_started_at timestamptz not null default now(),
  draw_offer text check (draw_offer in ('w', 'b')),
  version int not null default 0,
  -- Estado pronto para o app (mesmo formato do servidor antigo: GameState / GameOver).
  state jsonb not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index games_white_active on public.games (white_id) where status = 'active';
create index games_black_active on public.games (black_id) where status = 'active';
create index games_white_recent on public.games (white_id, ended_at desc);
create index games_black_recent on public.games (black_id, ended_at desc);

-- Fila de partidas ranqueadas.
create table public.queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  time_control text not null,
  rating int not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  time_control text not null,
  rated boolean not null default false,
  color text not null default 'random' check (color in ('white', 'black', 'random')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 seconds'
);
create index invites_to_pending on public.invites (to_id) where status = 'pending';

-- ------------------------------------------------------------------ amigos e notificações

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- Compras com dinheiro real (Google Play / App Store), já conferidas pelo servidor.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  product_id text not null,
  item_id text not null,
  transaction_id text not null unique,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ permissões (RLS)

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.games enable row level security;
alter table public.queue enable row level security;
alter table public.invites enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;
alter table public.purchases enable row level security;

create policy "perfis são públicos" on public.profiles for select using (true);
create policy "só o dono vê a carteira" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "partidas são públicas" on public.games for select using (true);
create policy "só o dono vê a própria fila" on public.queue for select to authenticated using (user_id = auth.uid());
create policy "convites dos envolvidos" on public.invites for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "amizades dos envolvidos" on public.friendships for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "só o dono vê as notificações" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "só o dono vê as compras" on public.purchases for select to authenticated using (user_id = auth.uid());
-- Nenhuma política de insert/update/delete: o app não altera tabelas diretamente.

-- Tabelas acompanhadas ao vivo pelo app (Realtime). REPLICA IDENTITY FULL para os filtros
-- funcionarem também nas atualizações.
alter table public.games replica identity full;
alter table public.invites replica identity full;
alter table public.friendships replica identity full;
alter table public.notifications replica identity full;
alter table public.wallets replica identity full;
alter publication supabase_realtime add table public.games, public.invites, public.friendships, public.notifications, public.wallets;

-- ------------------------------------------------------------------ cadastro

-- Ao criar a conta (Supabase Auth), cria o perfil e a carteira. O nome de usuário e o país
-- vêm de raw_user_meta_data, enviados pelo app no cadastro.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := new.raw_user_meta_data ->> 'username';
  v_country text := upper(coalesce(new.raw_user_meta_data ->> 'country', ''));
begin
  if v_name is null or v_name !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Nome de usuário inválido.' using errcode = '22023';
  end if;
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  insert into public.profiles (id, username, country) values (new.id, v_name, v_country);
  insert into public.wallets (user_id) values (new.id);
  insert into public.notifications (user_id, type, title, body)
  values (new.id, 'welcome', 'Bem-vindo à Arena! ♞',
          'Você ganhou 300 moedas para gastar na loja. Boa sorte nas partidas!');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = p_username::citext)
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create function public.my_rank() returns int
language sql stable security definer set search_path = public as $$
  select case when p.games_played = 0 then null
    else (select count(*)::int + 1 from public.profiles o where o.rating > p.rating and o.games_played > 0) end
  from public.profiles p where p.id = auth.uid()
$$;
grant execute on function public.my_rank() to authenticated;

create function public.set_country(p_country text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_country is not null and upper(p_country) !~ '^[A-Z]{2}$' then
    raise exception 'País inválido.' using errcode = '22023';
  end if;
  update public.profiles set country = upper(p_country) where id = auth.uid();
end $$;
grant execute on function public.set_country(text) to authenticated;

-- ------------------------------------------------------------------ amizades

create function public.send_friend_request(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them public.profiles;
  existing public.friendships;
begin
  if me is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into them from public.profiles where username = p_username::citext;
  if not found then raise exception 'Jogador não encontrado.' using errcode = 'P0002'; end if;
  if them.id = me then raise exception 'Você não pode adicionar a si mesmo.' using errcode = '22023'; end if;
  select * into existing from public.friendships
   where least(requester_id, addressee_id) = least(me, them.id) and greatest(requester_id, addressee_id) = greatest(me, them.id);
  if found then
    if existing.status = 'accepted' then raise exception 'Vocês já são amigos.' using errcode = '23505'; end if;
    if existing.requester_id = me then raise exception 'Pedido já enviado.' using errcode = '23505'; end if;
    -- A outra pessoa já tinha pedido: aceita.
    update public.friendships set status = 'accepted' where id = existing.id;
    insert into public.notifications (user_id, type, title, body, data)
    select them.id, 'friend_accepted', p.username || ' aceitou seu pedido de amizade', 'Agora vocês podem se desafiar.', jsonb_build_object('userId', me)
      from public.profiles p where p.id = me;
    return jsonb_build_object('status', 'accepted');
  end if;
  insert into public.friendships (requester_id, addressee_id) values (me, them.id);
  insert into public.notifications (user_id, type, title, body, data)
  select them.id, 'friend_request', p.username || ' quer ser seu amigo', 'Abra Amigos para aceitar.', jsonb_build_object('userId', me)
    from public.profiles p where p.id = me;
  return jsonb_build_object('status', 'pending');
end $$;

create function public.accept_friend_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); fr public.friendships;
begin
  update public.friendships set status = 'accepted'
   where id = p_request and addressee_id = me and status = 'pending' returning * into fr;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  insert into public.notifications (user_id, type, title, body, data)
  select fr.requester_id, 'friend_accepted', p.username || ' aceitou seu pedido de amizade', 'Agora vocês podem se desafiar.', jsonb_build_object('userId', me)
    from public.profiles p where p.id = me;
end $$;

-- Recusa um pedido, cancela o seu pedido ou desfaz a amizade.
create function public.remove_friendship(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships where id = p_request and auth.uid() in (requester_id, addressee_id);
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
end $$;
grant execute on function public.send_friend_request(text), public.accept_friend_request(uuid), public.remove_friendship(uuid) to authenticated;

-- ------------------------------------------------------------------ convites (o aceite cria a partida na função "arena")

create function public.send_invite(p_to uuid, p_time_control text, p_rated boolean, p_color text) returns public.invites
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inv public.invites;
begin
  if me is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if p_time_control not in ('1+0', '3+0', '3+2', '5+0', '10+0', '15+10') then
    raise exception 'Ritmo de jogo inválido.' using errcode = '22023';
  end if;
  if p_color not in ('white', 'black', 'random') then p_color := 'random'; end if;
  if not exists (select 1 from public.friendships where status = 'accepted'
      and least(requester_id, addressee_id) = least(me, p_to) and greatest(requester_id, addressee_id) = greatest(me, p_to)) then
    raise exception 'Você só pode convidar amigos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.games where status = 'active' and me in (white_id, black_id)) then
    raise exception 'Termine sua partida atual primeiro.' using errcode = '55000';
  end if;
  update public.invites set status = 'cancelled' where from_id = me and status = 'pending';
  insert into public.invites (from_id, to_id, time_control, rated, color)
  values (me, p_to, p_time_control, coalesce(p_rated, false), p_color) returning * into inv;
  return inv;
end $$;

create function public.respond_invite(p_invite uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inv public.invites;
begin
  select * into inv from public.invites where id = p_invite and me in (from_id, to_id) and status = 'pending';
  if not found then raise exception 'Convite não encontrado ou expirado.' using errcode = 'P0002'; end if;
  if p_action = 'decline' and inv.to_id = me then
    update public.invites set status = 'declined' where id = p_invite;
  elsif p_action = 'cancel' and inv.from_id = me then
    update public.invites set status = 'cancelled' where id = p_invite;
  else
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
end $$;
grant execute on function public.send_invite(uuid, text, boolean, text), public.respond_invite(uuid, text) to authenticated;

-- ------------------------------------------------------------------ notificações

create function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read = true where user_id = auth.uid() and not read
$$;
grant execute on function public.mark_notifications_read() to authenticated;

-- ------------------------------------------------------------------ uso exclusivo da função "arena" (service role)

-- Fila: procura adversário com rating próximo; a faixa aceita cresce com a espera
-- (±100 + 25 por segundo, até ±800), como no servidor antigo.
create function public.mm_try_pair(p_user uuid, p_time_control text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.queue;
  r int;
  opp public.queue;
  waited_me int;
begin
  select rating into r from public.profiles where id = p_user;
  insert into public.queue (user_id, time_control, rating)
  values (p_user, p_time_control, r)
  on conflict (user_id) do update
    set time_control = excluded.time_control, rating = excluded.rating, seen_at = now(),
        joined_at = case when public.queue.time_control = excluded.time_control then public.queue.joined_at else now() end
  returning * into me;
  waited_me := extract(epoch from now() - me.joined_at)::int;
  -- Quem parou de consultar a fila há mais de 20 s saiu do app: não entra no pareamento.
  select q.* into opp from public.queue q
   where q.user_id <> p_user and q.time_control = p_time_control and q.seen_at > now() - interval '20 seconds'
     and abs(q.rating - me.rating) <= least(100 + waited_me * 25, 800)
     and abs(q.rating - me.rating) <= least(100 + extract(epoch from now() - q.joined_at)::int * 25, 800)
   order by abs(q.rating - me.rating), q.joined_at
   limit 1 for update skip locked;
  if not found then return null; end if;
  delete from public.queue where user_id in (p_user, opp.user_id);
  return opp.user_id;
end $$;

-- Encerra a partida e aplica rating, estatísticas, moedas e notificações numa transação só.
-- Os valores são calculados pela função "arena" (mesmas regras do servidor antigo).
create function public.finish_game(
  p_game uuid, p_version int, p_state jsonb, p_result text, p_reason text, p_pgn text, p_fen text,
  p_clock_w int, p_clock_b int, p_players jsonb, p_notifications jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare pl jsonb;
begin
  update public.games
     set status = 'over', result = p_result, reason = p_reason, state = p_state, pgn = p_pgn, fen = p_fen,
         clock_w = p_clock_w, clock_b = p_clock_b, draw_offer = null, ended_at = now(), version = version + 1
   where id = p_game and status = 'active' and version = p_version;
  if not found then return false; end if;
  for pl in select * from jsonb_array_elements(coalesce(p_players, '[]')) loop
    update public.profiles set
      rating = (pl ->> 'rating')::int,
      peak_rating = greatest(peak_rating, (pl ->> 'rating')::int),
      games_played = games_played + 1,
      wins = wins + (pl ->> 'win')::int,
      losses = losses + (pl ->> 'loss')::int,
      draws = draws + (pl ->> 'draw')::int,
      win_streak = (pl ->> 'winStreak')::int,
      best_streak = greatest(best_streak, (pl ->> 'winStreak')::int)
    where id = (pl ->> 'id')::uuid;
    update public.wallets set coins = coins + (pl ->> 'coins')::int where user_id = (pl ->> 'id')::uuid;
  end loop;
  insert into public.notifications (user_id, type, title, body, data)
  select (n ->> 'userId')::uuid, n ->> 'type', n ->> 'title', coalesce(n ->> 'body', ''), coalesce(n -> 'data', '{}')
    from jsonb_array_elements(coalesce(p_notifications, '[]')) n;
  return true;
end $$;

-- Gasta moedas e adiciona o item, de forma atômica (sem saldo negativo nem item duplicado).
create function public.buy_item(p_user uuid, p_item text, p_price int) returns int
language plpgsql security definer set search_path = public as $$
declare left_coins int;
begin
  update public.wallets set coins = coins - p_price, inventory = array_append(inventory, p_item)
   where user_id = p_user and coins >= p_price and not (p_item = any (inventory))
  returning coins into left_coins;
  return left_coins; -- null = sem saldo ou já tinha o item
end $$;

-- Concede um item comprado com dinheiro real (idempotente pelo transaction_id).
create function public.grant_purchase(p_user uuid, p_platform text, p_product text, p_item text, p_transaction text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.purchases (user_id, platform, product_id, item_id, transaction_id)
  values (p_user, p_platform, p_product, p_item, p_transaction)
  on conflict (transaction_id) do nothing;
  if not found then
    -- Já registrada (ex.: restaurar compras): só garante que o item continua com o dono original.
    return exists (select 1 from public.purchases where transaction_id = p_transaction and user_id = p_user);
  end if;
  update public.wallets set inventory = array_append(inventory, p_item)
   where user_id = p_user and not (p_item = any (inventory));
  return true;
end $$;

revoke execute on function public.mm_try_pair(uuid, text), public.finish_game(uuid, int, jsonb, text, text, text, text, int, int, jsonb, jsonb),
  public.buy_item(uuid, text, int), public.grant_purchase(uuid, text, text, text, text) from public, anon, authenticated;

-- Bônus diário (uma vez por dia, data UTC).
create function public.claim_daily(p_user uuid, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  update public.wallets set coins = coins + p_amount, last_daily = current_date
   where user_id = p_user and (last_daily is null or last_daily < current_date)
  returning coins into c;
  return c; -- null = já resgatado hoje
end $$;

-- Moedas por partida contra a IA (no modo online a IA não muda o rating): no máximo uma
-- recompensa a cada 30 s e um teto diário, porque o resultado vem do próprio aparelho.
create function public.ai_reward(p_user uuid, p_coins int, p_daily_cap int) returns int
language plpgsql security definer set search_path = public as $$
declare w public.wallets; granted int;
begin
  select * into w from public.wallets where user_id = p_user for update;
  if not found then return 0; end if;
  if w.last_ai_reward is not null and w.last_ai_reward > now() - interval '30 seconds' then return 0; end if;
  if w.ai_coins_day is distinct from current_date then w.ai_coins_today := 0; end if;
  granted := greatest(0, least(p_coins, p_daily_cap - w.ai_coins_today));
  update public.wallets set coins = coins + granted, last_ai_reward = now(),
         ai_coins_today = w.ai_coins_today + granted, ai_coins_day = current_date
   where user_id = p_user;
  return granted;
end $$;

-- Equipa um item que o jogador possui.
create function public.equip_item(p_user uuid, p_type text, p_item text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.wallets where user_id = p_user and p_item = any (inventory)) then return false; end if;
  update public.profiles set equipped = jsonb_set(equipped, array[p_type], to_jsonb(p_item)) where id = p_user;
  return true;
end $$;

revoke execute on function public.claim_daily(uuid, int), public.ai_reward(uuid, int, int), public.equip_item(uuid, text, text),
  public.handle_new_user() from public, anon, authenticated;

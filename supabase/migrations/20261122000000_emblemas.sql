-- Emblemas das IAs: um por IA vencida. O jogador escolhe um para mostrar (perfil e partidas).
-- A 1ª vitória contra cada IA também libera uma recompensa exclusiva (que a loja não vende).
-- O app só LÊ os perfis (RLS): quem grava é a função `arena`.
alter table public.profiles add column if not exists badges text[] not null default '{}';
alter table public.profiles add column if not exists badge text;

-- Concede o emblema e a recompensa da IA (só na 1ª vitória). Devolve true se o emblema é novo.
create function public.grant_ai_badge(p_user uuid, p_badge text, p_item text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = p_user and p_badge = any (badges)) then return false; end if;
  update public.profiles set badges = array_append(badges, p_badge), badge = coalesce(badge, p_badge) where id = p_user;
  if p_item is not null then
    update public.wallets set inventory = array_append(inventory, p_item)
     where user_id = p_user and not (p_item = any (inventory));
  end if;
  insert into public.notifications (user_id, type, title, body)
  values (p_user, 'reward', 'Novo emblema conquistado!', 'Você também liberou uma recompensa exclusiva. Veja no seu perfil.');
  return true;
end $$;

-- Escolhe o emblema que aparece (null = nenhum). Só vale um emblema já conquistado.
create function public.select_badge(p_user uuid, p_badge text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_badge is not null and not exists (select 1 from public.profiles where id = p_user and p_badge = any (badges)) then
    return false;
  end if;
  update public.profiles set badge = p_badge where id = p_user;
  return true;
end $$;

revoke execute on function public.grant_ai_badge(uuid, text, text), public.select_badge(uuid, text) from public, anon, authenticated;

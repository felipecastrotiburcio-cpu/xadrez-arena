-- Nova categoria da loja: surgimento das peças ("entrance"). O efeito grátis "Pop" passa a
-- fazer parte dos itens iniciais e fica equipado em todas as contas.

alter table public.profiles alter column equipped
  set default '{"board":"board_classic","pieces":"pieces_classic","avatar":"avatar_letter","character":"char_rookie","move":"move_jamal","entrance":"entrance_pop"}';
update public.profiles set equipped = equipped || '{"entrance":"entrance_pop"}' where not (equipped ? 'entrance');

alter table public.wallets alter column inventory
  set default array['board_classic','pieces_classic','avatar_letter','char_rookie','move_jamal','move_67','entrance_pop'];
update public.wallets set inventory = array_append(inventory, 'entrance_pop') where not ('entrance_pop' = any (inventory));

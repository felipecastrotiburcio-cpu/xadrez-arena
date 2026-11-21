-- Modo desenvolvedor (Configurações → senha): com ele ativo, a loja dá todos os itens de graça.
-- Fica na carteira, que o app só pode LER (RLS): só a função `arena` liga/desliga, depois de
-- conferir a senha.
alter table public.wallets add column if not exists dev_mode boolean not null default false;

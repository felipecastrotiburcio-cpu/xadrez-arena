import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync } from 'node:fs';
const db = new PGlite({ extensions: { citext } });
const stub = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create publication supabase_realtime;
grant usage on schema public, auth to anon, authenticated;
`;
await db.exec(stub);
await db.exec(readFileSync(process.argv[2], 'utf8'));
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (uid, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await q(sql, params); } finally { await db.exec('reset role;'); }
};
const ok = (c, m) => { if (!c) { console.error('❌', m); process.exitCode = 1; } else console.log('✅', m); };
const mk = async (name, country) => (await q(`insert into auth.users (raw_user_meta_data) values ($1) returning id`, [{ username: name, country }]))[0].id;
const a = await mk('Ana_1', 'br'), b = await mk('bob', 'US');
ok((await q(`select country from profiles where id=$1`, [a]))[0].country === 'BR', 'cadastro cria perfil com país');
ok((await q(`select coins, inventory from wallets where user_id=$1`, [a]))[0].coins === 300, 'carteira com 300 moedas');
try { await mk('a b', null); ok(false, 'nome inválido recusado'); } catch { ok(true, 'nome inválido recusado'); }
try { await mk('ANA_1', null); ok(false, 'nome repetido (maiúsculas) recusado'); } catch { ok(true, 'nome repetido (maiúsculas) recusado'); }
ok((await q(`select username_available('ana_1') v`))[0].v === false, 'username_available ignora maiúsculas');
// RLS
ok((await as(a, `select * from wallets`)).length === 1, 'RLS: vejo só a minha carteira');
ok((await as(b, `select * from notifications`)).every((n) => n.user_id === b), 'RLS: só minhas notificações');
try { await as(a, `update wallets set coins = 99999 where user_id = auth.uid()`); const c = (await q(`select coins from wallets where user_id=$1`, [a]))[0].coins; ok(c === 300, 'RLS: não consigo mudar minhas moedas'); } catch { ok(true, 'RLS: não consigo mudar minhas moedas'); }
// amizades e convites
ok((await as(a, `select send_friend_request('BOB') r`))[0].r.status === 'pending', 'pedido de amizade');
try { await as(a, `select send_invite($1,'5+0',false,'random')`, [b]); ok(false, 'convite só para amigos'); } catch (e) { ok(/amigos/.test(e.message), 'convite só para amigos'); }
const fr = (await as(b, `select id from friendships`))[0].id;
await as(b, `select accept_friend_request($1)`, [fr]);
ok((await q(`select status from friendships`))[0].status === 'accepted', 'amizade aceita');
const inv = (await as(a, `select * from send_invite($1,'5+0',false,'random')`, [b]))[0];
ok(inv.status === 'pending' && inv.to_id === b, 'convite enviado');
ok((await as(b, `select * from invites`)).length === 1, 'convidado vê o convite');
await as(b, `select respond_invite($1,'decline')`, [inv.id]);
ok((await q(`select status from invites where id=$1`, [inv.id]))[0].status === 'declined', 'convite recusado');
// fila
ok((await q(`select mm_try_pair($1,'5+0') o`, [a]))[0].o === null, 'fila: primeiro espera');
ok((await q(`select mm_try_pair($1,'5+0') o`, [b]))[0].o === a, 'fila: segundo pareia com o primeiro');
ok((await q(`select count(*)::int n from queue`))[0].n === 0, 'fila esvaziada');
try { await as(a, `select mm_try_pair($1,'5+0')`, [a]); ok(false, 'app não chama mm_try_pair'); } catch { ok(true, 'app não chama mm_try_pair'); }
// loja
ok((await q(`select buy_item($1,'board_tournament',150) c`, [a]))[0].c === 150, 'compra desconta moedas');
ok((await q(`select buy_item($1,'board_tournament',150) c`, [a]))[0].c === null, 'não compra item repetido');
ok((await q(`select buy_item($1,'board_galaxy',3000) c`, [a]))[0].c === null, 'não compra sem saldo');
ok((await q(`select grant_purchase($1,'android','p1','board_royal','tx1') g`, [a]))[0].g === true, 'compra real concede item');
ok((await q(`select grant_purchase($1,'android','p1','board_royal','tx1') g`, [b]))[0].g === false, 'mesma compra não vale para outro jogador');
ok((await q(`select 'board_royal' = any(inventory) v from wallets where user_id=$1`, [a]))[0].v, 'item real no inventário');
// finish_game
const g = (await q(`insert into games (white_id, black_id, time_control, clock_w, clock_b, state) values ($1,$2,'5+0',300000,300000,'{}') returning id`, [a, b]))[0].id;
const players = [{ id: a, rating: 1020, win: 1, loss: 0, draw: 0, winStreak: 1, coins: 30 }, { id: b, rating: 980, win: 0, loss: 1, draw: 0, winStreak: 0, coins: 5 }];
ok((await q(`select finish_game($1,0,'{"x":1}','1-0','xeque-mate','','f',1,2,$2,$3) r`, [g, JSON.stringify(players), JSON.stringify([{ userId: a, type: 'game_result', title: 'Vitória' }])]))[0].r === true, 'finaliza partida');
ok((await q(`select finish_game($1,0,'{}','1-0','x','','f',1,2,'[]','[]') r`, [g]))[0].r === false, 'não finaliza duas vezes');
const pa = (await q(`select rating, wins, games_played from profiles where id=$1`, [a]))[0];
ok(pa.rating === 1020 && pa.wins === 1 && pa.games_played === 1, 'rating e estatísticas atualizados');
ok((await q(`select my_rank() r`)).length === 1, 'my_rank roda');
console.log((await as(a, 'select my_rank() r'))[0]);
// bônus diário, IA e equipar
ok((await q(`select claim_daily($1,50) c`, [b]))[0].c === 355, 'bônus diário');
ok((await q(`select claim_daily($1,50) c`, [b]))[0].c === null, 'bônus diário só uma vez');
ok((await q(`select ai_reward($1,25,300) c`, [b]))[0].c === 25, 'moedas da IA');
ok((await q(`select ai_reward($1,25,300) c`, [b]))[0].c === 0, 'moedas da IA: espera 30 s');
ok((await q(`select equip_item($1,'board','board_galaxy') e`, [a]))[0].e === false, 'não equipa item que não tem');
ok((await q(`select equip_item($1,'board','board_royal') e`, [a]))[0].e === true, 'equipa item que tem');
ok((await q(`select equipped->>'board' b from profiles where id=$1`, [a]))[0].b === 'board_royal', 'equipado salvo');
for (const fn of ['claim_daily($1,50)', 'ai_reward($1,1000,9999)', "equip_item($1,'board','x')", "buy_item($1,'x',0)"]) {
  try { await as(a, `select ${fn}`, [a]); ok(false, `app não chama ${fn.split('(')[0]}`); } catch { ok(true, `app não chama ${fn.split('(')[0]}`); }
}

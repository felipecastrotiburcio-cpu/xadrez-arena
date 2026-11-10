// Teste de ponta a ponta do servidor online (Supabase local, iniciado pelo GitHub Actions).
// Dois jogadores de verdade (contas, tokens, Realtime) jogam pela função "arena".
// Variáveis: API_URL, ANON_KEY, SERVICE_ROLE_KEY (de `supabase status -o env`).
import { createClient } from '@supabase/supabase-js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const URL = process.env.API_URL;
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
assert.ok(URL && ANON && SERVICE, 'faltam API_URL / ANON_KEY / SERVICE_ROLE_KEY');

/** Mesma regra do app (src/lib/supabase.ts). */
const emailFor = (username) => `${username.toLowerCase()}@jogadores.xadrezarena.invalid`;
const run = Date.now().toString(36).slice(-5);
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function player(name, country) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const username = `${name}_${run}`;
  const { data, error } = await sb.auth.signUp({ email: emailFor(username), password: 'segredo123', options: { data: { username, country } } });
  assert.ifError(error);
  assert.ok(data.session, 'cadastro devolve sessão (sem confirmação de e-mail)');
  const call = async (action, body = {}) => {
    const { data: d, error: e } = await sb.functions.invoke('arena', { body: { action, ...body } });
    if (e) {
      const msg = (await e.context?.json?.().catch(() => null))?.error ?? e.message;
      const err = new Error(msg);
      err.status = e.context?.status;
      throw err;
    }
    return d;
  };
  return { sb, id: data.user.id, username, call };
}

/** Coleta eventos do Realtime de uma tabela com filtro. */
function listen(sb, table, filter) {
  const events = [];
  const ch = sb
    .channel(`t-${table}-${filter}-${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, (p) => events.push(p))
    .on('system', {}, (m) => {
      if (m?.status !== 'ok') console.log(`[realtime ${table}] sistema:`, JSON.stringify(m));
    })
    .subscribe((status, err) => {
      if (status !== 'SUBSCRIBED') console.log(`[realtime ${table}] ${status}`, err?.message ?? '');
    });
  return {
    events,
    ready: new Promise((res, rej) => {
      const end = Date.now() + 15000;
      const t = setInterval(() => {
        if (ch.state === 'joined') {
          clearInterval(t);
          // o servidor ainda liga a escuta do banco logo após entrar no canal
          setTimeout(res, 1500);
        } else if (Date.now() > end) {
          clearInterval(t);
          rej(new Error(`canal ao vivo não conectou (${table}, estado ${ch.state})`));
        }
      }, 50);
    }),
    async waitFor(pred, ms = 8000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const hit = events.find(pred);
        if (hit) return hit;
        await sleep(50);
      }
      throw new Error(`evento não chegou em ${table} (${filter})`);
    },
    close: () => sb.removeChannel(ch),
  };
}

let A, B;

test('cadastro: perfil, país, carteira e boas-vindas', async () => {
  A = await player('ana', 'br');
  B = await player('bob', 'US');
  const { data: p } = await A.sb.from('profiles').select('*').eq('id', A.id).single();
  assert.equal(p.country, 'BR');
  assert.equal(p.rating, 1000);
  const me = await A.call('me');
  assert.equal(me.user.coins, 300);
  assert.equal(me.user.country, 'BR');
  assert.ok(me.user.inventory.includes('move_67'));
  const { data: n } = await A.sb.from('notifications').select('type');
  assert.deepEqual(n.map((x) => x.type), ['welcome']);
  const { data: avail } = await A.sb.rpc('username_available', { p_username: A.username.toUpperCase() });
  assert.equal(avail, false);
  // login com nome de usuário (vira o e-mail interno)
  const s2 = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await s2.auth.signInWithPassword({ email: emailFor(A.username.toUpperCase()), password: 'segredo123' });
  assert.ifError(error);
});

test('segurança: ninguém mexe em moedas, partidas ou funções internas', async () => {
  const { data: other } = await A.sb.from('wallets').select('*').eq('user_id', B.id);
  assert.equal(other.length, 0, 'não vê carteira dos outros');
  await A.sb.from('wallets').update({ coins: 99999 }).eq('user_id', A.id);
  await A.sb.from('profiles').update({ rating: 3000 }).eq('id', A.id);
  const me = await A.call('me');
  assert.equal(me.user.coins, 300);
  assert.equal(me.user.rating, 1000);
  const ins = await A.sb.from('games').insert({ white_id: A.id, black_id: B.id, time_control: '5+0', clock_w: 1, clock_b: 1, state: {} });
  assert.ok(ins.error, 'não cria partida direto na tabela');
  const fin = await A.sb.rpc('buy_item', { p_user: A.id, p_item: 'board_galaxy', p_price: 0 });
  assert.ok(fin.error, 'não chama funções internas');
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const r = await anon.functions.invoke('arena', { body: { action: 'me' } });
  assert.ok(r.error, 'função exige login');
});

let gameId, whiteP, blackP;

test('fila: os dois se encontram e recebem a partida ao vivo', async () => {
  const la = listen(A.sb, 'games', `black_id=eq.${A.id}`);
  const lb = listen(A.sb, 'games', `white_id=eq.${A.id}`);
  await Promise.all([la.ready, lb.ready]);
  const first = await A.call('queue', { timeControl: '5+0' });
  assert.equal(first.matched, false);
  assert.equal(first.status.timeControl, '5+0');
  const second = await B.call('queue', { timeControl: '5+0' });
  assert.equal(second.matched, true);
  gameId = second.gameId;
  const ev = await Promise.race([la.waitFor((e) => e.new.id === gameId), lb.waitFor((e) => e.new.id === gameId)]);
  assert.equal(ev.eventType, 'INSERT');
  const st = second.state;
  assert.equal(st.moves.length, 0);
  assert.equal(st.timeControl.id, '5+0');
  assert.ok(st.white.country && st.black.country, 'bandeiras dos dois jogadores no estado');
  [whiteP, blackP] = st.white.id === A.id ? [A, B] : [B, A];
  la.close();
  lb.close();
  await assert.rejects(A.call('queue', { timeControl: '5+0' }), /partida atual/);
});

test('partida: lances validados, ao vivo para o adversário, xeque-mate com rating e moedas', async () => {
  const live = listen(blackP.sb, 'games', `id=eq.${gameId}`);
  await live.ready;
  await assert.rejects(blackP.call('move', { gameId, from: 'e7', to: 'e5' }), /sua vez/);
  await assert.rejects(whiteP.call('move', { gameId, from: 'e2', to: 'e5' }), /ilegal/);
  const seq = [
    [whiteP, 'e2', 'e4'],
    [blackP, 'e7', 'e5'],
    [whiteP, 'f1', 'c4'],
    [blackP, 'b8', 'c6'],
    [whiteP, 'd1', 'h5'],
    [blackP, 'g8', 'f6'],
  ];
  for (const [p, from, to] of seq) {
    const r = await p.call('move', { gameId, from, to });
    assert.equal(r.ok, true);
  }
  await live.waitFor((e) => e.new.state?.moves?.length === 6);
  const s6 = (await live.waitFor((e) => e.new.state?.moves?.length === 6)).new.state;
  assert.equal(s6.clocksRunning, true);
  assert.deepEqual(s6.lastMove, { from: 'g8', to: 'f6' });
  const mate = await whiteP.call('move', { gameId, from: 'h5', to: 'f7' });
  assert.equal(mate.state.result, '1-0');
  assert.equal(mate.state.reason, 'xeque-mate');
  assert.ok(mate.state.ratingChanges.white > 0 && mate.state.ratingChanges.black < 0);
  assert.equal(mate.state.coinRewards.white, 30);
  const over = await live.waitFor((e) => e.new.status === 'over');
  assert.equal(over.new.state.result, '1-0');
  live.close();
  const w = await whiteP.call('me');
  assert.equal(w.user.coins, 330);
  assert.equal(w.user.wins, 1);
  assert.ok(w.user.rating > 1000);
  const { data: notes } = await blackP.sb.from('notifications').select('type,title').eq('type', 'game_result');
  assert.match(notes[0].title, /^Derrota contra/);
  await assert.rejects(whiteP.call('move', { gameId, from: 'a2', to: 'a3' }), /não está ativa/);
  const { data: rank } = await whiteP.sb.rpc('my_rank');
  assert.ok(rank >= 1);
});

test('amigos e convite: pedido, aceite, convite ao vivo e partida criada', async () => {
  const req = await A.sb.rpc('send_friend_request', { p_username: B.username });
  assert.ifError(req.error);
  const { data: fr } = await B.sb.from('friendships').select('*');
  assert.equal(fr.length, 1);
  assert.ifError((await B.sb.rpc('accept_friend_request', { p_request: fr[0].id })).error);
  const inbox = listen(B.sb, 'invites', `to_id=eq.${B.id}`);
  await inbox.ready;
  const { data: inv, error } = await A.sb.rpc('send_invite', { p_to: B.id, p_time_control: '3+0', p_rated: false, p_color: 'white' });
  assert.ifError(error);
  const got = await inbox.waitFor((e) => e.new.id === inv.id);
  assert.equal(got.new.status, 'pending');
  const acc = await B.call('invite_accept', { inviteId: inv.id });
  assert.equal(acc.state.white.id, A.id, 'quem convidou escolheu brancas');
  assert.equal(acc.state.rated, false);
  inbox.close();
  // Desistir antes dos primeiros lances cancela (não conta)
  const r = await A.call('resign', { gameId: acc.gameId });
  assert.equal(r.state.result, null);
  assert.equal(r.state.reason, 'cancelada');
});

test('empate por acordo e desistência', async () => {
  const { data: inv } = await A.sb.rpc('send_invite', { p_to: B.id, p_time_control: '10+0', p_rated: true, p_color: 'black' });
  const { gameId: g } = await B.call('invite_accept', { inviteId: inv.id });
  await B.call('move', { gameId: g, from: 'd2', to: 'd4' });
  await A.call('move', { gameId: g, from: 'd7', to: 'd5' });
  const off = await B.call('offer_draw', { gameId: g });
  assert.equal(off.state.drawOffer, 'w');
  await assert.rejects(B.call('respond_draw', { gameId: g, accept: true }), /proposta/);
  const acc = await A.call('respond_draw', { gameId: g, accept: true });
  assert.equal(acc.state.result, '1/2-1/2');
  assert.equal(acc.state.reason, 'acordo');

  const { data: inv2 } = await A.sb.rpc('send_invite', { p_to: B.id, p_time_control: '10+0', p_rated: true, p_color: 'white' });
  const { gameId: g2 } = await B.call('invite_accept', { inviteId: inv2.id });
  await A.call('move', { gameId: g2, from: 'e2', to: 'e4' });
  await B.call('move', { gameId: g2, from: 'c7', to: 'c5' });
  const res = await A.call('resign', { gameId: g2 });
  assert.equal(res.state.result, '0-1');
  assert.equal(res.state.reason, 'desistência');
});

test('primeiro lance não feito em 30 s: a partida é cancelada ao conferir', async () => {
  const { data: inv } = await A.sb.rpc('send_invite', { p_to: B.id, p_time_control: '1+0', p_rated: true, p_color: 'white' });
  const { gameId: g } = await B.call('invite_accept', { inviteId: inv.id });
  const early = await B.call('claim', { gameId: g });
  assert.equal(early.ok, false);
  await sleep(31_000);
  const late = await B.call('claim', { gameId: g });
  assert.equal(late.ok, true);
  assert.equal(late.state.reason, 'cancelada');
});

test('loja: moedas, item lendário só por compra real, equipar, bônus diário e IA', async () => {
  const before = (await B.call('me')).user.coins;
  const r = await B.call('buy', { itemId: 'board_tournament' });
  assert.equal(r.user.coins, before - 150);
  assert.equal(r.user.equipped.board, 'board_tournament');
  await assert.rejects(B.call('buy', { itemId: 'board_tournament' }), /já possui/);
  await assert.rejects(B.call('buy', { itemId: 'board_galaxy' }), /compra no app/);
  await assert.rejects(B.call('equip', { itemId: 'char_astronaut' }), /Compre/);
  const d = await B.call('daily');
  assert.equal(d.amount, 50);
  await assert.rejects(B.call('daily'), /amanhã/);
  const ai = await B.call('ai_result', { level: 3, score: 1 });
  assert.equal(ai.coins, 25);
  const ai2 = await B.call('ai_result', { level: 3, score: 1 });
  assert.equal(ai2.coins, 0, 'no máximo uma recompensa a cada 30 s');
  await assert.rejects(B.call('purchase', { platform: 'ios', productId: 'board_galaxy', jws: 'a.b.c' }), /inválida|Apple/);
  await assert.rejects(B.call('purchase', { platform: 'android', productId: 'board_galaxy', purchaseToken: 'x' }), /não configuradas|não encontrada/);
});

test('sessão: partida ativa é devolvida ao abrir o app', async () => {
  const { data: inv } = await A.sb.rpc('send_invite', { p_to: B.id, p_time_control: '5+0', p_rated: false, p_color: 'random' });
  const { gameId: g } = await B.call('invite_accept', { inviteId: inv.id });
  const s = await A.call('session');
  assert.equal(s.activeGame.id, g);
  const sync = await A.call('sync', { gameId: g });
  assert.equal(sync.state.id, g);
  await A.call('resign', { gameId: g });
  assert.equal((await A.call('session')).activeGame, null);
});

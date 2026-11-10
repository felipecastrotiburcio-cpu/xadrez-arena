// Teste do APP (versão web) contra o Supabase local: dois navegadores — um em português do
// Brasil e outro em inglês dos EUA — criam conta, entram na fila, se encontram e jogam até o
// xeque-mate. Confere lances ao vivo, bandeiras e resultado.
// Uso: node app.e2e.mjs <pasta do site exportado> <pasta para capturas>
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const [dist, out = 'app-shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

// Servidor estático com "fallback" para index.html (rotas do app).
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8090, r));
const BASE = 'http://localhost:8090';

const browser = await chromium.launch();
const run = Date.now().toString(36).slice(-4);
const errors = [];
let failed = false;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) failed = true;
};

async function newPlayer(name, locale) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[${name} console] ${m.text().slice(0, 300)}`);
  });
  page.on('dialog', (d) => d.accept());
  const username = `${name}${run}`;
  await page.goto(`${BASE}/login`);
  await page.locator('[data-testid="seg-register"]').click();
  await page.locator('[data-testid="login-username"]').fill(username);
  await page.locator('[data-testid="login-password"]').fill('segredo123');
  await page.locator('[data-testid="login-submit"]').click();
  // A tela de login volta para a anterior; como ela foi aberta direto, vamos ao início.
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/00-${name}-apos-cadastro.png` });
  await page.goto(BASE);
  try {
    await page.getByText(username, { exact: true }).first().waitFor({ timeout: 30000 });
  } catch (e) {
    await page.screenshot({ path: `${out}/99-${name}-falha-cadastro.png` });
    console.log(`texto da tela (${name}):`, (await page.locator('body').innerText()).slice(0, 600));
    throw e;
  }
  return { page, username, name };
}

const sq = (p, s) => p.page.locator(`[aria-label^="${s}"]`).first();
const pieceAt = async (p, s) => (await sq(p, s).getAttribute('aria-label')) ?? '';

try {
  const A = await newPlayer('ana', 'pt-BR');
  const B = await newPlayer('ben', 'en-US');
  await A.page.screenshot({ path: `${out}/01-ana-inicio-pt.png` });
  await B.page.screenshot({ path: `${out}/02-ben-home-en.png` });
  check(await A.page.getByText('JOGAR!').count() > 0, 'Ana vê o app em português');
  check(await B.page.getByText(/PLAY!/).count() > 0, 'Ben sees the app in English');

  for (const p of [A, B]) {
    await p.page.goto(`${BASE}/play`);
    await p.page.getByText('5+0', { exact: true }).first().click();
  }
  await A.page.locator('[data-testid="queue-join"]').click();
  await A.page.waitForTimeout(1500);
  await A.page.screenshot({ path: `${out}/03-ana-na-fila.png` });
  await B.page.locator('[data-testid="queue-join"]').click();
  await Promise.all([A.page.waitForURL(/\/game\//, { timeout: 30000 }), B.page.waitForURL(/\/game\//, { timeout: 30000 })]);
  check(A.page.url() === B.page.url(), 'os dois caíram na mesma partida');
  await A.page.waitForTimeout(1500);

  // Quem está de brancas? (no tabuleiro dele, e2 fica abaixo de e7)
  const yOf = async (p, s) => (await sq(p, s).boundingBox()).y;
  const aWhite = (await yOf(A, 'e2')) > (await yOf(A, 'e7'));
  const [W, Bk] = aWhite ? [A, B] : [B, A];
  console.log(`brancas: ${W.name} · pretas: ${Bk.name}`);

  const body = async (p) => p.page.locator('body').innerText();
  check((await body(A)).includes('🇺🇸') && (await body(B)).includes('🇧🇷'), 'bandeira do adversário aparece na partida (🇧🇷 x 🇺🇸)');

  const moves = [
    [W, 'e2', 'e4'],
    [Bk, 'e7', 'e5'],
    [W, 'f1', 'c4'],
    [Bk, 'b8', 'c6'],
    [W, 'd1', 'h5'],
    [Bk, 'g8', 'f6'],
    [W, 'h5', 'f7'],
  ];
  for (const [i, [p, from, to]] of moves.entries()) {
    const other = p === W ? Bk : W;
    await sq(p, from).click();
    await sq(p, to).click();
    // o adversário vê a peça chegar (ao vivo, pelo Realtime)
    const t0 = Date.now();
    let seen = false;
    while (Date.now() - t0 < 10000) {
      const label = await pieceAt(other, to);
      if (label.split(' ').length > 1) {
        seen = true;
        break;
      }
      await other.page.waitForTimeout(100);
    }
    check(seen, `lance ${i + 1} ${from}-${to} apareceu para o adversário em ${Date.now() - t0} ms`);
    if (i === 3) {
      await W.page.screenshot({ path: `${out}/04-${W.name}-partida.png` });
      await Bk.page.screenshot({ path: `${out}/05-${Bk.name}-partida.png` });
    }
  }
  // Xeque-mate: finalização e resultado
  await W.page.waitForTimeout(2500);
  await W.page.screenshot({ path: `${out}/06-${W.name}-final.png` });
  await Bk.page.screenshot({ path: `${out}/07-${Bk.name}-final.png` });
  const skip = async (p) => {
    const btn = p.page.getByText(/Pular|Skip/).first();
    if (await btn.count()) await btn.click().catch(() => {});
    await p.page.waitForTimeout(1500);
  };
  await skip(W);
  await skip(Bk);
  const wText = await body(W);
  const bText = await body(Bk);
  await W.page.screenshot({ path: `${out}/08-${W.name}-resultado.png` });
  await Bk.page.screenshot({ path: `${out}/09-${Bk.name}-resultado.png` });
  check(/Vitória|Victory|You won|Win/i.test(wText), `${W.name} vê a vitória`);
  check(/Derrota|Defeat|You lost|Loss/i.test(bText), `${Bk.name} vê a derrota`);
  check(/moedas|coins/i.test(wText), 'resultado mostra moedas ganhas');

  // Ranking com os dois jogadores
  await A.page.goto(`${BASE}/leaderboard`);
  await A.page.getByText(B.username).first().waitFor({ timeout: 15000 });
  await A.page.screenshot({ path: `${out}/10-ranking.png` });
  check(true, 'ranking mostra os dois jogadores');
} catch (e) {
  failed = true;
  console.error('❌ erro:', e.message);
} finally {
  if (errors.length) console.log('Erros de JavaScript:\n' + errors.slice(0, 10).join('\n'));
  await browser.close();
  server.close();
  process.exit(failed || errors.length ? 1 : 0);
}

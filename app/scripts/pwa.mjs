// Transforma o site exportado pelo Expo (expo export --platform web) num app instalável
// pela tela de início do iPhone/Android (PWA): manifesto, ícones, tela cheia e
// funcionamento offline (service worker que guarda todos os arquivos do app).
// Uso: node scripts/pwa.mjs <pasta dist> <baseUrl, ex: /xadrez-arena>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const [dist, baseArg = ''] = process.argv.slice(2);
const base = baseArg.replace(/\/$/, '');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p).split('\\').join('/'));
  }
})(dist);

const manifest = {
  name: 'Xadrez Arena',
  short_name: 'Xadrez Arena',
  description: 'Xadrez contra a IA, loja de tabuleiros e peças e finalizações em 3D.',
  lang: 'pt-BR',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#110d2e',
  theme_color: '#110d2e',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

// Versão do cache = hash de todos os arquivos: cada publicação nova substitui o cache antigo.
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = [`${base}/`, ...files.filter((f) => f !== 'metadata.json').map((f) => `${base}/${f}`), `${base}/manifest.webmanifest`];

writeFileSync(
  join(dist, 'sw.js'),
  `// Gerado por scripts/pwa.mjs — guarda o app para abrir sem internet.
const CACHE = 'xadrez-arena-${version}';
const FILES = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  // Um arquivo que falhe não impede os outros de ficarem guardados.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Telas do app (navegação): sempre a mesma página; tenta a rede e cai no cache sem internet.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('${base}/')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`,
);

const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Xadrez Arena" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="description" content="${manifest.description}" />
    <style>body { background-color: #110d2e; }</style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('${base}/sw.js', { scope: '${base}/' }).catch(() => {}));
      }
    </script>
  </head>`;

let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover')
  .replace('</head>', head);
writeFileSync(join(dist, 'index.html'), html);
// GitHub Pages: qualquer endereço do app (ex.: /xadrez-arena/shop) abre a mesma página.
writeFileSync(join(dist, '404.html'), html);
console.log(`PWA pronto: ${files.length} arquivos no cache offline (versão ${version})`);

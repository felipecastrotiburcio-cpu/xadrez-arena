/**
 * Gera as fotos dos bonecos (assets/characters/*.png) a partir do próprio modelo 3D,
 * normal e evoluído. Rodar de app/ depois de mudar o visual de algum boneco:
 *
 *   npx esbuild scripts/character-thumbs/thumbs.ts --bundle --format=iife --outfile=/tmp/thumbs.js
 *   node scripts/character-thumbs/render.cjs /tmp/thumbs.js
 *
 * Precisa do Playwright com Chromium instalado. Depois, reduza as imagens para 320×400.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const bundle = path.resolve(process.argv[2] ?? '/tmp/thumbs.js');
  const html = path.join(path.dirname(bundle), 'thumbs.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0"><script src="${path.basename(bundle)}"></script></body></html>`);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.goto('file://' + html);
  await p.waitForFunction(() => window.ready);
  const out = path.join(__dirname, '../../assets/characters');
  for (const k of await p.evaluate(() => window.keys)) {
    const url = await p.evaluate((k) => window.thumb(k), k);
    fs.writeFileSync(path.join(out, `${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close();
})();

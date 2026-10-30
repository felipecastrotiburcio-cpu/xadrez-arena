import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const SECRET = 'Zq8!vR2#pL9@wX4$mN7^k3&bT6*hY1%cF5';

function request(url: string, opts: https.RequestOptions = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, opts, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
      })
      .on('error', reject);
  });
}

test('TLS direto no Node: atende HTTPS com HSTS', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xadrez-tls-'));
  const cert = path.join(dir, 'cert.pem');
  const key = path.join(dir, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });

  const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET, TLS_CERT_FILE: cert, TLS_KEY_FILE: key });
  const ctx = createApp({ dbFile: null, config });
  await new Promise<void>((r) => ctx.server.listen(0, r));
  const port = (ctx.server.address() as AddressInfo).port;
  try {
    const res = await request(`https://localhost:${port}/api/shop/catalog`, { ca: fs.readFileSync(cert) });
    assert.equal(res.status, 200);
    assert.match(String(res.headers['strict-transport-security']), /max-age=31536000/);
  } finally {
    await ctx.close();
    ctx.server.close();
  }
});

test('atrás de proxy: redireciona HTTP para HTTPS sem confiar no Host', async () => {
  const config = loadConfig({
    NODE_ENV: 'production', JWT_SECRET: SECRET, TRUST_PROXY: '1', PUBLIC_HOST: 'api.xadrez.app',
  });
  const ctx = createApp({ dbFile: null, config });
  await new Promise<void>((r) => ctx.server.listen(0, r));
  const url = `http://127.0.0.1:${(ctx.server.address() as AddressInfo).port}`;
  try {
    const plain = await request(`${url}/api/shop/catalog`, { headers: { host: 'malicioso.com' } });
    assert.equal(plain.status, 308);
    assert.equal(plain.headers.location, 'https://api.xadrez.app/api/shop/catalog');
    const viaProxy = await request(`${url}/api/shop/catalog`, { headers: { 'x-forwarded-proto': 'https' } });
    assert.equal(viaProxy.status, 200);
    // Health check continua acessível para o balanceador.
    assert.equal((await request(`${url}/health`)).status, 200);
  } finally {
    await ctx.close();
    ctx.server.close();
  }
});

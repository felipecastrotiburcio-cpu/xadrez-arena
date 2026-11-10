// deno test --config arena/deno.json --allow-env arena/purchases.test.ts
// Monta uma cadeia de certificados de teste com a mesma estrutura da Apple
// (raiz → intermediário WWDR → folha App Store) e confere a verificação.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import { CompactSign } from 'jose';
import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.13';
import { APPLE_ROOT_G3_SHA256, verifyApple } from './purchases.ts';

x509.cryptoProvider.set(crypto);
const alg = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } as const;
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));

async function chain() {
  const rootKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const midKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const leafKeys = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const notBefore = new Date(Date.now() - 86400_000);
  const notAfter = new Date(Date.now() + 86400_000);
  const root = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01', name: 'CN=Teste Root', notBefore, notAfter, keys: rootKeys, signingAlgorithm: alg,
    extensions: [new x509.BasicConstraintsExtension(true, undefined, true)],
  });
  const mid = await x509.X509CertificateGenerator.create({
    serialNumber: '02', subject: 'CN=Teste WWDR', issuer: root.subject, notBefore, notAfter,
    publicKey: midKeys.publicKey, signingKey: rootKeys.privateKey, signingAlgorithm: alg,
    extensions: [new x509.BasicConstraintsExtension(true, 0, true), new x509.Extension('1.2.840.113635.100.6.2.1', false, new Uint8Array([5, 0]))],
  });
  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '03', subject: 'CN=Teste App Store', issuer: mid.subject, notBefore, notAfter,
    publicKey: leafKeys.publicKey, signingKey: midKeys.privateKey, signingAlgorithm: alg,
    extensions: [new x509.Extension('1.2.840.113635.100.6.11.1', false, new Uint8Array([5, 0]))],
  });
  return { root, mid, leaf, leafKey: leafKeys.privateKey, rootSha: hex(await crypto.subtle.digest('SHA-256', root.rawData)) };
}

async function sign(c: Awaited<ReturnType<typeof chain>>, payload: Record<string, unknown>, key = c.leafKey) {
  return await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'ES256', x5c: [c.leaf, c.mid, c.root].map((x) => b64(x.rawData)) })
    .sign(key);
}

const tx = { bundleId: 'app.xadrezarena', productId: 'board_galaxy', transactionId: '2000001', originalTransactionId: '1000001' };

Deno.test('compra válida é aceita e usa o ID original da transação', async () => {
  const c = await chain();
  const r = await verifyApple(await sign(c, tx), 'board_galaxy', Date.now(), c.rootSha);
  assertEquals(r, { platform: 'ios', productId: 'board_galaxy', transactionId: 'ios:1000001' });
});

Deno.test('cadeia que não termina na raiz da Apple é recusada', async () => {
  const c = await chain();
  await assertRejects(() => verifyApple(sign(c, tx) as unknown as string, 'board_galaxy'), Error);
  await assertRejects(async () => verifyApple(await sign(c, tx), 'board_galaxy', Date.now(), APPLE_ROOT_G3_SHA256), Error, 'Apple');
});

Deno.test('assinatura adulterada, outro app, outro produto e reembolso são recusados', async () => {
  const c = await chain();
  const other = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  await assertRejects(async () => verifyApple(await sign(c, tx, other.privateKey), 'board_galaxy', Date.now(), c.rootSha));
  const good = await sign(c, tx);
  const [h, , s] = good.split('.');
  const forged = btoa(JSON.stringify({ ...tx, productId: 'char_astronaut' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  await assertRejects(() => verifyApple(`${h}.${forged}.${s}`, 'char_astronaut', Date.now(), c.rootSha));
  await assertRejects(async () => verifyApple(await sign(c, { ...tx, bundleId: 'com.outro' }), 'board_galaxy', Date.now(), c.rootSha), Error, 'outro app');
  await assertRejects(async () => verifyApple(await sign(c, tx), 'char_king', Date.now(), c.rootSha), Error, 'Produto');
  await assertRejects(async () => verifyApple(await sign(c, { ...tx, revocationDate: 1 }), 'board_galaxy', Date.now(), c.rootSha), Error, 'reembolsada');
});

Deno.test('certificado vencido é recusado', async () => {
  const c = await chain();
  await assertRejects(async () => verifyApple(await sign(c, tx), 'board_galaxy', Date.now() + 3 * 86400_000, c.rootSha), Error, 'validade');
});

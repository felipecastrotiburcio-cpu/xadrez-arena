// Conferência das compras com dinheiro real antes de entregar o item.
//
// iOS (StoreKit 2): o app envia a transação assinada pela Apple (JWS). Conferimos a cadeia de
// certificados até a raiz "Apple Root CA - G3" (impressão digital fixa abaixo), a assinatura,
// o ID do app e se a compra não foi reembolsada. Não precisa de chave da Apple.
//
// Android (Google Play Billing): o app envia o purchaseToken. Consultamos a API do Google Play
// com uma conta de serviço (segredo GOOGLE_SERVICE_ACCOUNT_JSON) e confirmamos a compra
// ("acknowledge"); sem isso o Google reembolsa sozinho em 3 dias.
// A biblioteca de certificados precisa deste complemento carregado antes dela.
import 'reflect-metadata';
import { X509Certificate } from '@peculiar/x509';
import { compactVerify, importPKCS8, SignJWT } from 'jose';

export const BUNDLE_ID = Deno.env.get('APP_BUNDLE_ID') ?? 'app.xadrezarena';
export const ANDROID_PACKAGE = Deno.env.get('ANDROID_PACKAGE') ?? 'app.xadrezarena';

/** SHA-256 do certificado "Apple Root CA - G3" (https://www.apple.com/certificateauthority/). */
export const APPLE_ROOT_G3_SHA256 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
/** Extensões que a Apple coloca nos certificados de assinatura da App Store. */
const OID_APPSTORE_LEAF = '1.2.840.113635.100.6.11.1';
const OID_APPLE_WWDR_INTERMEDIATE = '1.2.840.113635.100.6.2.1';

export interface VerifiedPurchase {
  platform: 'android' | 'ios';
  productId: string;
  transactionId: string;
}

export class PurchaseError extends Error {
  status = 400;
}

const b64urlJson = (part: string) => JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));

function base64UrlDecode(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function verifyPurchase(input: Record<string, unknown>): Promise<VerifiedPurchase> {
  if (input.platform === 'ios') return verifyApple(String(input.jws ?? ''), String(input.productId ?? ''));
  if (input.platform === 'android') return verifyGoogle(String(input.productId ?? ''), String(input.purchaseToken ?? ''));
  throw new PurchaseError('Plataforma de compra inválida.');
}

// ------------------------------------------------------------------ Apple

export async function verifyApple(
  jws: string,
  expectedProduct: string,
  now = Date.now(),
  rootSha256 = APPLE_ROOT_G3_SHA256, // trocado só nos testes, que usam uma cadeia de certificados de teste
): Promise<VerifiedPurchase> {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new PurchaseError('Compra inválida.');
  let header: { alg?: string; x5c?: string[] };
  try {
    header = b64urlJson(parts[0]);
  } catch {
    throw new PurchaseError('Compra inválida.');
  }
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw new PurchaseError('Compra inválida.');
  let leaf: X509Certificate, intermediate: X509Certificate, root: X509Certificate;
  try {
    [leaf, intermediate, root] = header.x5c.map((c) => new X509Certificate(c));
  } catch {
    throw new PurchaseError('Compra inválida.');
  }

  const rootHash = hex(await crypto.subtle.digest('SHA-256', root.rawData));
  if (rootHash !== rootSha256) throw new PurchaseError('Compra não assinada pela Apple.');
  const at = new Date(now);
  for (const c of [leaf, intermediate, root]) {
    if (c.notBefore > at || c.notAfter < at) throw new PurchaseError('Certificado da compra fora da validade.');
  }
  if (!leaf.getExtension(OID_APPSTORE_LEAF) || !intermediate.getExtension(OID_APPLE_WWDR_INTERMEDIATE)) {
    throw new PurchaseError('Compra não assinada pela Apple.');
  }
  const chainOk =
    (await leaf.verify({ publicKey: intermediate.publicKey, signatureOnly: true })) &&
    (await intermediate.verify({ publicKey: root.publicKey, signatureOnly: true })) &&
    (await root.verify({ publicKey: root.publicKey, signatureOnly: true }));
  if (!chainOk) throw new PurchaseError('Compra não assinada pela Apple.');

  const leafKey = await leaf.publicKey.export({ name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
  const payload = await compactVerify(jws, leafKey)
    .then((r) => r.payload)
    .catch(() => {
      throw new PurchaseError('Assinatura da compra inválida.');
    });
  const tx = JSON.parse(new TextDecoder().decode(payload)) as {
    bundleId?: string;
    productId?: string;
    transactionId?: string;
    originalTransactionId?: string;
    revocationDate?: number;
    type?: string;
  };
  if (tx.bundleId !== BUNDLE_ID) throw new PurchaseError('Compra de outro app.');
  if (!tx.productId || (expectedProduct && tx.productId !== expectedProduct)) throw new PurchaseError('Produto diferente do comprado.');
  if (tx.revocationDate) throw new PurchaseError('Compra reembolsada.');
  // Itens são "não consumíveis": o ID original identifica a compra também ao restaurar.
  const id = tx.originalTransactionId ?? tx.transactionId;
  if (!id) throw new PurchaseError('Compra inválida.');
  return { platform: 'ios', productId: tx.productId, transactionId: `ios:${id}` };
}

// ------------------------------------------------------------------ Google

let googleToken: { value: string; expires: number } | null = null;

async function googleAccessToken() {
  if (googleToken && googleToken.expires > Date.now() + 60_000) return googleToken.value;
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new PurchaseError('Compras do Google Play ainda não configuradas no servidor.');
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; token_uri?: string };
  const key = await importPKCS8(sa.private_key, 'RS256');
  const aud = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth: ${JSON.stringify(data)}`);
  googleToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return googleToken.value;
}

export async function verifyGoogle(productId: string, token: string): Promise<VerifiedPurchase> {
  if (!/^[a-z0-9][a-z0-9_.]*$/.test(productId) || !token) throw new PurchaseError('Compra inválida.');
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/purchases/products/${productId}/tokens/${encodeURIComponent(token)}`;
  const access = await googleAccessToken();
  const res = await fetch(base, { headers: { Authorization: `Bearer ${access}` } });
  if (res.status === 404 || res.status === 400) throw new PurchaseError('Compra não encontrada no Google Play.');
  const p = await res.json();
  if (!res.ok) throw new Error(`Google Play: ${JSON.stringify(p)}`);
  // purchaseState: 0 comprado, 1 cancelado, 2 pendente
  if (p.purchaseState !== 0) throw new PurchaseError(p.purchaseState === 2 ? 'Pagamento ainda pendente.' : 'Compra cancelada.');
  if (p.acknowledgementState === 0) {
    await fetch(`${base}:acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: '{}' });
  }
  return { platform: 'android', productId, transactionId: `android:${p.orderId ?? token}` };
}


import { DEV_MODE_KDF } from '../_shared/catalog.ts';

/** PBKDF2-SHA256 (Web Crypto) da senha do modo desenvolvedor, comparado com DEV_MODE_KDF.hash. */
export async function checkDevPassword(password: string) {
  if (!password || password.length > 128) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(DEV_MODE_KDF.salt), iterations: DEV_MODE_KDF.iterations },
    key,
    256,
  );
  const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === DEV_MODE_KDF.hash;
}

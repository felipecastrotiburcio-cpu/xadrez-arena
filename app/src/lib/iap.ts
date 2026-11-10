import { Platform } from 'react-native';
import { api, usingSupabase } from './api';
import { ApiError } from './apiError';
import type { PrivateUser } from './types';

/**
 * Compras com dinheiro real (itens lendários) pela App Store e pelo Google Play.
 * O app pede a compra à loja; o servidor (função "arena") confere a compra com a
 * Apple/Google e só então entrega o item. Depois disso a compra é "finalizada" na loja.
 *
 * Só funciona no app instalado pela loja (Play Store / App Store / TestFlight) e com o
 * servidor online; na web e no APK baixado do GitHub a loja não está disponível.
 */

type IapModule = typeof import('expo-iap');
let mod: IapModule | null = null;
let connected: Promise<boolean> | null = null;

function iap(): IapModule | null {
  if (Platform.OS === 'web') return null;
  if (!mod) {
    try {
      // Carregado só quando necessário: o módulo nativo não existe na web.
      mod = require('expo-iap') as IapModule;
    } catch {
      mod = null;
    }
  }
  return mod;
}

/** A compra real é possível neste aparelho? */
export const iapSupported = () => Platform.OS !== 'web' && usingSupabase() && !!iap();

async function connect() {
  const m = iap();
  if (!m) return false;
  if (!connected) {
    connected = m
      .initConnection()
      .then(() => {
        listen(m);
        return true;
      })
      .catch(() => {
        connected = null;
        return false;
      });
  }
  return connected;
}

/** Preços locais das lojas (ex.: "R$ 9,90", "US$ 1.99") por ID de produto. */
export async function loadPrices(productIds: string[]): Promise<Record<string, string>> {
  if (!productIds.length || !(await connect())) return {};
  try {
    const products = (await iap()!.fetchProducts({ skus: productIds, type: 'in-app' })) ?? [];
    const out: Record<string, string> = {};
    for (const p of products as { id: string; displayPrice: string }[]) out[p.id] = p.displayPrice;
    return out;
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------ compra

interface Pending {
  resolve: (u: PrivateUser) => void;
  reject: (e: Error) => void;
}
const pending = new Map<string, Pending>();
let listening = false;

/** Envia a compra ao servidor para conferência e entrega do item. */
async function deliver(purchase: any): Promise<PrivateUser> {
  const m = iap()!;
  const body: Record<string, unknown> = { platform: Platform.OS, productId: purchase.productId };
  if (Platform.OS === 'ios') {
    let jws = typeof purchase.purchaseToken === 'string' && purchase.purchaseToken.split('.').length === 3 ? purchase.purchaseToken : null;
    if (!jws) jws = await m.getTransactionJwsIOS(purchase.productId).catch(() => null);
    body.jws = jws ?? '';
  } else {
    body.purchaseToken = purchase.purchaseToken ?? purchase.purchaseTokenAndroid ?? '';
  }
  const r = await api<{ user: PrivateUser }>('/shop/purchase', { body });
  // Item entregue: avisa a loja que a compra foi concluída (não consumível).
  await m.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
  return r.user;
}

function listen(m: IapModule) {
  if (listening) return;
  listening = true;
  m.purchaseUpdatedListener((purchase: any) => {
    const waiter = pending.get(purchase.productId);
    if (purchase.purchaseState === 'pending') {
      waiter?.reject(new ApiError('Pagamento pendente. O item chega assim que a loja confirmar.', 202));
      pending.delete(purchase.productId);
      return;
    }
    deliver(purchase)
      .then((u) => waiter?.resolve(u))
      .catch((e) => waiter?.reject(e))
      .finally(() => pending.delete(purchase.productId));
  });
  m.purchaseErrorListener((error: any) => {
    const id = error?.productId as string | undefined;
    const cancelled = /cancel/i.test(String(error?.code ?? '')) || /cancel/i.test(String(error?.message ?? ''));
    const err = new ApiError(cancelled ? 'Compra cancelada.' : (error?.message ?? 'Não foi possível concluir a compra.'), cancelled ? 499 : 400);
    if (id && pending.has(id)) {
      pending.get(id)!.reject(err);
      pending.delete(id);
    } else {
      for (const [k, w] of pending) {
        w.reject(err);
        pending.delete(k);
      }
    }
  });
}

/** Compra um item lendário. Resolve com o jogador atualizado (item já no inventário). */
export async function buyWithStore(productId: string): Promise<PrivateUser> {
  if (!usingSupabase()) throw new ApiError('Compras reais precisam do servidor online.', 400);
  if (!(await connect())) throw new ApiError('A loja do aparelho não está disponível. Instale o app pela Play Store ou App Store.', 400);
  const done = new Promise<PrivateUser>((resolve, reject) => pending.set(productId, { resolve, reject }));
  try {
    await iap()!.requestPurchase({
      request: { apple: { sku: productId }, google: { skus: [productId] } },
      type: 'in-app',
    });
  } catch (e) {
    pending.delete(productId);
    throw e;
  }
  return done;
}

/** Restaura compras feitas antes (outro aparelho ou reinstalação). Exigido pela Apple. */
export async function restoreStorePurchases(): Promise<{ user: PrivateUser | null; restored: number }> {
  if (!(await connect())) throw new ApiError('A loja do aparelho não está disponível.', 400);
  const purchases = ((await iap()!.getAvailablePurchases()) ?? []) as any[];
  let user: PrivateUser | null = null;
  let restored = 0;
  for (const p of purchases) {
    try {
      user = await deliver(p);
      restored++;
    } catch {
      // compra de outra conta ou reembolsada: ignora
    }
  }
  return { user, restored };
}

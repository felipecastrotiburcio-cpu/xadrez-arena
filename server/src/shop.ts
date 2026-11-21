import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { privateUser, today, type Auth, type AuthedRequest } from './auth.js';
import { CATALOG, DAILY_BONUS, DEV_MODE_KDF, getItem } from './catalog.js';
import type { Database } from './db.js';
import type { Notifier } from './notifications.js';

/** Loja, bônus diário e central de notificações. */
export function createShopRoutes(db: Database, auth: Auth, notifier: Notifier) {
  const r = Router();

  // Público: o app precisa do catálogo para desenhar a aparência dos outros jogadores.
  r.get('/shop/catalog', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ items: CATALOG });
  });

  r.post('/shop/buy', auth.requireAuth, (req: AuthedRequest, res) => {
    const user = db.getUser(req.userId!)!;
    const item = getItem(String(req.body?.itemId ?? ''));
    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });
    if (user.inventory.includes(item.id)) return res.status(409).json({ error: 'Você já possui este item.' });
    // Modo desenvolvedor: tudo de graça, inclusive os lendários de dinheiro real.
    const price = user.devMode ? 0 : item.price;
    if (item.iap && !user.devMode) {
      return res.status(400).json({ error: 'Este item é vendido como compra no app (Google Play / App Store).' });
    }
    if (user.coins < price) {
      return res.status(402).json({ error: `Faltam ${price - user.coins} moedas para comprar ${item.name}.` });
    }
    // Comprar já equipa: é o que o jogador quer ver em seguida.
    const updated = db.updateUser(user.id, {
      coins: user.coins - price,
      inventory: [...user.inventory, item.id],
      equipped: { ...user.equipped, [item.type]: item.id },
    })!;
    res.json({ user: privateUser(updated) });
  });

  r.post('/dev/unlock', auth.requireAuth, async (req: AuthedRequest, res) => {
    if (!(await checkDevPassword(String(req.body?.password ?? '')))) {
      return res.status(403).json({ error: 'Senha do modo desenvolvedor incorreta.' });
    }
    res.json({ user: privateUser(db.updateUser(req.userId!, { devMode: true })!) });
  });

  r.post('/dev/lock', auth.requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: privateUser(db.updateUser(req.userId!, { devMode: false })!) });
  });

  r.post('/shop/equip', auth.requireAuth, (req: AuthedRequest, res) => {
    const user = db.getUser(req.userId!)!;
    const item = getItem(String(req.body?.itemId ?? ''));
    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });
    if (!user.inventory.includes(item.id)) return res.status(403).json({ error: 'Compre o item antes de equipar.' });
    const updated = db.updateUser(user.id, { equipped: { ...user.equipped, [item.type]: item.id } })!;
    res.json({ user: privateUser(updated) });
  });

  r.post('/rewards/daily', auth.requireAuth, (req: AuthedRequest, res) => {
    const user = db.getUser(req.userId!)!;
    if (user.lastDailyBonus === today()) {
      return res.status(409).json({ error: 'Você já resgatou o bônus de hoje. Volte amanhã!' });
    }
    const updated = db.updateUser(user.id, { coins: user.coins + DAILY_BONUS, lastDailyBonus: today() })!;
    notifier.notify(user.id, {
      type: 'reward',
      title: 'Bônus diário resgatado',
      body: `+${DAILY_BONUS} moedas. Volte amanhã para mais!`,
    });
    res.json({ user: privateUser(updated), amount: DAILY_BONUS });
  });

  r.get('/notifications', auth.requireAuth, (req: AuthedRequest, res) => {
    res.json({ notifications: db.notificationsOf(req.userId!), unread: db.unreadCount(req.userId!) });
  });

  // Marca uma (body.id) ou todas como lidas.
  r.post('/notifications/read', auth.requireAuth, (req: AuthedRequest, res) => {
    const id = req.body?.id ? String(req.body.id) : undefined;
    db.markNotificationsRead(req.userId!, id);
    res.json({ unread: db.unreadCount(req.userId!) });
  });

  return r;
}

const pbkdf2Async = promisify(pbkdf2);

/** Confere a senha do modo desenvolvedor (só a derivação PBKDF2 dela fica no código). */
export async function checkDevPassword(password: string) {
  if (!password || password.length > 128) return false;
  const key = await pbkdf2Async(password, DEV_MODE_KDF.salt, DEV_MODE_KDF.iterations, 32, 'sha256');
  return key.toString('hex') === DEV_MODE_KDF.hash;
}

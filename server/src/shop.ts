import { Router } from 'express';
import { privateUser, today, type Auth, type AuthedRequest } from './auth.js';
import { CATALOG, DAILY_BONUS, getItem } from './catalog.js';
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
    if (user.coins < item.price) {
      return res.status(402).json({ error: `Faltam ${item.price - user.coins} moedas para comprar ${item.name}.` });
    }
    // Comprar já equipa: é o que o jogador quer ver em seguida.
    const updated = db.updateUser(user.id, {
      coins: user.coins - item.price,
      inventory: [...user.inventory, item.id],
      equipped: { ...user.equipped, [item.type]: item.id },
    })!;
    res.json({ user: privateUser(updated) });
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

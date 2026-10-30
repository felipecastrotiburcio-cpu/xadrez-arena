import type { Server } from 'socket.io';
import type { Database, Notification } from './db.js';

/** Grava a notificação e entrega em tempo real se o usuário estiver conectado. */
export class Notifier {
  constructor(
    private io: Server,
    private db: Database,
  ) {}

  notify(userId: string, n: Omit<Notification, 'id' | 'read' | 'createdAt' | 'userId' | 'data'> & { data?: Record<string, string> }) {
    const notification = this.db.addNotification({ userId, data: {}, ...n });
    this.io.to(`user:${userId}`).emit('notification:new', {
      notification,
      unread: this.db.unreadCount(userId),
    });
    return notification;
  }

  /** Avisa o app que moedas/inventário mudaram. */
  walletChanged(userId: string) {
    this.io.to(`user:${userId}`).emit('wallet:changed');
  }
}

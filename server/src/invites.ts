import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import { publicUser } from './auth.js';
import type { Database } from './db.js';
import type { GameManager } from './games.js';
import type { Matchmaker } from './matchmaking.js';
import type { Notifier } from './notifications.js';
import type { Presence } from './presence.js';
import { getTimeControl, type TimeControl } from './timeControls.js';

export const INVITE_TTL_MS = 60_000;

export interface Invite {
  id: string;
  fromId: string;
  toId: string;
  timeControl: TimeControl;
  rated: boolean;
  color: 'white' | 'black' | 'random';
  createdAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

export interface InviteInput {
  toUserId: string;
  timeControl: string;
  rated?: boolean;
  color?: 'white' | 'black' | 'random';
  /** Revanche: permite convidar o adversário da partida mesmo sem amizade. */
  rematchOf?: string;
}

/** Convites de partida entre amigos (e revanches). */
export class InviteManager {
  private invites = new Map<string, Invite>();

  constructor(
    private io: Server,
    private db: Database,
    private presence: Presence,
    private games: GameManager,
    private matchmaker: Matchmaker,
    private notifier: Notifier,
  ) {}

  payload(inv: Invite) {
    return {
      id: inv.id,
      from: publicUser(this.db.getUser(inv.fromId)!),
      to: publicUser(this.db.getUser(inv.toId)!),
      timeControl: inv.timeControl,
      rated: inv.rated,
      color: inv.color,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    };
  }

  private emitBoth(inv: Invite, event: string) {
    this.io.to(`user:${inv.fromId}`).to(`user:${inv.toId}`).emit(event, this.payload(inv));
  }

  pendingFor(userId: string) {
    return [...this.invites.values()]
      .filter((i) => i.fromId === userId || i.toId === userId)
      .map((i) => this.payload(i));
  }

  send(fromId: string, input: InviteInput) {
    const tc = getTimeControl(input.timeControl);
    if (!tc) return { error: 'Ritmo de jogo inválido.' };
    const to = this.db.getUser(input.toUserId);
    if (!to || to.id === fromId) return { error: 'Jogador não encontrado.' };

    const rematch = input.rematchOf ? this.db.getGame(input.rematchOf) : undefined;
    const isRematch =
      !!rematch && [rematch.white, rematch.black].includes(fromId) && [rematch.white, rematch.black].includes(to.id);
    if (!isRematch && !this.db.areFriends(fromId, to.id)) {
      return { error: 'Você só pode convidar amigos.' };
    }
    if (!this.presence.isOnline(to.id)) return { error: `${to.username} está offline.` };
    if (this.presence.gameOf(to.id)) return { error: `${to.username} está em uma partida.` };
    if (this.presence.gameOf(fromId)) return { error: 'Termine sua partida atual primeiro.' };

    // Um convite pendente por par de jogadores.
    for (const inv of this.invites.values()) {
      if (inv.fromId === fromId && inv.toId === to.id) this.remove(inv, 'invite:cancelled');
      if (inv.fromId === to.id && inv.toId === fromId && inv.timeControl.id === tc.id) {
        // O outro já tinha convidado com o mesmo ritmo: inicia direto.
        return this.accept(fromId, inv.id);
      }
    }

    const now = Date.now();
    const inv: Invite = {
      id: crypto.randomUUID(),
      fromId,
      toId: to.id,
      timeControl: tc,
      rated: input.rated ?? false,
      color: input.color ?? 'random',
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      timer: setTimeout(() => this.expire(inv), INVITE_TTL_MS),
    };
    this.invites.set(inv.id, inv);
    this.io.to(`user:${to.id}`).emit('invite:received', this.payload(inv));
    return { ok: true, invite: this.payload(inv) };
  }

  private expire(inv: Invite) {
    this.remove(inv, 'invite:expired');
    const from = this.db.getUser(inv.fromId);
    if (!from) return;
    this.notifier.notify(inv.toId, {
      type: 'invite_missed',
      title: 'Desafio perdido',
      body: `${from.username} te desafiou para uma partida ${inv.timeControl.id}. Que tal chamar de volta?`,
      data: { userId: from.id },
    });
  }

  private remove(inv: Invite, event: string | null) {
    clearTimeout(inv.timer);
    this.invites.delete(inv.id);
    if (event) this.emitBoth(inv, event);
  }

  accept(userId: string, inviteId: string) {
    const inv = this.invites.get(inviteId);
    if (!inv || inv.toId !== userId) return { error: 'Convite não encontrado ou expirado.' };
    if (this.presence.gameOf(inv.fromId) || this.presence.gameOf(inv.toId)) {
      this.remove(inv, 'invite:cancelled');
      return { error: 'Um dos jogadores já está em outra partida.' };
    }
    if (!this.presence.isOnline(inv.fromId)) {
      this.remove(inv, 'invite:cancelled');
      return { error: 'Quem convidou ficou offline.' };
    }
    this.remove(inv, null);
    this.matchmaker.leave(inv.fromId);
    this.matchmaker.leave(inv.toId);
    // Cancela outros convites dos dois jogadores.
    for (const other of [...this.invites.values()]) {
      if ([other.fromId, other.toId].some((id) => id === inv.fromId || id === inv.toId)) {
        this.remove(other, 'invite:cancelled');
      }
    }
    const fromIsWhite = inv.color === 'random' ? Math.random() < 0.5 : inv.color === 'white';
    const [white, black] = fromIsWhite ? [inv.fromId, inv.toId] : [inv.toId, inv.fromId];
    const game = this.games.create(white, black, inv.timeControl, inv.rated);
    return { ok: true, gameId: game.id };
  }

  decline(userId: string, inviteId: string) {
    const inv = this.invites.get(inviteId);
    if (!inv || (inv.toId !== userId && inv.fromId !== userId)) return { error: 'Convite não encontrado.' };
    this.remove(inv, inv.toId === userId ? 'invite:declined' : 'invite:cancelled');
    return { ok: true };
  }

  /** Usuário ficou offline: cancela os convites que enviou. */
  userOffline(userId: string) {
    for (const inv of [...this.invites.values()]) {
      if (inv.fromId === userId) this.remove(inv, 'invite:cancelled');
    }
  }

  shutdown() {
    for (const inv of this.invites.values()) clearTimeout(inv.timer);
  }
}

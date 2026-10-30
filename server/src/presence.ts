/** Rastreia quem está online (pode ter várias conexões) e quem está em partida. */
export class Presence {
  private sockets = new Map<string, Set<string>>();
  private games = new Map<string, string>();

  connect(userId: string, socketId: string) {
    const set = this.sockets.get(userId) ?? new Set();
    const wasOnline = set.size > 0;
    set.add(socketId);
    this.sockets.set(userId, set);
    return !wasOnline;
  }

  /** Retorna true se o usuário ficou offline (última conexão encerrada). */
  disconnect(userId: string, socketId: string) {
    const set = this.sockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.sockets.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string) {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  setGame(userId: string, gameId: string | null) {
    if (gameId) this.games.set(userId, gameId);
    else this.games.delete(userId);
  }

  gameOf(userId: string) {
    return this.games.get(userId) ?? null;
  }

  status(userId: string) {
    return { online: this.isOnline(userId), inGame: this.games.has(userId) };
  }
}

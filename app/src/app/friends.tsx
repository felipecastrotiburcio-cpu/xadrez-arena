import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Segmented, TimeControlPicker } from '../components/TimeControlPicker';
import { Avatar, Button, Card, EmptyState, LevelBadge, Screen, SectionTitle } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { colors, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
import type { FriendEntry, FriendshipStatus, PublicUser } from '../lib/types';

type Tab = 'friends' | 'requests' | 'add';

export default function Friends() {
  const { user, token } = useAuth();
  const { friendsVersion, presence, invites, emit } = useSocket();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('friends');
  const [data, setData] = useState<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] } | null>(null);
  const [challenge, setChallenge] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await api('/friends'));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [toast, token]);

  useEffect(() => {
    load();
  }, [load, friendsVersion]);

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success, 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (!user) return null;
  const outgoingInvites = invites.filter((i) => i.from.id === user.id);
  const requestCount = data?.incoming.length ?? 0;

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: `Amigos${data ? ` (${data.friends.length})` : ''}` },
          { value: 'requests', label: `Pedidos${requestCount ? ` (${requestCount})` : ''}` },
          { value: 'add', label: 'Adicionar' },
        ]}
      />

      {outgoingInvites.map((inv) => (
        <Card key={inv.id} style={styles.inviteCard}>
          <Text style={styles.text}>
            Aguardando {inv.to.username} aceitar ({inv.timeControl.id})…
          </Text>
          <Button small variant="secondary" title="Cancelar" onPress={() => emit('invite:decline', { inviteId: inv.id })} />
        </Card>
      ))}

      {tab === 'friends' &&
        (data?.friends.length === 0 ? (
          <EmptyState icon="👥" text="Você ainda não tem amigos. Toque em “Adicionar” para buscar jogadores." />
        ) : (
          data?.friends.map((f) => {
            const status = presence[f.user.id] ?? { online: f.online, inGame: f.inGame };
            return (
              <UserRow
                key={f.user.id}
                user={f.user}
                online={status.online}
                status={status.inGame ? 'Em partida' : status.online ? 'Online' : 'Offline'}
              >
                <Button
                  small
                  title="Desafiar"
                  disabled={!status.online || status.inGame}
                  onPress={() => setChallenge(f.user)}
                />
              </UserRow>
            );
          })
        ))}

      {tab === 'requests' && data && (
        <>
          <SectionTitle>Recebidos</SectionTitle>
          {data.incoming.length === 0 && <Text style={styles.muted}>Nenhum pedido pendente.</Text>}
          {data.incoming.map((f) => (
            <UserRow key={f.requestId} user={f.user} status="quer ser seu amigo">
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button
                  small
                  variant="secondary"
                  title="✕"
                  onPress={() => act(() => api(`/friends/requests/${f.requestId}`, { method: 'DELETE' }))}
                />
                <Button
                  small
                  title="Aceitar"
                  onPress={() =>
                    act(
                      () => api(`/friends/requests/${f.requestId}/accept`, { method: 'POST' }),
                      `Agora você e ${f.user.username} são amigos!`,
                    )
                  }
                />
              </View>
            </UserRow>
          ))}
          <SectionTitle>Enviados</SectionTitle>
          {data.outgoing.length === 0 && <Text style={styles.muted}>Nenhum pedido enviado.</Text>}
          {data.outgoing.map((f) => (
            <UserRow key={f.requestId} user={f.user} status="aguardando resposta">
              <Button
                small
                variant="secondary"
                title="Cancelar"
                onPress={() => act(() => api(`/friends/requests/${f.requestId}`, { method: 'DELETE' }))}
              />
            </UserRow>
          ))}
        </>
      )}

      {tab === 'add' && <AddFriend onChanged={load} />}

      <ChallengeModal user={challenge} onClose={() => setChallenge(null)} />
    </Screen>
  );
}

function UserRow({
  user,
  status,
  online,
  children,
}: {
  user: PublicUser;
  status: string;
  online?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable onPress={() => router.push(`/profile/${user.id}`)} style={styles.row}>
      <Avatar name={user.username} online={online} icon={user.cosmetics?.avatar} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {user.username} <Text style={styles.muted}>{user.rating}</Text>
        </Text>
        <LevelBadge level={user.level} name={user.levelName} compact />
        <Text style={[styles.muted, online && status === 'Online' && { color: colors.success }]}>{status}</Text>
      </View>
      {children}
    </Pressable>
  );
}

function AddFriend({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<(PublicUser & { friendship: FriendshipStatus })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setResults(r.users);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, toast]);

  const add = async (u: PublicUser) => {
    try {
      const r = await api('/friends/requests', { body: { userId: u.id } });
      setResults((list) =>
        list.map((x) => (x.id === u.id ? { ...x, friendship: { status: r.status, id: r.id } } : x)),
      );
      toast(r.status === 'friends' ? `Agora você e ${u.username} são amigos!` : 'Pedido enviado!', 'success');
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const LABEL = { friends: 'Amigos ✓', outgoing: 'Enviado', incoming: 'Aceitar', none: 'Adicionar' };

  return (
    <>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder="Buscar pelo nome de usuário"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && <Text style={styles.muted}>Buscando…</Text>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <Text style={styles.muted}>Nenhum jogador encontrado.</Text>
      )}
      {results.map((u) => (
        <UserRow key={u.id} user={u} status={`${u.gamesPlayed} partidas`}>
          <Button
            small
            title={LABEL[u.friendship.status]}
            variant={u.friendship.status === 'none' || u.friendship.status === 'incoming' ? 'primary' : 'secondary'}
            disabled={u.friendship.status === 'friends' || u.friendship.status === 'outgoing'}
            onPress={() => add(u)}
          />
        </UserRow>
      ))}
    </>
  );
}

function ChallengeModal({ user, onClose }: { user: PublicUser | null; onClose: () => void }) {
  const { emit } = useSocket();
  const toast = useToast();
  const [timeControl, setTimeControl] = useState('5+0');
  const [color, setColor] = useState<'white' | 'random' | 'black'>('random');
  const [rated, setRated] = useState<'rated' | 'casual'>('casual');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!user) return;
    setSending(true);
    const r = await emit('invite:send', { toUserId: user.id, timeControl, color, rated: rated === 'rated' });
    setSending(false);
    if (r.error) toast(r.error, 'error');
    else {
      toast(`Convite enviado para ${user.username}!`, 'success');
      onClose();
    }
  };

  return (
    <Modal visible={!!user} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Desafiar {user?.username}</Text>
          <SectionTitle>Ritmo</SectionTitle>
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
          <SectionTitle>Suas peças</SectionTitle>
          <Segmented
            value={color}
            onChange={setColor}
            options={[
              { value: 'white', label: '♔ Brancas' },
              { value: 'random', label: '🎲 Sortear' },
              { value: 'black', label: '♚ Pretas' },
            ]}
          />
          <SectionTitle>Tipo</SectionTitle>
          <Segmented
            value={rated}
            onChange={setRated}
            options={[
              { value: 'casual', label: 'Amistosa' },
              { value: 'rated', label: 'Ranqueada' },
            ]}
          />
          <Button title="Enviar convite" icon="⚔️" onPress={send} loading={sending} style={{ marginTop: 8 }} />
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text, fontSize: 14, flex: 1 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', borderColor: colors.accent },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
});

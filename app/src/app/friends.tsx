import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Segmented, TimeControlPicker } from '../components/TimeControlPicker';
import { Avatar, Button, Card, EmptyState, LevelBadge, Screen, SectionTitle } from '../components/ui';
import { api, isLocalMode } from '../lib/api';
import { ONLINE_ONLY } from '../lib/localDevice';
import { useAuth } from '../lib/auth';
import { translateServerText, useT } from '../lib/i18n';
import { useSocket } from '../lib/socket';
import { colors, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
import type { FriendEntry, FriendshipStatus, PublicUser } from '../lib/types';
import { Flag } from '../components/Flag';

type Tab = 'friends' | 'requests' | 'add';

export default function Friends() {
  const { user, token } = useAuth();
  const { friendsVersion, presence, invites, emit } = useSocket();
  const toast = useToast();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('friends');
  const [data, setData] = useState<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] } | null>(null);
  const [challenge, setChallenge] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    if (!token || isLocalMode()) return;
    try {
      setData(await api('/friends'));
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
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
      toast(translateServerText((e as Error).message), 'error');
    }
  };

  if (!user) return null;
  if (isLocalMode()) {
    return (
      <Screen>
        <EmptyState icon="🌐" text={translateServerText(ONLINE_ONLY)} />
      </Screen>
    );
  }
  const outgoingInvites = invites.filter((i) => i.from.id === user.id);
  const requestCount = data?.incoming.length ?? 0;

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: `${t('friends.tabFriends')}${data ? ` (${data.friends.length})` : ''}` },
          { value: 'requests', label: `${t('friends.tabRequests')}${requestCount ? ` (${requestCount})` : ''}` },
          { value: 'add', label: t('friends.tabAdd') },
        ]}
      />

      {outgoingInvites.map((inv) => (
        <Card key={inv.id} style={styles.inviteCard}>
          <Text style={styles.text}>{t('friends.waiting', { name: inv.to.username, tc: inv.timeControl.id })}</Text>
          <Button small variant="secondary" title={t('common.cancel')} onPress={() => emit('invite:decline', { inviteId: inv.id })} />
        </Card>
      ))}

      {tab === 'friends' &&
        (data?.friends.length === 0 ? (
          <EmptyState icon="👥" text={t('friends.none')} />
        ) : (
          data?.friends.map((f) => {
            const status = presence[f.user.id] ?? { online: f.online, inGame: f.inGame };
            return (
              <UserRow
                key={f.user.id}
                user={f.user}
                online={status.online}
                status={status.inGame ? t('friends.inGame') : status.online ? t('friends.online') : t('friends.offline')}
              >
                <Button
                  small
                  title={t('friends.challenge')}
                  disabled={!status.online || status.inGame}
                  onPress={() => setChallenge(f.user)}
                />
              </UserRow>
            );
          })
        ))}

      {tab === 'requests' && data && (
        <>
          <SectionTitle>{t('friends.received')}</SectionTitle>
          {data.incoming.length === 0 && <Text style={styles.muted}>{t('friends.noPending')}</Text>}
          {data.incoming.map((f) => (
            <UserRow key={f.requestId} user={f.user} status={t('friends.wantsToBeFriend')}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button
                  small
                  variant="secondary"
                  title="✕"
                  onPress={() => act(() => api(`/friends/requests/${f.requestId}`, { method: 'DELETE' }))}
                />
                <Button
                  small
                  title={t('common.accept')}
                  onPress={() =>
                    act(
                      () => api(`/friends/requests/${f.requestId}/accept`, { method: 'POST' }),
                      t('friends.nowFriends', { name: f.user.username }),
                    )
                  }
                />
              </View>
            </UserRow>
          ))}
          <SectionTitle>{t('friends.sent')}</SectionTitle>
          {data.outgoing.length === 0 && <Text style={styles.muted}>{t('friends.noSent')}</Text>}
          {data.outgoing.map((f) => (
            <UserRow key={f.requestId} user={f.user} status={t('friends.awaitingReply')}>
              <Button
                small
                variant="secondary"
                title={t('common.cancel')}
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
  const { t } = useT();
  return (
    <Pressable onPress={() => router.push(`/profile/${user.id}`)} style={styles.row}>
      <Avatar name={user.username} online={online} icon={user.cosmetics?.avatar} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {user.username} <Flag code={user.country} size={14} /> <Text style={styles.muted}>{user.rating}</Text>
        </Text>
        <LevelBadge level={user.level} name={user.levelName} compact />
        <Text style={[styles.muted, online && status === t('friends.online') && { color: colors.success }]}>{status}</Text>
      </View>
      {children}
    </Pressable>
  );
}

function AddFriend({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const { t } = useT();
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
        toast(translateServerText((e as Error).message), 'error');
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
      toast(r.status === 'friends' ? t('friends.nowFriends', { name: u.username }) : t('friends.requestSent'), 'success');
      onChanged();
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    }
  };

  const LABEL = {
    friends: t('friends.labelFriends'),
    outgoing: t('friends.labelOutgoing'),
    incoming: t('common.accept'),
    none: t('friends.tabAdd'),
  };

  return (
    <>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder={t('friends.searchPh')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && <Text style={styles.muted}>{t('friends.searching')}</Text>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <Text style={styles.muted}>{t('friends.noPlayers')}</Text>
      )}
      {results.map((u) => (
        <UserRow key={u.id} user={u} status={t('friends.games', { count: u.gamesPlayed })}>
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
  const { t } = useT();
  const [timeControl, setTimeControl] = useState('5+0');
  const [color, setColor] = useState<'white' | 'random' | 'black'>('random');
  const [rated, setRated] = useState<'rated' | 'casual'>('casual');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!user) return;
    setSending(true);
    const r = await emit('invite:send', { toUserId: user.id, timeControl, color, rated: rated === 'rated' });
    setSending(false);
    if (r.error) toast(translateServerText(r.error), 'error');
    else {
      toast(t('friends.inviteSent', { name: user.username }), 'success');
      onClose();
    }
  };

  return (
    <Modal visible={!!user} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{t('friends.challengeTitle', { name: user?.username ?? '' })}</Text>
          <SectionTitle>{t('friends.pace')}</SectionTitle>
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
          <SectionTitle>{t('friends.yourPieces')}</SectionTitle>
          <Segmented
            value={color}
            onChange={setColor}
            options={[
              { value: 'white', label: t('common.white') },
              { value: 'random', label: t('common.random') },
              { value: 'black', label: t('common.black') },
            ]}
          />
          <SectionTitle>{t('friends.type')}</SectionTitle>
          <Segmented
            value={rated}
            onChange={setRated}
            options={[
              { value: 'casual', label: t('common.casual') },
              { value: 'rated', label: t('common.rated') },
            ]}
          />
          <Button title={t('friends.sendInvite')} icon="⚔️" onPress={send} loading={sending} style={{ marginTop: 8 }} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
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

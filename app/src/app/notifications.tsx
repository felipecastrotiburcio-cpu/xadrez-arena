import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Screen } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { colors, radius } from '../lib/theme';
import type { AppNotification } from '../lib/types';

const ICON: Record<AppNotification['type'], string> = {
  welcome: '🎉',
  friend_request: '👋',
  friend_accepted: '🤝',
  invite_missed: '⚔️',
  game_result: '♟',
  level_up: '⬆️',
  reward: '🎁',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export default function Notifications() {
  const { token } = useAuth();
  const { unreadNotifications, setUnreadNotifications } = useSocket();
  const [list, setList] = useState<AppNotification[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ notifications: AppNotification[]; unread: number }>('/notifications');
    setList(r.notifications);
    setUnreadNotifications(r.unread);
  }, [token, setUnreadNotifications]);

  // Recarrega ao abrir e quando chega notificação nova com a tela aberta.
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load, unreadNotifications]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markRead = async (id?: string) => {
    const r = await api<{ unread: number }>('/notifications/read', { body: id ? { id } : {} });
    setUnreadNotifications(r.unread);
    setList((l) => l?.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) ?? null);
  };

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id).catch(() => {});
    if (n.type === 'friend_request') router.push('/friends');
    else if (n.type === 'reward' || n.type === 'welcome' || n.type === 'level_up') router.push('/shop');
    else if (n.data.userId) router.push(`/profile/${n.data.userId}`);
  };

  return (
    <Screen>
      {!!list?.some((n) => !n.read) && (
        <Button small variant="secondary" title="Marcar todas como lidas" onPress={() => markRead()} />
      )}
      {list?.length === 0 && <EmptyState icon="🔔" text="Nenhuma notificação por enquanto." />}
      {list?.map((n) => (
        <Pressable key={n.id} onPress={() => open(n)} style={[styles.row, !n.read && styles.unread]}>
          <Text style={styles.icon}>{ICON[n.type] ?? '🔔'}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{n.title}</Text>
            <Text style={styles.body}>{n.body}</Text>
            <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
          </View>
          {!n.read && <View style={styles.dot} />}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { borderColor: colors.accent, backgroundColor: '#25231d' },
  icon: { fontSize: 26 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  body: { color: colors.textMuted, fontSize: 14 },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});

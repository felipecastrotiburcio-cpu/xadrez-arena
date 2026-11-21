import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Screen } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { translateServerText, tStatic, useT } from '../lib/i18n';
import { useSocket } from '../lib/socket';
import { colors, radius, fonts } from '../lib/theme';
import type { AppNotification } from '../lib/types';

const ICON: Record<AppNotification['type'], IconName> = {
  welcome: 'sparkle',
  friend_request: 'users',
  friend_accepted: 'users',
  invite_missed: 'swords',
  game_result: 'knight',
  level_up: 'trophy',
  reward: 'gift',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return tStatic('notif.now');
  if (s < 3600) return tStatic('notif.minAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return tStatic('notif.hAgo', { n: Math.floor(s / 3600) });
  return tStatic('notif.dAgo', { n: Math.floor(s / 86400) });
}

export default function Notifications() {
  const { token } = useAuth();
  const { unreadNotifications, setUnreadNotifications } = useSocket();
  const [list, setList] = useState<AppNotification[] | null>(null);
  const { t } = useT();

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
        <Button small variant="secondary" title={t('notif.markAll')} onPress={() => markRead()} />
      )}
      {list?.length === 0 && <EmptyState iconName="bell" text={t('notif.empty')} />}
      {list?.map((n) => (
        <Pressable key={n.id} onPress={() => open(n)} style={[styles.row, !n.read && styles.unread]}>
          <View style={[styles.icon, !n.read && { backgroundColor: colors.accentSoft }]}>
            <Icon name={ICON[n.type] ?? 'bell'} size={19} color={n.read ? colors.textMuted : colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{translateServerText(n.title)}</Text>
            <Text style={styles.body}>{translateServerText(n.body)}</Text>
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
  unread: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 15 },
  body: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  time: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, EmptyState, LevelBadge, Screen } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { translateServerText, useT } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import type { PublicUser } from '../lib/types';

type Row = PublicUser & { rank: number; online: boolean };
const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { user, token } = useAuth();
  const [players, setPlayers] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const { t } = useT();

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api<{ players: Row[] }>('/leaderboard')
        .then((r) => setPlayers(r.players))
        .catch((e) => setError(translateServerText(e.message)));
    }, [token]),
  );

  return (
    <Screen>
      {error ? <Text style={styles.muted}>{error}</Text> : null}
      {players?.length === 0 && <EmptyState icon="🏆" text={t('lb.empty')} />}
      {players?.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/profile/${p.id}`)}
          style={[styles.row, p.id === user?.id && { borderColor: colors.accent }]}
        >
          <Text style={styles.rank}>{MEDALS[p.rank - 1] ?? p.rank}</Text>
          <Avatar name={p.username} size={38} online={p.online} icon={p.cosmetics?.avatar} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name}>{p.username}</Text>
            <LevelBadge level={p.level} name={p.levelName} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rating}>{p.rating}</Text>
            <Text style={styles.muted}>{t('lb.record', { w: p.wins, d: p.draws, l: p.losses })}</Text>
          </View>
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
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rank: { color: colors.textMuted, fontSize: 18, fontWeight: '800', width: 30, textAlign: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rating: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 12 },
});

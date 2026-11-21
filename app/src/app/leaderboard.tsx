import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, EmptyState, LevelBadge, Screen } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { translateServerText, useT } from '../lib/i18n';
import { colors, radius, fonts } from '../lib/theme';
import type { PublicUser } from '../lib/types';
import { Flag } from '../components/Flag';

type Row = PublicUser & { rank: number; online: boolean };
/** Ouro, prata e bronze para os três primeiros. */
const MEDALS = ['#dcab4f', '#b8b4ac', '#b07a4f'];

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
      {players?.length === 0 && <EmptyState iconName="trophy" text={t('lb.empty')} />}
      {players?.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/profile/${p.id}`)}
          style={[styles.row, p.id === user?.id && { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]}
        >
          <View style={[styles.rankBox, MEDALS[p.rank - 1] ? { borderColor: MEDALS[p.rank - 1] } : null]}>
            <Text style={[styles.rank, MEDALS[p.rank - 1] ? { color: MEDALS[p.rank - 1] } : null]}>{p.rank}</Text>
          </View>
          <Avatar name={p.username} size={38} online={p.online} icon={p.cosmetics?.avatar} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name}>
              {p.username} <Flag code={p.country} size={14} />
            </Text>
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
  rankBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  rank: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.black, fontVariant: ['tabular-nums'] },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  rating: { color: colors.text, fontSize: 22, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
});

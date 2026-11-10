import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, LevelBadge, Screen, SectionTitle } from '../../components/ui';
import { api, isLocalMode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { levelName, reasonText, translateServerText, useT } from '../../lib/i18n';
import { levelProgress, LEVELS } from '../../lib/levels';
import { useSocket } from '../../lib/socket';
import { colors } from '../../lib/theme';
import { useToast } from '../../lib/toast';
import type { FriendshipStatus, GameSummary, PublicUser } from '../../lib/types';

interface Profile {
  user: PublicUser;
  rank: number | null;
  online: boolean;
  inGame: boolean;
  friendship: FriendshipStatus;
  games: GameSummary[];
}

const OUTCOME = {
  win: { label: 'profile.win', color: colors.success },
  loss: { label: 'profile.loss', color: colors.danger },
  draw: { label: 'profile.draw', color: colors.textMuted },
} as const;

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me, token } = useAuth();
  const { friendsVersion } = useSocket();
  const navigation = useNavigation();
  const toast = useToast();
  const { t, locale } = useT();
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api<Profile>(`/users/${id}`)
      .then((p) => {
        setProfile(p);
        navigation.setOptions({ title: p.user.username });
      })
      .catch((e) => toast(translateServerText(e.message), 'error'));
  }, [id, navigation, toast, token]);

  useEffect(load, [load, friendsVersion]);

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const { user, friendship } = profile;
  const isMe = me?.id === user.id;
  const lp = levelProgress(user.rating);
  const winRate = user.gamesPlayed ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  const friendAction = async () => {
    try {
      if (friendship.status === 'none') await api('/friends/requests', { body: { userId: user.id } });
      else if (friendship.status === 'incoming') await api(`/friends/requests/${friendship.id}/accept`, { method: 'POST' });
      else await api(`/friends/requests/${friendship.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    }
  };

  const FRIEND_LABEL = {
    none: t('profile.addFriend'),
    incoming: t('profile.acceptRequest'),
    outgoing: t('profile.cancelRequest'),
    friends: t('profile.unfriend'),
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Avatar name={user.username} size={80} online={profile.online} icon={user.cosmetics?.avatar} />
        <Text style={styles.name}>{user.username}</Text>
        <LevelBadge level={user.level} name={user.levelName} />
        <Text style={styles.rating}>{user.rating}</Text>
        <Text style={styles.muted}>
          {profile.rank ? t('profile.rank', { rank: profile.rank }) : ''}
          {t('profile.peak', { n: user.peakRating })}
          {profile.inGame ? t('profile.playingNow') : ''}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(lp.progress * 100)}%` }]} />
        </View>
        <Text style={styles.muted}>
          {lp.next
            ? t('profile.nextLevel', { name: levelName(lp.next.level, lp.next.name), rating: lp.next.minRating })
            : t('profile.maxLevel')}
        </Text>
      </Card>

      <View style={styles.stats}>
        <Stat label={t('profile.games')} value={user.gamesPlayed} />
        <Stat label={t('profile.wins')} value={user.wins} color={colors.success} />
        <Stat label={t('profile.draws')} value={user.draws} />
        <Stat label={t('profile.losses')} value={user.losses} color={colors.danger} />
        <Stat label={t('profile.winRate')} value={`${winRate}%`} />
      </View>

      {!isMe && !isLocalMode() && (
        <Button
          title={FRIEND_LABEL[friendship.status]}
          variant={friendship.status === 'friends' || friendship.status === 'outgoing' ? 'secondary' : 'primary'}
          onPress={friendAction}
        />
      )}
      {isMe && <Button title={t('profile.manageFriends')} variant="secondary" onPress={() => router.push('/friends')} />}

      <SectionTitle>{t('profile.recentGames')}</SectionTitle>
      {profile.games.length === 0 && <Text style={styles.muted}>{t('profile.noGames')}</Text>}
      {profile.games.map((g) => (
        <Card key={g.id} style={styles.game}>
          <View style={[styles.outcomeBar, { backgroundColor: OUTCOME[g.outcome].color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gameTitle}>
              {t(OUTCOME[g.outcome].label)} vs {g.opponent?.username ?? translateServerText(g.opponentName) ?? '—'}
            </Text>
            <Text style={styles.muted}>
              {g.color === 'white' ? '♔' : '♚'} {g.timeControl} · {reasonText(g.reason)} · {new Date(g.endedAt).toLocaleDateString(locale)}
            </Text>
          </View>
          {g.rated && (
            <Text style={[styles.delta, { color: g.ratingChange >= 0 ? colors.success : colors.danger }]}>
              {g.ratingChange >= 0 ? '+' : ''}
              {g.ratingChange}
            </Text>
          )}
        </Card>
      ))}

      {isMe && (
        <>
          <SectionTitle>{t('profile.levels')}</SectionTitle>
          <Card style={{ gap: 6 }}>
            {LEVELS.map((l) => (
              <Text key={l.level} style={[styles.levelRow, l.level === user.level && { color: colors.accent, fontWeight: '800' }]}>
                {t('common.lv')} {l.level} · {levelName(l.level, l.name)} — {l.minRating}+
              </Text>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  name: { color: colors.text, fontSize: 24, fontWeight: '900' },
  rating: { color: colors.accent, fontSize: 40, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  track: { height: 8, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  outcomeBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  gameTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  delta: { fontWeight: '900', fontSize: 16 },
  levelRow: { color: colors.textMuted, fontSize: 14 },
});

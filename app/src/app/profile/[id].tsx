import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, LevelBadge, Screen, SectionTitle } from '../../components/ui';
import { api, isLocalMode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { levelName, reasonText, translateServerText, useT, type TranslationKey } from '../../lib/i18n';
import { levelProgress, LEVELS } from '../../lib/levels';
import { useSocket } from '../../lib/socket';
import { colors, fonts } from '../../lib/theme';
import { useToast } from '../../lib/toast';
import type { FriendshipStatus, GameSummary, PrivateUser, PublicUser } from '../../lib/types';
import { Emblem } from '../../components/Emblem';
import { BADGES } from '../../lib/badges';
import { useCosmetics } from '../../lib/cosmetics';
import { itemName } from '../../lib/catalogI18n';
import { Flag } from '../../components/Flag';

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
  const { user: me, token, setUser } = useAuth();
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
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {user.username} <Flag code={user.country} size={22} />
          </Text>
          {(isMe ? me?.badge : user.badge) ? <Emblem id={(isMe ? me?.badge : user.badge)!} size={30} /> : null}
        </View>
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

      {isMe && <Button title={t('me.edit')} iconName="pencil" variant="secondary" onPress={() => router.push('/me')} />}

      <SectionTitle>{t('badges.title')}</SectionTitle>
      <Emblems
        owned={(isMe ? me?.badges : user.badges) ?? []}
        selected={(isMe ? me?.badge : user.badge) ?? null}
        mine={isMe}
        onSelect={async (badge) => {
          try {
            const r = await api<{ user: PrivateUser }>('/badges/select', { body: { badge } });
            setUser(r.user);
            toast(badge ? t('badges.showing') : t('badges.hidden'), 'success');
          } catch (e) {
            toast(translateServerText((e as Error).message), 'error');
          }
        }}
      />

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
              <Text key={l.level} style={[styles.levelRow, l.level === user.level && { color: colors.accent, fontFamily: fonts.black }]}>
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

/** Os 5 emblemas (um por IA): conquistados em cores, os outros com cadeado e o que fazer para ganhar. */
function Emblems({ owned, selected, mine, onSelect }: { owned: string[]; selected: string | null; mine: boolean; onSelect: (badge: string | null) => void }) {
  const { t, lang } = useT();
  const { get } = useCosmetics();
  return (
    <Card style={{ gap: 4 }}>
      {mine && <Text style={styles.muted}>{owned.length ? t('badges.tapToShow') : t('badges.howTo')}</Text>}
      {BADGES.map((b) => {
        const has = owned.includes(b.id);
        const on = selected === b.id;
        const reward = get(b.rewardId);
        const ai = t(`ai.${b.level}.name` as TranslationKey);
        return (
          <Pressable
            key={b.id}
            disabled={!mine || !has}
            onPress={() => onSelect(on ? null : b.id)}
            style={[styles.emblemRow, on && styles.emblemOn]}
          >
            <Emblem id={b.id} size={46} locked={!has} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.emblemName, !has && { color: colors.textMuted }]}>{ai}</Text>
              <Text style={styles.emblemSub}>
                {has ? (on ? t('badges.showingShort') : t('badges.earned')) : t('badges.beat', { name: ai })}
              </Text>
              {reward ? <Text style={styles.emblemReward}>{t('badges.reward', { item: itemName(reward, lang) })}</Text> : null}
            </View>
            {on && <Text style={styles.onChip}>{t('badges.showingShort')}</Text>}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emblemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  emblemOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  emblemName: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  emblemSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12.5 },
  emblemReward: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12 },
  onChip: { color: colors.accentText, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontFamily: fonts.black, fontSize: 11, overflow: 'hidden' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  name: { color: colors.text, fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.3 },
  rating: { color: colors.text, fontSize: 48, fontFamily: fonts.display, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  track: { height: 4, alignSelf: 'stretch', backgroundColor: colors.raised, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', backgroundColor: colors.accent },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 22, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  outcomeBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  gameTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  delta: { fontFamily: fonts.black, fontSize: 16 },
  levelRow: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
});

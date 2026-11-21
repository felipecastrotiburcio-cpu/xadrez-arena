import { useMemo } from 'react';
import { router, useIsFocused } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterThumb } from '../components/Character';
import { Button, Coins, Screen } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCharacterStyle, useMyLook } from '../lib/cosmetics';
import { levelName, useT } from '../lib/i18n';
import { levelProgress } from '../lib/levels';
import { useSocket } from '../lib/socket';
import { colors, fonts, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';
import { Flag } from '../components/Flag';

const HERO_BG = '#1d1a16';

export default function Home() {
  const { ready, user, rank } = useAuth();
  const { activeGame, invites, unreadNotifications } = useSocket();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const look = useMyLook();
  const { t } = useT();
  const character = useCharacterStyle(look.equipped.character);
  const factory = useMemo(
    () => createShowcaseScene({ look: character, board: look.board, bg: HERO_BG }),
    [character, look.board],
  );

  if (!ready) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const pendingInvites = invites.filter((i) => i.to.id === user?.id).length;
  // Sem servidor online, o botão principal leva à IA (que dá moedas para contas do aparelho).
  const local = isLocalMode();
  const playTarget = local ? '/ai' : user ? '/play' : '/login';
  const playSub = local
    ? user
      ? t('home.playSubLocalUser')
      : t('home.playSubLocalGuest')
    : user
      ? t('home.playSubOnlineUser')
      : t('home.playSubOnlineGuest');
  const lp = user ? levelProgress(user.rating) : null;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <Screen>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Icon name="knight" size={22} color={colors.accent} />
            <Text style={styles.logo}>Xadrez Arena</Text>
          </View>
          <View style={styles.headerActions}>
            {user && (
              <Pressable onPress={() => router.push('/shop')} accessibilityLabel={t('home.coinsA11y', { count: user.coins })}>
                <Coins amount={user.coins} />
              </Pressable>
            )}
            {user && (
              <Pressable
                onPress={() => router.push('/notifications')}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityLabel={t('nav.notifications')}
              >
                <Icon name="bell" size={20} />
                {unreadNotifications > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('nav.settings')}>
              <Icon name="gear" size={20} />
            </Pressable>
          </View>
        </View>

        {/* Destaque: seu boneco em 3D (só renderiza com a tela em foco, para poupar bateria) */}
        <View style={styles.hero}>
          <View style={styles.heroScene}>
            {focused && (
              <Scene3D
                key={look.equipped.character}
                factory={factory}
                style={StyleSheet.absoluteFill}
                fallback={<CharacterThumb look={character} size={170} />}
              />
            )}
          </View>
          <View style={styles.heroInfo}>
            {user && lp ? (
              <>
                <Text style={styles.username} numberOfLines={1}>
                  {user.country ? <Flag code={user.country} size={16} /> : null}
                  {user.country ? '  ' : ''}
                  {user.username}
                </Text>
                <Text style={styles.level}>
                  {t('common.lv')} {user.level} · {levelName(user.level, user.levelName)}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.rating}>{user.rating}</Text>
                  <Text style={styles.muted}>{rank ? t('home.rank', { rank }) : t('home.noRank')}</Text>
                </View>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${Math.max(4, Math.round(lp.progress * 100))}%` }]} />
                </View>
                <Text style={styles.faint}>
                  {lp.next ? t('home.ptsToNext', { pts: lp.next.minRating - user.rating, level: lp.next.level }) : t('home.maxLevel')}
                </Text>
                {user.winStreak > 0 && (
                  <View style={styles.streak}>
                    <Icon name="fire" size={13} color={colors.accent} strokeWidth={2} />
                    <Text style={styles.streakText}>{t('home.streak', { count: user.winStreak })}</Text>
                  </View>
                )}
                <Pressable onPress={() => router.push('/shop')} style={styles.customize} hitSlop={6}>
                  <Text style={styles.customizeText}>{t('home.customize')}</Text>
                  <Icon name="chevron" size={14} color={colors.accent} strokeWidth={2.2} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.guestTitle}>{t('home.buildCharacter')}</Text>
                <Text style={styles.mutedLight}>{t('home.guestPitch')}</Text>
                <Button small title={t('common.createAccount')} onPress={() => router.push('/login')} />
              </>
            )}
          </View>
        </View>

        {activeGame && (
          <Pressable onPress={() => router.push(`/game/${activeGame.id}`)} style={styles.liveGame} accessibilityRole="button">
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('home.backToGame')}</Text>
            <Icon name="chevron" size={16} color={colors.text} />
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push(playTarget)}
          accessibilityRole="button"
          testID="home-play"
          style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.playTitle}>{t('home.play')}</Text>
            <Text style={styles.playSub}>{playSub}</Text>
          </View>
          <View style={styles.playCircle}>
            <Icon name="play" size={20} color={colors.accent} />
          </View>
        </Pressable>

        <View style={styles.grid}>
          <Tile icon="cpu" title={t('home.aiTitle')} subtitle={t('home.aiSub')} onPress={() => router.push('/ai')} />
          <Tile
            icon="users"
            title={t('home.friendsTitle')}
            subtitle={local ? t('home.needsServer') : pendingInvites ? t('home.challenges', { count: pendingInvites }) : t('home.friendsSub')}
            locked={!user}
            dimmed={local}
            badge={pendingInvites}
            onPress={() => router.push('/friends')}
          />
          <Tile
            icon="trophy"
            title={t('home.rankingTitle')}
            subtitle={local ? t('home.rankingLocal') : t('home.rankingSub')}
            locked={!user}
            onPress={() => router.push('/leaderboard')}
          />
          <Tile
            icon="bag"
            title={t('home.shopTitle')}
            subtitle={user?.dailyBonusAvailable ? t('home.shopBonus') : t('home.shopSub')}
            locked={!user}
            badge={user?.dailyBonusAvailable ? 1 : 0}
            highlight={!!user?.dailyBonusAvailable}
            onPress={() => router.push('/shop')}
          />
        </View>
      </Screen>
    </View>
  );
}

function Tile({
  icon,
  title,
  subtitle,
  onPress,
  locked,
  badge,
  dimmed,
  highlight,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  locked?: boolean;
  badge?: number;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  const { t } = useT();
  return (
    <Pressable
      onPress={locked ? () => router.push('/login') : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, (locked || dimmed) && { opacity: 0.5 }, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={styles.tileTop}>
        <View style={styles.tileIcon}>
          <Icon name={locked ? 'lock' : icon} size={20} color={colors.accent} />
        </View>
        {!!badge && !locked && <View style={styles.dot} />}
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={[styles.tileSub, highlight && !locked && { color: colors.accent }]} numberOfLines={2}>
        {locked ? t('home.needsAccount') : subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logo: { color: colors.text, fontSize: 23, fontFamily: fonts.display, letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.black },
  hero: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 236,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroScene: { width: '44%', backgroundColor: HERO_BG },
  heroInfo: { flex: 1, paddingVertical: 18, paddingHorizontal: 16, gap: 3, justifyContent: 'center' },
  username: { color: colors.text, fontSize: 19, fontFamily: fonts.bold },
  level: { color: colors.accent, fontSize: 12, fontFamily: fonts.black, letterSpacing: 1, textTransform: 'uppercase' },
  rating: { color: colors.text, fontSize: 44, fontFamily: fonts.display, lineHeight: 48, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  faint: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.regular },
  guestTitle: { color: colors.text, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },
  mutedLight: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginBottom: 10, marginTop: 4 },
  xpTrack: { height: 4, backgroundColor: colors.raised, borderRadius: 2, overflow: 'hidden', marginTop: 12, marginBottom: 4 },
  xpFill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  streakText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12 },
  customize: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 12 },
  customizeText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 14 },
  liveGame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: 'rgba(95, 191, 138, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(95, 191, 138, 0.35)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingLeft: 22,
    paddingRight: 18,
    backgroundColor: colors.accent,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentText,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  playTitle: { color: colors.accentText, fontSize: 30, fontFamily: fonts.displayBold, letterSpacing: -0.5 },
  playSub: { color: 'rgba(27, 19, 6, 0.72)', fontSize: 14, fontFamily: fonts.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: 16,
    gap: 3,
    minHeight: 136,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'auto' },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, marginTop: 2 },
  tileTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.bold, marginTop: 14 },
  tileSub: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
});

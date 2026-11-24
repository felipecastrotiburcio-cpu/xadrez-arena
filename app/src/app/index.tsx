import { useMemo } from 'react';
import { router, useIsFocused } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterThumb } from '../components/Character';
import { Button, Coins, Screen } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useFullLook, useMyLook } from '../lib/cosmetics';
import { CATALOG } from '../lib/catalog';
import { levelName, useT } from '../lib/i18n';
import { levelProgress } from '../lib/levels';
import { useSocket } from '../lib/socket';
import { colors, fonts, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';
import { Flag } from '../components/Flag';
import { StarrySky } from '../components/StarrySky';
import { Emblem } from '../components/Emblem';
import { useTrainingSummary } from '../lib/training';

const HERO_BG = '#1f2a58';

export default function Home() {
  const { ready, user, rank } = useAuth();
  const { activeGame, invites, unreadNotifications } = useSocket();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const look = useMyLook();
  const { t } = useT();
  const character = useFullLook(look.equipped.character, look.equipped.evolution);
  const training = useTrainingSummary(user);
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
      <StarrySky />
      <Screen stars={false}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Icon name="moonFill" size={20} color={colors.accent} />
            </View>
            <Text style={styles.logo} numberOfLines={1}>
              Xadrez Arena
            </Text>
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
                <Icon name="bell" size={19} />
                {unreadNotifications > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('nav.settings')}>
              <Icon name="gear" size={19} />
            </Pressable>
          </View>
        </View>

        {/* Destaque: seu boneco em 3D sob o céu do clube (só renderiza com a tela em foco, para poupar bateria) */}
        <View style={styles.hero}>
          <StarrySky height={260} />
          <View style={styles.moon}>
            <Icon name="moonFill" size={30} color="#f8e7b0" />
          </View>
          <View style={styles.heroScene}>
            {focused && (
              <Scene3D
                key={`${look.equipped.character}-${look.equipped.evolution ?? ''}`}
                factory={factory}
                style={StyleSheet.absoluteFill}
                fallback={<CharacterThumb look={character} size={160} />}
              />
            )}
          </View>
          <View style={styles.heroInfo}>
            {user && lp ? (
              <>
                <View style={styles.nameRow}>
                  {user.country ? <Flag code={user.country} size={15} /> : null}
                  <Text style={styles.username} numberOfLines={1}>
                    {user.username}
                  </Text>
                  {user.badge ? <Emblem id={user.badge} size={24} /> : null}
                </View>
                <View style={styles.levelChip}>
                  <Icon name="starFill" size={12} color={colors.accent} />
                  <Text style={styles.levelText}>
                    {t('common.lv')} {user.level} · {levelName(user.level, user.levelName)}
                  </Text>
                </View>
                <Text style={styles.rating}>{user.rating}</Text>
                <Text style={styles.muted}>{rank ? t('home.rank', { rank }) : t('home.noRank')}</Text>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${Math.max(6, Math.round(lp.progress * 100))}%` }]} />
                </View>
                <Text style={styles.muted}>
                  {lp.next ? t('home.ptsToNext', { pts: lp.next.minRating - user.rating, level: lp.next.level }) : t('home.maxLevel')}
                </Text>
                {user.winStreak > 0 && (
                  <View style={styles.streak}>
                    <Icon name="fireFill" size={13} color={colors.coral} />
                    <Text style={styles.streakText}>{t('home.streak', { count: user.winStreak })}</Text>
                  </View>
                )}
                <Pressable testID="home-me" onPress={() => router.push('/me')} style={styles.customize} hitSlop={6}>
                  <Icon name="pencil" size={13} color={colors.accentText} strokeWidth={2.6} />
                  <Text style={styles.customizeText}>{t('home.customize')}</Text>
                  <Icon name="chevron" size={14} color={colors.accentText} strokeWidth={2.6} />
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

        {/* Destaque das Evoluções (some quando a pessoa já tem todas) */}
        {user && !CATALOG_EVOLUTIONS.every((id) => user.inventory.includes(id)) && (
          <Pressable
            testID="home-evolutions"
            onPress={() => router.push('/shop?tab=evolution')}
            style={({ pressed }) => [styles.evoPromo, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <View style={styles.evoPromoArt}>
              <CharacterThumb look={{ id: 'char_wizard', evolution: 'outfit_archmage' }} size={70} />
              <View style={{ marginLeft: -22 }}>
                <CharacterThumb look={{ id: 'char_king', evolution: 'outfit_emperor' }} size={78} />
              </View>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="sparkle" size={14} color="#ffc83d" strokeWidth={2.4} />
                <Text style={styles.evoPromoTitle}>{t('home.evoTitle')}</Text>
              </View>
              <Text style={styles.evoPromoSub}>{t('home.evoSub')}</Text>
            </View>
            <Icon name="chevron" size={18} color="#ffc83d" strokeWidth={2.6} />
          </Pressable>
        )}

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
          style={({ pressed }) => [styles.playButton, pressed && styles.pressedBig]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.playTitle}>{t('home.play')}</Text>
            <Text style={styles.playSub}>{playSub}</Text>
          </View>
          <View style={styles.playCircle}>
            <Icon name="play" size={22} color={colors.accent} />
          </View>
        </Pressable>

        {/* Treino diário: desafios de acordo com o rating */}
        <Pressable
          onPress={() => router.push('/train')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.train, pressed && styles.pressedCard]}
        >
          <View style={[styles.tileIcon, { backgroundColor: 'rgba(54, 209, 181, 0.16)' }]}>
            <Icon name="targetFill" size={24} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trainTitle}>{t('home.trainTitle')}</Text>
            <Text style={styles.trainSub}>
              {training.done >= training.total ? t('home.trainDone') : t('home.trainSub', { done: training.done, total: training.total })}
            </Text>
          </View>
          <View style={styles.trainDots}>
            {Array.from({ length: training.total }, (_, i) => (
              <View key={i} style={[styles.trainDot, i < training.done && styles.trainDotOn]}>
                {i < training.done && <Icon name="check" size={12} color={colors.accentText} strokeWidth={3} />}
              </View>
            ))}
          </View>
        </Pressable>

        <View style={styles.grid}>
          <Tile icon="robotFill" tint={colors.teal} title={t('home.aiTitle')} subtitle={t('home.aiSub')} onPress={() => router.push('/ai')} />
          <Tile
            icon="friendsFill"
            tint={colors.coral}
            title={t('home.friendsTitle')}
            subtitle={local ? t('home.needsServer') : pendingInvites ? t('home.challenges', { count: pendingInvites }) : t('home.friendsSub')}
            locked={!user}
            dimmed={local}
            badge={pendingInvites}
            onPress={() => router.push('/friends')}
          />
          <Tile
            icon="trophyFill"
            tint={colors.violet}
            title={t('home.rankingTitle')}
            subtitle={local ? t('home.rankingLocal') : t('home.rankingSub')}
            locked={!user}
            onPress={() => router.push('/leaderboard')}
          />
          <Tile
            icon="chestFill"
            tint={colors.accent}
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
  tint,
  title,
  subtitle,
  onPress,
  locked,
  badge,
  dimmed,
  highlight,
}: {
  icon: IconName;
  tint: string;
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
      style={({ pressed }) => [styles.tile, (locked || dimmed) && { opacity: 0.55 }, pressed && styles.pressedCard]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: `${tint}29` }]}>
          <Icon name={locked ? 'lockFill' : icon} size={26} color={tint} />
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

const card = {
  backgroundColor: colors.surface,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderBottomWidth: 5,
  borderBottomColor: colors.shadow,
} as const;

const CATALOG_EVOLUTIONS = CATALOG.filter((i) => i.type === 'evolution').map((i) => i.id);

const styles = StyleSheet.create({
  evoPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 200, 61, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 61, 0.55)',
    borderBottomWidth: 4,
  },
  evoPromoArt: { flexDirection: 'row', alignItems: 'flex-end', width: 92 },
  evoPromoTitle: { color: colors.text, fontFamily: fonts.black, fontSize: 16 },
  evoPromoSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logoMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 20, fontFamily: fonts.logo, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...card,
    borderBottomWidth: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.black },
  hero: {
    flexDirection: 'row',
    borderRadius: 26,
    overflow: 'hidden',
    minHeight: 246,
    ...card,
    backgroundColor: '#1f2a58',
  },
  moon: { position: 'absolute', left: 16, top: 14 },
  heroScene: { width: '44%' },
  heroInfo: { flex: 1, paddingVertical: 16, paddingRight: 14, paddingLeft: 4, gap: 2, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: colors.text, fontSize: 21, fontFamily: fonts.display, flexShrink: 1 },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 2,
  },
  levelText: { color: colors.accent, fontSize: 12, fontFamily: fonts.bold },
  rating: { color: colors.accent, fontSize: 46, fontFamily: fonts.displayBold, lineHeight: 52, marginTop: 4, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  guestTitle: { color: colors.text, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },
  mutedLight: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginBottom: 10, marginTop: 4 },
  xpTrack: { height: 10, backgroundColor: '#0e1530', borderRadius: 5, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  xpFill: { height: '100%', borderRadius: 5, backgroundColor: colors.accent },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(255, 127, 127, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  streakText: { color: '#ffb0b0', fontFamily: fonts.bold, fontSize: 12 },
  customize: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    borderBottomWidth: 3, borderBottomColor: colors.accentDark,
  },
  customizeText: { color: colors.accentText, fontFamily: fonts.black, fontSize: 13.5 },
  liveGame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: 'rgba(54, 209, 181, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(54, 209, 181, 0.4)',
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal },
  liveText: { flex: 1, color: colors.text, fontFamily: fonts.black, fontSize: 15 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    minHeight: 88,
    paddingLeft: 22,
    paddingRight: 16,
    backgroundColor: colors.accent,
    borderBottomWidth: 7,
    borderBottomColor: colors.accentDark,
  },
  pressedBig: { borderBottomWidth: 3, marginTop: 4, transform: [{ translateY: 0 }] },
  pressedCard: { borderBottomWidth: 2, marginTop: 3 },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentText,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  playTitle: { color: colors.accentText, fontSize: 34, fontFamily: fonts.displayBold, lineHeight: 40 },
  playSub: { color: '#5c3d00', fontSize: 14, fontFamily: fonts.bold },
  train: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 14, ...card },
  trainTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  trainSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  trainDots: { flexDirection: 'row', gap: 5 },
  trainDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainDotOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: 22, padding: 14, gap: 2, minHeight: 132, ...card },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'auto' },
  tileIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral, marginTop: 2 },
  tileTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display, marginTop: 12 },
  tileSub: { color: colors.textMuted, fontSize: 12.5, fontFamily: fonts.regular, lineHeight: 17 },
});

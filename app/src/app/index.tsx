import { useMemo } from 'react';
import { router, useIsFocused } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterThumb } from '../components/Character';
import { Button, Coins, LevelBadge, Screen } from '../components/ui';
import { isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCharacterStyle, useMyLook } from '../lib/cosmetics';
import { levelProgress } from '../lib/levels';
import { useSocket } from '../lib/socket';
import { colors, fonts, gradients, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';

const HERO_BG = gradients.hero[0];

export default function Home() {
  const { ready, user, rank } = useAuth();
  const { activeGame, invites, unreadNotifications } = useSocket();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const look = useMyLook();
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
      ? 'Contra a IA · ganhe moedas'
      : 'Contra a IA · crie conta e ganhe moedas'
    : user
      ? 'Partida ranqueada online'
      : 'Entre para jogar online';
  const lp = user ? levelProgress(user.rating) : null;

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Screen>
        <View style={styles.header}>
          <Text style={styles.logo}>♞ Xadrez Arena</Text>
          <View style={styles.headerActions}>
            {user && (
              <Pressable onPress={() => router.push('/shop')} accessibilityLabel={`${user.coins} moedas, abrir a loja`}>
                <Coins amount={user.coins} />
              </Pressable>
            )}
            {user && (
              <Pressable onPress={() => router.push('/notifications')} hitSlop={10} accessibilityLabel="Notificações">
                <Text style={{ fontSize: 24 }}>🔔</Text>
                {unreadNotifications > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Configurações">
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* Destaque: seu boneco em 3D (só renderiza com a tela em foco, para poupar bateria) */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroScene}>
            {focused && (
              <Scene3D
                key={look.equipped.character}
                factory={factory}
                style={StyleSheet.absoluteFill}
                fallback={<CharacterThumb look={character} size={190} />}
              />
            )}
          </View>
          <View style={styles.heroInfo}>
            {user && lp ? (
              <>
                <Text style={styles.username} numberOfLines={1}>
                  {user.username}
                </Text>
                <LevelBadge level={user.level} name={user.levelName} />
                <Text style={styles.rating}>{user.rating}</Text>
                <Text style={styles.muted}>{rank ? `#${rank} no ranking` : 'jogue para entrar no ranking'}</Text>
                <View style={styles.xpTrack}>
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.xpFill, { width: `${Math.max(6, Math.round(lp.progress * 100))}%` }]}
                  />
                </View>
                <Text style={styles.muted}>
                  {lp.next ? `${lp.next.minRating - user.rating} pts para o Nv. ${lp.next.level}` : 'Nível máximo! 👑'}
                </Text>
                {user.winStreak > 0 && (
                  <View style={styles.streak}>
                    <Text style={styles.streakText}>
                      🔥 {user.winStreak} {user.winStreak === 1 ? 'vitória' : 'vitórias'} seguidas
                    </Text>
                  </View>
                )}
                <Pressable onPress={() => router.push('/shop')} style={styles.customize}>
                  <Text style={styles.customizeText}>🎨 Personalizar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.username}>Monte seu boneco!</Text>
                <Text style={styles.mutedLight}>
                  Crie uma conta para jogar online, subir de nível, ganhar moedas e desbloquear visuais.
                </Text>
                <Button small variant="gold" title="Criar conta" onPress={() => router.push('/login')} />
              </>
            )}
          </View>
        </LinearGradient>

        {activeGame && (
          <Button title="Voltar para a partida" icon="⏱" variant="gold" onPress={() => router.push(`/game/${activeGame.id}`)} />
        )}

        <Pressable
          onPress={() => router.push(playTarget)}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={gradients.play} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButton}>
            <Text style={styles.playIcon}>⚔️</Text>
            <View>
              <Text style={styles.playTitle}>JOGAR!</Text>
              <Text style={styles.playSub}>{playSub}</Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.grid}>
          <Tile icon="🤖" title="Contra a IA" subtitle="5 níveis, offline" colors={gradients.ai} onPress={() => router.push('/ai')} />
          <Tile
            icon="👥"
            title="Amigos"
            subtitle={local ? '🌐 Requer servidor online' : pendingInvites ? `${pendingInvites} desafio(s)!` : 'Convide e desafie'}
            colors={gradients.friends}
            locked={!user}
            dimmed={local}
            badge={pendingInvites}
            onPress={() => router.push('/friends')}
          />
          <Tile
            icon="🏆"
            title="Ranking"
            subtitle={local ? 'Contas deste aparelho' : 'Os melhores'}
            colors={gradients.ranking}
            locked={!user}
            onPress={() => router.push('/leaderboard')}
          />
          <Tile
            icon="🛍️"
            title="Loja"
            subtitle={user?.dailyBonusAvailable ? '🎁 Bônus grátis!' : 'Bonecos e estilos'}
            colors={gradients.shop}
            locked={!user}
            badge={user?.dailyBonusAvailable ? 1 : 0}
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
  colors: tileColors,
  badge,
  dimmed,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  locked?: boolean;
  colors: readonly [string, string];
  badge?: number;
  dimmed?: boolean;
}) {
  return (
    <Pressable
      onPress={locked ? () => router.push('/login') : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tileWrap, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <LinearGradient
        colors={tileColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tile, (locked || dimmed) && { opacity: 0.55 }]}
      >
        <Text style={styles.tileIcon}>{icon}</Text>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{locked ? '🔒 Requer conta' : subtitle}</Text>
      </LinearGradient>
      {!!badge && !locked && (
        <View style={[styles.badge, { top: -4, right: -4 }]}>
          <Text style={styles.badgeText}>!</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  logo: { color: colors.text, fontSize: 26, fontFamily: fonts.black, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.black },
  hero: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 250,
    borderWidth: 2,
    borderColor: '#5b46c9',
  },
  heroScene: { width: '46%', backgroundColor: HERO_BG },
  heroInfo: { flex: 1, padding: 14, gap: 5, justifyContent: 'center' },
  username: { color: colors.text, fontSize: 22, fontFamily: fonts.black },
  rating: { color: colors.accent, fontSize: 38, fontFamily: fonts.black, lineHeight: 42 },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  mutedLight: { color: '#d8d2ff', fontSize: 14, fontFamily: fonts.regular, marginBottom: 6 },
  xpTrack: { height: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: '100%', borderRadius: 5 },
  streak: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 120, 40, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  streakText: { color: '#ffb36b', fontFamily: fonts.bold, fontSize: 13 },
  customize: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  customizeText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 5,
    borderBottomColor: '#b8325a',
  },
  playIcon: { fontSize: 44 },
  playTitle: { color: '#fff', fontSize: 34, fontFamily: fonts.black, letterSpacing: 1 },
  playSub: { color: '#fff3e8', fontSize: 14, fontFamily: fonts.regular },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { flexBasis: '47%', flexGrow: 1 },
  tile: { borderRadius: radius.lg, padding: 16, gap: 2, minHeight: 130, justifyContent: 'flex-end' },
  tileIcon: { fontSize: 36, marginBottom: 4 },
  tileTitle: { color: '#fff', fontSize: 20, fontFamily: fonts.black },
  tileSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontFamily: fonts.regular },
});

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAvatarStyle } from '../lib/cosmetics';
import { levelName, useT } from '../lib/i18n';
import { LEVEL_ICONS } from '../lib/levels';
import { colors, fonts, radius } from '../lib/theme';
import { CoinIcon, Icon, type IconName } from './Icon';

type Variant = 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost';

/**
 * Botão: latão sólido para a ação principal, superfície com contorno fino para as demais.
 * Sem gradientes nem "degrau" 3D: o peso visual vem da cor e do tamanho, não de efeitos.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  iconName,
  style,
  small,
  testID,
}: {
  testID?: string;
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Símbolo de texto antes do título (ex.: ½, ⚑). */
  icon?: string;
  /** Ícone desenhado (preferível a emojis). */
  iconName?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const inactive = disabled || loading;
  const filled = variant === 'primary' || variant === 'gold';
  // Desabilitado: superfície neutra (em vez de latão "apagado", que parece sujo no fundo escuro).
  const dead = disabled && !loading;
  const textColor = dead ? colors.textFaint : filled ? colors.accentText : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        styles[variant],
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        dead && filled && { backgroundColor: colors.raised },
        dead && !filled && { opacity: 0.5 },
        loading && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonRow}>
          {iconName && <Icon name={iconName} size={small ? 16 : 19} color={textColor} strokeWidth={2} />}
          <Text style={[styles.buttonText, small && { fontFamily: fonts.regular, fontSize: 14 }, { color: textColor }]} numberOfLines={1}>
            {icon ? `${icon}  ` : ''}
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Barra fixa no rodapé (ex.: o botão principal da tela). Fica sempre visível enquanto o
   * conteúdo rola por trás, em qualquer tamanho de tela.
   */
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, style]}
          keyboardShouldPersistTaps="handled"
          // iOS: rola sozinho para o campo em foco não ficar escondido atrás do teclado.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function LevelBadge({ level, name, compact }: { level: number; name: string; compact?: boolean }) {
  const { t } = useT();
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {LEVEL_ICONS[level - 1] ?? '♙'} {t('common.lv')} {level}
        {compact ? '' : ` · ${levelName(level, name)}`}
      </Text>
    </View>
  );
}

export function Avatar({
  name,
  size = 40,
  online,
  icon,
}: {
  name: string;
  size?: number;
  online?: boolean;
  /** Id do ícone de perfil equipado (loja). */
  icon?: string;
}) {
  const style = useAvatarStyle(icon);
  // Cor estável a partir do nome (para o ícone padrão com a inicial).
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const ring = style.ring !== 'transparent' ? Math.max(2, size * 0.06) : 0;
  return (
    <View>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: style.background || `hsl(${h}, 18%, 24%)`,
          borderWidth: ring,
          borderColor: style.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: style.background ? '#fff' : `hsl(${h}, 35%, 82%)`,
            fontFamily: style.emoji ? undefined : fonts.display,
            fontSize: style.emoji ? size * 0.5 : size * 0.42,
            lineHeight: size * 0.62,
          }}
        >
          {style.emoji || name[0]?.toUpperCase()}
        </Text>
      </View>
      {online !== undefined && (
        <View style={[styles.onlineDot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
      )}
    </View>
  );
}

export function Coins({ amount, size = 15, plain }: { amount: number; size?: number; plain?: boolean }) {
  const { locale } = useT();
  return (
    <View style={[styles.coins, plain && styles.coinsPlain]}>
      <CoinIcon size={size + 2} />
      <Text style={[styles.coinsText, { fontFamily: fonts.regular, fontSize: size }]}>{amount.toLocaleString(locale)}</Text>
    </View>
  );
}

export function EmptyState({ icon, text, iconName }: { icon?: string; text: string; iconName?: IconName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, gap: 12 }}>
      <View style={styles.emptyIcon}>
        {iconName ? <Icon name={iconName} size={26} color={colors.textMuted} /> : <Text style={{ fontFamily: fonts.regular, fontSize: 26 }}>{icon}</Text>}
      </View>
      <Text style={{ color: colors.textMuted, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, maxWidth: 280, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

/** Título de tela grande (serifada) com subtítulo opcional. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4, marginBottom: 2 }}>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  footerInner: { width: '100%', maxWidth: 608, alignSelf: 'center', gap: 8 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonSmall: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.sm },
  primary: { backgroundColor: colors.accent },
  gold: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong },
  danger: { backgroundColor: 'rgba(226, 90, 82, 0.1)', borderWidth: 1, borderColor: 'rgba(226, 90, 82, 0.4)' },
  ghost: { backgroundColor: 'transparent' },
  buttonText: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, letterSpacing: 0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: fonts.black,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.2 },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 11,
    paddingVertical: 5,
  },
  coinsPlain: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  coinsText: { color: colors.text, fontFamily: fonts.black, fontVariant: ['tabular-nums'] },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.3 },
  pageSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});

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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAvatarStyle } from '../lib/cosmetics';
import { LEVEL_ICONS } from '../lib/levels';
import { colors, fonts, gradients, radius } from '../lib/theme';

type Variant = 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost';
const GRADIENT_VARIANTS: Partial<Record<Variant, readonly [string, string]>> = {
  primary: gradients.primary,
  gold: gradients.gold,
  danger: ['#ff4d6d', '#c9184a'],
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
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
  icon?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const inactive = disabled || loading;
  const gradient = GRADIENT_VARIANTS[variant];
  const textColor = variant === 'gold' ? colors.accentText : colors.text;
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
        pressed && { transform: [{ scale: 0.96 }] },
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {gradient && (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: small ? radius.sm : radius.md }]}
        />
      )}
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 15 }, { color: textColor }]}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView
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
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {LEVEL_ICONS[level - 1] ?? '♙'} Nv. {level}
        {compact ? '' : ` · ${name}`}
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
          backgroundColor: style.background || `hsl(${h}, 45%, 42%)`,
          borderWidth: ring,
          borderColor: style.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontWeight: '800',
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

export function Coins({ amount, size = 15 }: { amount: number; size?: number }) {
  return (
    <View style={styles.coins}>
      <Text style={{ fontSize: size }}>🪙</Text>
      <Text style={[styles.coinsText, { fontSize: size }]}>{amount.toLocaleString('pt-BR')}</Text>
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 12, borderRadius: radius.sm },
  primary: { backgroundColor: colors.primary, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: '#5a2fd1' },
  gold: { backgroundColor: colors.accent, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: '#c98a00' },
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 4 },
  danger: { backgroundColor: colors.danger, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: '#8f0f2e' },
  ghost: { backgroundColor: 'transparent' },
  buttonText: { color: colors.text, fontSize: 18, fontFamily: fonts.bold, letterSpacing: 0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(224, 165, 38, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 13 },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(224, 165, 38, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coinsText: { color: colors.accent, fontFamily: fonts.black },
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

import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { colors, radius } from '../lib/theme';

interface Props {
  visible: boolean;
  outcome: 'win' | 'loss' | 'draw';
  title: string;
  subtitle: string;
  ratingChange?: number;
  newRating?: number;
  levelUp?: string | null;
  coins?: number;
  children: ReactNode;
}

const ICON = { win: '🏆', loss: '♚', draw: '🤝' };

export function GameOverModal({ visible, outcome, title, subtitle, ratingChange, newRating, levelUp, coins, children }: Props) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.icon}>{ICON[outcome]}</Text>
          <Text style={[styles.title, outcome === 'win' && { color: colors.accent }]}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {ratingChange !== undefined && newRating !== undefined && (
            <View style={styles.rating}>
              <Text style={styles.ratingValue}>{newRating}</Text>
              <Text
                style={[
                  styles.ratingDelta,
                  { color: ratingChange > 0 ? colors.success : ratingChange < 0 ? colors.danger : colors.textMuted },
                ]}
              >
                {ratingChange > 0 ? `+${ratingChange}` : ratingChange}
              </Text>
            </View>
          )}
          {!!coins && <Text style={styles.coins}>{t('gameOver.coins', { n: coins })}</Text>}
          {levelUp && (
            <View style={styles.levelUp}>
              <Text style={styles.levelUpText}>{t('gameOver.levelUp', { name: levelUp })}</Text>
            </View>
          )}
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 8 }}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 52, color: colors.text },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  ratingValue: { color: colors.text, fontSize: 32, fontWeight: '800' },
  ratingDelta: { fontSize: 20, fontWeight: '800' },
  coins: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  levelUp: { backgroundColor: 'rgba(224,165,38,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  levelUpText: { color: colors.accent, fontWeight: '800' },
});

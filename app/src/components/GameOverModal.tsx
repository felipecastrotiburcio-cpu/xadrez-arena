import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { Icon, type IconName } from './Icon';
import { colors, radius, fonts } from '../lib/theme';

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

const ICON: Record<Props['outcome'], IconName> = { win: 'trophy', loss: 'flag', draw: 'users' };

export function GameOverModal({ visible, outcome, title, subtitle, ratingChange, newRating, levelUp, coins, children }: Props) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={[styles.icon, outcome === 'win' && { backgroundColor: colors.accentSoft, borderColor: 'rgba(220, 171, 79, 0.4)' }]}>
            <Icon name={ICON[outcome]} size={30} color={outcome === 'win' ? colors.accent : colors.textMuted} />
          </View>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 7, 6, 0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display, letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  ratingValue: { color: colors.text, fontSize: 34, fontFamily: fonts.display },
  ratingDelta: { fontSize: 20, fontFamily: fonts.black },
  coins: { color: colors.accent, fontSize: 16, fontFamily: fonts.black },
  levelUp: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  levelUpText: { color: colors.accent, fontFamily: fonts.black },
});

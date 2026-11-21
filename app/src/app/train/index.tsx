import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Screen, SectionTitle } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { colors, fonts } from '../../lib/theme';
import { goalText, lessonFor, tierName } from '../../lib/trainingText';
import { TIER_MIN, TIERS, puzzlesOfTier, useTraining, type Tier } from '../../lib/training';
import type { Puzzle } from '../../lib/puzzles';

/** Treino: os 3 desafios de hoje (do nível do jogador) e a trilha do básico ao avançado. */
export default function Training() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const tr = useTraining(user);
  const doneCount = tr.today.filter((p) => tr.doneToday.has(p.id)).length;
  const allDone = doneCount >= tr.today.length;

  const openTier = (tier: Tier) => {
    const list = puzzlesOfTier(tier);
    const next = list.find((p) => !tr.solved.has(p.id)) ?? list[0];
    router.push({ pathname: '/train/[id]', params: { id: next.id, mode: 'tier' } });
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="targetFill" size={30} color={colors.teal} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heroTitle}>{t('train.title')}</Text>
          <Text style={styles.heroSub}>
            {t('train.yourLevel', { level: tierName(tr.tier, lang).name, rating: tr.rating })}
          </Text>
          {tr.streak > 0 && (
            <View style={styles.streak}>
              <Icon name="fireFill" size={13} color={colors.coral} />
              <Text style={styles.streakText}>{t('train.streak', { count: tr.streak })}</Text>
            </View>
          )}
        </View>
      </View>

      <SectionTitle>{t('train.today', { done: doneCount, total: tr.today.length })}</SectionTitle>
      {tr.today.map((p, i) => (
        <PuzzleRow key={p.id} index={i} puzzle={p} done={tr.doneToday.has(p.id)} onPress={() => router.push({ pathname: '/train/[id]', params: { id: p.id, mode: 'daily' } })} />
      ))}
      {allDone && (
        <View style={styles.allDone}>
          <Icon name="starFill" size={20} color={colors.accent} />
          <Text style={styles.allDoneText}>{t('train.allDone')}</Text>
        </View>
      )}

      <SectionTitle>{t('train.path')}</SectionTitle>
      {TIERS.map((tier) => {
        const list = puzzlesOfTier(tier);
        const solved = list.filter((p) => tr.solved.has(p.id)).length;
        const locked = tier > tr.tier + 1;
        const info = tierName(tier, lang);
        return (
          <Pressable
            key={tier}
            disabled={locked}
            onPress={() => openTier(tier)}
            style={({ pressed }) => [styles.tier, tier === tr.tier && styles.tierMine, locked && { opacity: 0.5 }, pressed && styles.pressed]}
          >
            <View style={[styles.tierNum, tier === tr.tier && { backgroundColor: colors.accent }]}>
              {locked ? (
                <Icon name="lockFill" size={16} color={colors.textMuted} />
              ) : (
                <Text style={[styles.tierNumText, tier === tr.tier && { color: colors.accentText }]}>{tier}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.tierHead}>
                <Text style={styles.tierName}>{info.name}</Text>
                {tier === tr.tier && <Text style={styles.mine}>{t('train.mine')}</Text>}
              </View>
              <Text style={styles.tierDesc}>{locked ? t('train.unlockAt', { rating: TIER_MIN[tier] }) : info.desc}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round((solved / list.length) * 100)}%` }]} />
              </View>
              <Text style={styles.tierCount}>{t('train.solvedCount', { solved, total: list.length })}</Text>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function PuzzleRow({ index, puzzle, done, onPress }: { index: number; puzzle: Puzzle; done: boolean; onPress: () => void }) {
  const { lang } = useT();
  const lesson = lessonFor(puzzle.theme, lang);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]} accessibilityRole="button">
      <View style={[styles.num, done && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
        {done ? <Icon name="check" size={16} color={colors.accentText} strokeWidth={3} /> : <Text style={styles.numText}>{index + 1}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{lesson.title}</Text>
        <Text style={styles.rowSub}>{goalText(puzzle, lang)}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const card = { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderBottomWidth: 5, borderBottomColor: colors.shadow } as const;

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, padding: 16, ...card, backgroundColor: '#1f2a58' },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(54, 209, 181, 0.16)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  heroSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(255,127,127,0.14)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  streakText: { color: '#ffb0b0', fontFamily: fonts.bold, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, ...card },
  rowDone: { borderColor: 'rgba(54, 209, 181, 0.5)' },
  pressed: { borderBottomWidth: 2, marginTop: 3 },
  num: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.text, fontFamily: fonts.black, fontSize: 15 },
  rowTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 17 },
  rowSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: 'rgba(244,185,66,0.4)' },
  allDoneText: { flex: 1, color: colors.accent, fontFamily: fonts.bold, fontSize: 14 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, ...card },
  tierMine: { borderColor: colors.accent },
  tierNum: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  tierNumText: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 20 },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { color: colors.text, fontFamily: fonts.display, fontSize: 17 },
  mine: { color: colors.accentText, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, fontFamily: fonts.black, fontSize: 11, overflow: 'hidden' },
  tierDesc: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12.5 },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#0e1530', overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.teal },
  tierCount: { color: colors.textFaint, fontFamily: fonts.bold, fontSize: 11.5 },
});

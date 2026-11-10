import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/TimeControlPicker';
import { Button, Screen, SectionTitle } from '../../components/ui';
import { AI_LEVELS } from '../../ai';
import { loadAiStats, type AiStats } from '../../lib/aiStats';
import { useT, type TranslationKey } from '../../lib/i18n';
import { colors, radius } from '../../lib/theme';

const ICONS = ['♙', '♘', '♗', '♖', '♕'];

export default function AiSetup() {
  const [level, setLevel] = useState(2);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w');
  const [time, setTime] = useState<'0' | '10' | '5' | '3'>('0');
  const [stats, setStats] = useState<AiStats>({});
  const { t } = useT();

  useFocusEffect(
    useCallback(() => {
      loadAiStats().then(setStats);
    }, []),
  );

  return (
    <Screen>
      <SectionTitle>{t('ai.chooseOpponent')}</SectionTitle>
      {AI_LEVELS.map((l, i) => {
        const active = l.id === level;
        const s = stats[l.id];
        return (
          <Pressable key={l.id} onPress={() => setLevel(l.id)} style={[styles.level, active && styles.levelActive]}>
            <Text style={styles.icon}>{ICONS[i]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {t(`ai.${l.id}.name` as TranslationKey)} <Text style={styles.elo}>~{l.elo}</Text>
              </Text>
              <Text style={styles.desc}>{t(`ai.${l.id}.desc` as TranslationKey)}</Text>
              {s && (
                <Text style={styles.record}>{t('ai.record', { w: s.wins, d: s.draws, l: s.losses })}</Text>
              )}
            </View>
            <View style={[styles.radio, active && styles.radioActive]} />
          </Pressable>
        );
      })}

      <SectionTitle>{t('ai.playAs')}</SectionTitle>
      <Segmented
        value={color}
        onChange={setColor}
        options={[
          { value: 'w', label: t('common.white') },
          { value: 'random', label: t('common.random') },
          { value: 'b', label: t('common.black') },
        ]}
      />

      <SectionTitle>{t('ai.time')}</SectionTitle>
      <Segmented
        value={time}
        onChange={setTime}
        options={[
          { value: '0', label: t('ai.untimed') },
          { value: '10', label: '10 min' },
          { value: '5', label: '5 min' },
          { value: '3', label: '3 min' },
        ]}
      />

      <Button
        title={t('ai.start')}
        icon="▶"
        onPress={() => {
          const c = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
          router.push({ pathname: '/ai/play', params: { level: String(level), color: c, time } });
        }}
      />
      <Text style={styles.footnote}>{t('ai.footnote')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  levelActive: { borderColor: colors.accent },
  icon: { fontSize: 34, color: colors.text, width: 40, textAlign: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  elo: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  desc: { color: colors.textMuted, fontSize: 13 },
  record: { color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  footnote: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});

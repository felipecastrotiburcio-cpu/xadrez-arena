import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/TimeControlPicker';
import { Button, Screen, SectionTitle } from '../../components/ui';
import { ChessPiece, type PieceType } from '../../components/ChessPiece';
import { Icon } from '../../components/Icon';
import { useMyLook } from '../../lib/cosmetics';
import { AI_LEVELS } from '../../ai';
import { loadAiStats, type AiStats } from '../../lib/aiStats';
import { useT, type TranslationKey } from '../../lib/i18n';
import { colors, radius, fonts } from '../../lib/theme';

const PIECES: PieceType[] = ['p', 'n', 'b', 'r', 'q'];

export default function AiSetup() {
  const [level, setLevel] = useState(2);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w');
  const [time, setTime] = useState<'0' | '10' | '5' | '3'>('0');
  const [stats, setStats] = useState<AiStats>({});
  const { t } = useT();
  const pieceStyle = useMyLook().pieces;

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
            <View style={[styles.icon, active && { backgroundColor: colors.accentSoft }]}>
              <ChessPiece type={PIECES[i]} color="w" style={pieceStyle} size={40} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {t(`ai.${l.id}.name` as TranslationKey)} <Text style={styles.elo}>~{l.elo}</Text>
              </Text>
              <Text style={styles.desc}>{t(`ai.${l.id}.desc` as TranslationKey)}</Text>
              {s && (
                <Text style={styles.record}>{t('ai.record', { w: s.wins, d: s.draws, l: s.losses })}</Text>
              )}
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active && <Icon name="check" size={14} color={colors.accentText} strokeWidth={2.8} />}
            </View>
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
        iconName="play"
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  elo: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bold },
  desc: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  record: { color: colors.accent, fontSize: 12, marginTop: 2, fontFamily: fonts.bold },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  footnote: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
});

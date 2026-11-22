import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/TimeControlPicker';
import { Button, Screen, SectionTitle } from '../../components/ui';
import { ChessPiece, type PieceType } from '../../components/ChessPiece';
import { Icon } from '../../components/Icon';
import { useCosmetics, useMyLook } from '../../lib/cosmetics';
import { useAuth } from '../../lib/auth';
import { BADGES } from '../../lib/badges';
import { itemName } from '../../lib/catalogI18n';
import { Emblem } from '../../components/Emblem';
import { RewardPreview } from '../../components/RewardPreview';
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
  const { t, lang } = useT();
  const pieceStyle = useMyLook().pieces;
  const { user } = useAuth();
  const { get: reward } = useCosmetics();

  useFocusEffect(
    useCallback(() => {
      loadAiStats().then(setStats);
    }, []),
  );

  const [preview, setPreview] = useState<number | null>(null);
  const start = (lv = level) => {
    const c = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    router.push({ pathname: '/ai/play', params: { level: String(lv), color: c, time } });
  };

  return (
    // O botão de começar fica fixo no rodapé: visível sem rolar, em qualquer celular.
    <Screen
      footer={
        <>
          <Button title={t('ai.start')} iconName="play" onPress={() => start()} />
          <Text style={styles.footnote}>{t('ai.footnote')}</Text>
        </>
      }
    >
      {preview !== null && (
        <RewardPreview
          level={preview}
          owned={!!user && (user.badges ?? []).includes(`ai_${preview}`)}
          username={user?.username ?? t('common.you')}
          onClose={() => setPreview(null)}
          onPlay={() => {
            const lv = preview;
            setPreview(null);
            setLevel(lv);
            start(lv);
          }}
        />
      )}
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
              {/* Recompensa: dá para ver antes de vencer */}
              <Pressable onPress={() => setPreview(l.id)} style={styles.rewardBtn} hitSlop={6} accessibilityRole="button">
                {user && (user.badges ?? []).includes(BADGES[i].id) ? (
                  <>
                    <Emblem id={BADGES[i].id} size={20} />
                    <Text style={styles.earnedText}>{t('badges.earned')}</Text>
                  </>
                ) : (
                  <>
                    <Icon name="giftFill" size={14} color={colors.accent} />
                    <Text style={styles.rewardText} numberOfLines={1}>
                      {reward(BADGES[i].rewardId) ? itemName(reward(BADGES[i].rewardId)!, lang) : t('reward.badge')}
                    </Text>
                  </>
                )}
                <Text style={styles.seeReward}>{t('reward.see')}</Text>
                <Icon name="chevron" size={13} color={colors.accent} strokeWidth={2.6} />
              </Pressable>
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
  rewardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    maxWidth: '100%',
  },
  seeReward: { color: colors.accent, fontFamily: fonts.black, fontSize: 12, marginLeft: 2 },
  earnedText: { color: colors.teal, fontFamily: fonts.bold, fontSize: 12 },
  rewardText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12, flexShrink: 1 },
  footnote: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
});

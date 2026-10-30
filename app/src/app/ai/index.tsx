import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/TimeControlPicker';
import { Button, Screen, SectionTitle } from '../../components/ui';
import { AI_LEVELS } from '../../ai';
import { loadAiStats, type AiStats } from '../../lib/aiStats';
import { colors, radius } from '../../lib/theme';

const ICONS = ['♙', '♘', '♗', '♖', '♕'];

export default function AiSetup() {
  const [level, setLevel] = useState(2);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w');
  const [stats, setStats] = useState<AiStats>({});

  useFocusEffect(
    useCallback(() => {
      loadAiStats().then(setStats);
    }, []),
  );

  return (
    <Screen>
      <SectionTitle>Escolha o adversário</SectionTitle>
      {AI_LEVELS.map((l, i) => {
        const active = l.id === level;
        const s = stats[l.id];
        return (
          <Pressable key={l.id} onPress={() => setLevel(l.id)} style={[styles.level, active && styles.levelActive]}>
            <Text style={styles.icon}>{ICONS[i]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {l.name} <Text style={styles.elo}>~{l.elo}</Text>
              </Text>
              <Text style={styles.desc}>{l.description}</Text>
              {s && (
                <Text style={styles.record}>
                  Você: {s.wins}V · {s.draws}E · {s.losses}D
                </Text>
              )}
            </View>
            <View style={[styles.radio, active && styles.radioActive]} />
          </Pressable>
        );
      })}

      <SectionTitle>Jogar com</SectionTitle>
      <Segmented
        value={color}
        onChange={setColor}
        options={[
          { value: 'w', label: '♔ Brancas' },
          { value: 'random', label: '🎲 Sortear' },
          { value: 'b', label: '♚ Pretas' },
        ]}
      />

      <Button
        title="Começar partida"
        icon="▶"
        onPress={() => {
          const c = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
          router.push({ pathname: '/ai/play', params: { level: String(level), color: c } });
        }}
      />
      <Text style={styles.footnote}>Partidas contra a IA funcionam offline e não alteram seu rating.</Text>
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

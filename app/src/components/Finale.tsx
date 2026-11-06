import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMyLook } from '../lib/cosmetics';
import { playMusic, stopMusic } from '../lib/sound';
import { colors, fonts } from '../lib/theme';
import type { CharacterStyle } from '../lib/types';
import { Scene3D } from '../three/Scene3D';
import { CharacterThumb } from './Character';
import { createFinaleScene } from '../three/scenes';

export interface Fighter {
  name: string;
  look: CharacterStyle;
}

interface Props {
  visible: boolean;
  winner: Fighter;
  loser: Fighter;
  /** Animação do movimento especial (ex: "jamal", "67", "kick"). */
  move: string;
  moveName?: string;
  title?: string;
  subtitle?: string;
  onDone: () => void;
  durationMs?: number;
}

/**
 * Finalização em 3D: os bonecos entram na arena (com o piso do seu tabuleiro),
 * o vencedor derruba o rival e comemora com o movimento especial equipado.
 */
export function Finale({ visible, winner, loser, move, moveName, title, subtitle, onDone, durationMs = 9000 }: Props) {
  const { width, height } = useWindowDimensions();
  const { board } = useMyLook();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const factory = useMemo(
    () => createFinaleScene({ winner: winner.look, loser: loser.look, move, board, bg: colors.bg }),
    [winner.look, loser.look, move, board],
  );

  useEffect(() => {
    if (!visible) return;
    // Com o tempo da cena fixado por um teste automático, a finalização não fecha sozinha.
    if ((globalThis as { __xaSceneTime?: number }).__xaSceneTime !== undefined) return;
    const t = setTimeout(() => onDoneRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs]);

  // Música do movimento especial: começa quando o vencedor vira para dançar.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => playMusic(move), 2600);
    return () => {
      clearTimeout(t);
      stopMusic();
    };
  }, [visible, move]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={styles.root}>
        {visible && (
          <Scene3D
            key={`${move}-${winner.name}`}
            factory={factory}
            style={{ width, height: Math.max(360, height * 0.62) }}
            fallback={<CharacterThumb look={winner.look} size={260} />}
          />
        )}
        <View style={styles.top} pointerEvents="none">
          <Text style={styles.title}>{title ?? 'Vitória!'}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.bottom}>
          <Text style={styles.names}>
            <Text style={{ color: colors.accent }}>{winner.name}</Text> derrotou {loser.name}
          </Text>
          {moveName ? (
            <View style={styles.moveChip}>
              <Text style={styles.moveText}>✨ {moveName}</Text>
            </View>
          ) : null}
          <Pressable onPress={onDone} style={styles.skip} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skipText}>Pular ›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  top: { position: 'absolute', top: 56, left: 16, right: 16, alignItems: 'center' },
  title: {
    color: colors.accent,
    fontSize: 40,
    fontFamily: fonts.black,
    textAlign: 'center',
    textShadowColor: '#ff4fd8',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: { color: colors.text, fontSize: 16, fontFamily: fonts.regular, textAlign: 'center', marginTop: 4 },
  bottom: { position: 'absolute', bottom: 40, left: 16, right: 16, alignItems: 'center', gap: 10 },
  names: { color: colors.text, fontSize: 20, fontFamily: fonts.bold, textAlign: 'center' },
  moveChip: { backgroundColor: 'rgba(139, 92, 255, 0.35)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  moveText: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  skip: { alignSelf: 'flex-end', padding: 8 },
  skipText: { color: colors.textMuted, fontSize: 16, fontFamily: fonts.bold },
});

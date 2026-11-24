import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard, type BoardMove } from './ChessBoard';
import { CharacterThumb } from './Character';
import { Emblem } from './Emblem';
import { Icon } from './Icon';
import { Avatar, Button } from './ui';
import { getBadge } from '../lib/badges';
import { itemDescription, itemName } from '../lib/catalogI18n';
import { RARITY, useCosmetics, useMyLook } from '../lib/cosmetics';
import { useT, type TranslationKey } from '../lib/i18n';
import { colors, fonts } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';

/** Posição de exemplo com todos os tipos de peça (para testar tabuleiros e peças). */
const SAMPLE_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5';

/**
 * Prévia das recompensas de uma IA, antes de vencê-la: o emblema e o item exclusivo
 * (tabuleiro e peças dá para testar mexendo; o boneco aparece em 3D).
 */
export function RewardPreview({
  level,
  owned,
  username,
  onClose,
  onPlay,
}: {
  level: number;
  /** Já venceu esta IA (emblema e item conquistados). */
  owned: boolean;
  username: string;
  onClose: () => void;
  onPlay: () => void;
}) {
  const { t, lang } = useT();
  const { get } = useCosmetics();
  const look = useMyLook();
  const { width, height } = useWindowDimensions();
  const badge = getBadge(`ai_${level}`)!;
  const item = get(badge.rewardId);
  const ai = t(`ai.${level}.name` as TranslationKey);
  const [fen, setFen] = useState(SAMPLE_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const boardSize = Math.min(width - 64, height * 0.42, 380);
  const factory = useMemo(
    () => (item?.type === 'character' ? createShowcaseScene({ look: { ...item.style, id: item.id }, board: look.board, bg: colors.surfaceAlt }) : null),
    [item, look.board],
  );

  const onMove = (m: BoardMove) => {
    const c = new Chess(fen);
    try {
      c.move(m);
    } catch {
      return;
    }
    setFen(c.fen());
    setLastMove({ from: m.from, to: m.to });
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <ScrollView contentContainerStyle={styles.center}>
          <Pressable style={styles.card} onPress={() => {}} accessible={false}>
            <View style={styles.head}>
              <Emblem id={badge.id} size={60} locked={false} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{owned ? t('reward.earned') : t('reward.toWin')}</Text>
                <Text style={styles.title}>{t('reward.title', { name: ai })}</Text>
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>{t('reward.badge')}</Text>
              <Text style={styles.text}>{t('reward.badgeDesc', { name: ai })}</Text>
            </View>

            {item && (
              <View style={[styles.block, { alignItems: 'center' }]}>
                <View style={{ alignSelf: 'stretch', gap: 2 }}>
                  <Text style={styles.blockTitle}>{t('reward.item')}</Text>
                  <Text style={styles.itemName}>{itemName(item, lang)}</Text>
                  <Text style={[styles.rarity, { color: RARITY[item.rarity].color }]}>
                    {t(`rarity.${item.rarity}` as TranslationKey)} · {t(`reward.type.${item.type}` as TranslationKey)}
                  </Text>
                  {item.description ? <Text style={styles.text}>{itemDescription(item, lang)}</Text> : null}
                </View>
                {(item.type === 'board' || item.type === 'pieces') && (
                  <View style={{ marginTop: 10, alignItems: 'center', gap: 6 }}>
                    <ChessBoard
                      fen={fen}
                      size={boardSize}
                      orientation="w"
                      movableColor="both"
                      lastMove={lastMove}
                      onMove={onMove}
                      boardStyle={item.type === 'board' ? item.style : look.board}
                      pieceStyle={item.type === 'pieces' ? item.style : look.pieces}
                    />
                    <Text style={styles.hint}>{t('shop.tryMoves')}</Text>
                  </View>
                )}
                {item.type === 'avatar' && (
                  <View style={{ marginTop: 12, alignItems: 'center', gap: 6 }}>
                    <Avatar name={username} size={104} icon={item.id} />
                    <Text style={styles.hint}>{t('reward.avatarHint')}</Text>
                  </View>
                )}
                {item.type === 'character' && factory && (
                  <View style={styles.scene}>
                    <Scene3D factory={factory} style={StyleSheet.absoluteFill} fallback={<CharacterThumb look={{ id: item.id }} size={190} />} />
                  </View>
                )}
                <View style={styles.exclusive}>
                  <Icon name="lockFill" size={14} color={colors.accent} />
                  <Text style={styles.exclusiveText}>{t('reward.notSold')}</Text>
                </View>
              </View>
            )}

            <Button title={t('reward.play', { name: ai })} iconName="play" onPress={onPlay} style={{ alignSelf: 'stretch' }} />
            <Button title={t('common.close')} variant="secondary" onPress={onClose} style={{ alignSelf: 'stretch' }} />
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 11, 26, 0.88)' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 6,
    borderBottomColor: colors.shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { color: colors.accent, fontFamily: fonts.black, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  block: { backgroundColor: colors.surfaceAlt, borderRadius: 18, padding: 12, gap: 4 },
  blockTitle: { color: colors.textMuted, fontFamily: fonts.black, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  itemName: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  rarity: { fontFamily: fonts.black, fontSize: 12 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12.5, textAlign: 'center' },
  scene: { alignSelf: 'stretch', height: 230, marginTop: 10, borderRadius: 16, overflow: 'hidden' },
  exclusive: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  exclusiveText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12.5 },
});

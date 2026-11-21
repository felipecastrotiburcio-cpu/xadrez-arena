import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard, type BoardMove } from './ChessBoard';
import { Button } from './ui';
import { RARITY } from '../lib/cosmetics';
import { itemName } from '../lib/catalogI18n';
import { useT, type TranslationKey } from '../lib/i18n';
import { colors, fonts, radius } from '../lib/theme';
import type { BoardStyle, EntranceStyle, PieceStyle, ShopItem } from '../lib/types';

/** Posição de exemplo com todos os tipos de peça (Abertura Italiana). */
const SAMPLE_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5';

interface Props {
  item: ShopItem & { type: 'board' | 'pieces' | 'entrance' };
  /** Visual equipado, para combinar com o item na prévia. */
  board: BoardStyle;
  pieces: PieceStyle;
  owned: boolean;
  equipped: boolean;
  coins: number;
  /** Item lendário: preço da loja do aparelho (compra com dinheiro real). */
  storePrice?: string;
  busy: boolean;
  /** Modo desenvolvedor: comprar sai de graça. */
  free?: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onClose: () => void;
}

/** Prévia de tabuleiro/peças antes de comprar: um tabuleiro grande onde dá para mexer as peças. */
export function ItemPreviewModal({ item, board, pieces, owned, equipped, coins, storePrice, busy, free, onBuy, onEquip, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * 0.5, 440);
  const isEntrance = item.type === 'entrance';
  // Surgimento: começa na posição inicial e toca o efeito (de novo a cada "Repetir").
  const startFen = isEntrance ? new Chess().fen() : SAMPLE_FEN;
  const [fen, setFen] = useState(startFen);
  const [playKey, setPlayKey] = useState(1);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const rarity = RARITY[item.rarity];
  const { t, lang, locale } = useT();

  const onMove = (m: BoardMove) => {
    const chess = new Chess(fen);
    try {
      chess.move(m);
    } catch {
      return;
    }
    setFen(chess.fen());
    setLastMove({ from: m.from, to: m.to });
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* accessible={false}: no iOS os botões de dentro continuam acessíveis um a um (VoiceOver). */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <ScrollView contentContainerStyle={styles.center}>
          <Pressable style={styles.card} onPress={() => {}} accessible={false}>
            <Text style={styles.title}>{itemName(item, lang)}</Text>
            <Text style={[styles.rarity, { color: rarity.color }]}>
              {t(`rarity.${item.rarity}` as TranslationKey)} ·{' '}
              {item.type === 'board' ? t('shop.board') : item.type === 'pieces' ? t('shop.pieces') : t('shop.entrance')}
            </Text>
            <ChessBoard
              fen={fen}
              size={size}
              orientation="w"
              movableColor="both"
              lastMove={lastMove}
              onMove={onMove}
              boardStyle={item.type === 'board' ? item.style : board}
              pieceStyle={item.type === 'pieces' ? item.style : pieces}
              entrance={isEntrance ? (item.style as EntranceStyle) : null}
              entranceKey={isEntrance ? playKey : undefined}
            />
            <Text style={styles.hint}>{isEntrance ? t('shop.entranceHint') : t('shop.tryMoves')}</Text>
            <View style={styles.actions}>
              <Button
                small
                variant="ghost"
                title={isEntrance ? t('shop.replay') : t('shop.reset')}
                iconName={isEntrance ? 'play' : 'refresh'}
                onPress={() => {
                  setFen(startFen);
                  setLastMove(null);
                  if (isEntrance) setPlayKey((k) => k + 1);
                }}
              />
              {equipped ? (
                <Text style={styles.equipped}>{t('common.equipped')}</Text>
              ) : owned ? (
                <Button small variant="secondary" title={t('common.equip')} loading={busy} onPress={onEquip} />
              ) : free ? (
                <Button small variant="gold" iconName="wrench" title={t('shop.devFree')} loading={busy} onPress={onBuy} />
              ) : (
                <Button
                  small
                  variant="gold"
                  title={item.iap ? t('shop.buyStore', { price: storePrice ?? t('shop.realPurchase') }) : t('shop.buyPrice', { price: item.price.toLocaleString(locale) })}
                  disabled={!item.iap && coins < item.price}
                  loading={busy}
                  onPress={onBuy}
                />
              )}
            </View>
            {!owned && !free && !item.iap && coins < item.price && (
              <Text style={styles.hint}>
                {t('shop.missingCoins', { count: (item.price - coins).toLocaleString(locale) })}
              </Text>
            )}
            <Button title={t('common.close')} variant="secondary" onPress={onClose} style={{ alignSelf: 'stretch' }} />
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 7, 6, 0.86)' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    paddingTop: 20,
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.3 },
  rarity: { fontSize: 11, fontFamily: fonts.black, textTransform: 'uppercase', letterSpacing: 1.3, marginTop: -8 },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontFamily: fonts.regular },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  equipped: { color: colors.success, fontFamily: fonts.bold, fontSize: 15 },
});

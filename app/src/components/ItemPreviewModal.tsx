import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard, type BoardMove } from './ChessBoard';
import { Button } from './ui';
import { RARITY } from '../lib/cosmetics';
import { itemName } from '../lib/catalogI18n';
import { useT, type TranslationKey } from '../lib/i18n';
import { colors, fonts, radius } from '../lib/theme';
import type { BoardStyle, PieceStyle, ShopItem } from '../lib/types';

/** Posição de exemplo com todos os tipos de peça (Abertura Italiana). */
const SAMPLE_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5';

interface Props {
  item: ShopItem & { type: 'board' | 'pieces' };
  /** Visual equipado, para combinar com o item na prévia. */
  board: BoardStyle;
  pieces: PieceStyle;
  owned: boolean;
  equipped: boolean;
  coins: number;
  /** Item lendário: preço da loja do aparelho (compra com dinheiro real). */
  storePrice?: string;
  busy: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onClose: () => void;
}

/** Prévia de tabuleiro/peças antes de comprar: um tabuleiro grande onde dá para mexer as peças. */
export function ItemPreviewModal({ item, board, pieces, owned, equipped, coins, storePrice, busy, onBuy, onEquip, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * 0.5, 440);
  const [fen, setFen] = useState(SAMPLE_FEN);
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
              {t(`rarity.${item.rarity}` as TranslationKey)} · {item.type === 'board' ? t('shop.board') : t('shop.pieces')}
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
            />
            <Text style={styles.hint}>{t('shop.tryMoves')}</Text>
            <View style={styles.actions}>
              <Button
                small
                variant="ghost"
                title={t('shop.reset')}
                icon="↺"
                onPress={() => {
                  setFen(SAMPLE_FEN);
                  setLastMove(null);
                }}
              />
              {equipped ? (
                <Text style={styles.equipped}>{t('common.equipped')}</Text>
              ) : owned ? (
                <Button small variant="secondary" title={t('common.equip')} loading={busy} onPress={onEquip} />
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
            {!owned && !item.iap && coins < item.price && (
              <Text style={styles.hint}>
                {t('shop.missingCoins', { count: (item.price - coins).toLocaleString(locale) })}
              </Text>
            )}
            <Button title={t('common.close')} variant="secondary" onPress={onClose} />
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 3, 20, 0.82)' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 22 },
  rarity: { fontSize: 12, fontFamily: fonts.black, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: -6 },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  equipped: { color: colors.accent, fontFamily: fonts.black },
});

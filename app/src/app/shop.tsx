import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CharacterThumb } from '../components/Character';
import { BoardFrame, isLight, SquareSurface } from '../components/ChessBoard';
import { ItemPreviewModal } from '../components/ItemPreviewModal';
import { ChessPiece, type PieceType } from '../components/ChessPiece';
import { Finale } from '../components/Finale';
import { Avatar, Button, Card, Coins, Screen } from '../components/ui';
import { api, isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { itemDescription, itemName } from '../lib/catalogI18n';
import { confirmAction } from '../lib/confirm';
import { AI_CHARACTER, RARITY, useCharacterStyle, useCosmetics, useMyLook } from '../lib/cosmetics';
import { colors, fonts, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';
import { useToast } from '../lib/toast';
import { buyWithStore, iapSupported, loadPrices, restoreStorePurchases } from '../lib/iap';
import { translateServerText, useT, type TranslationKey } from '../lib/i18n';
import type { BoardStyle, CharacterStyle, ItemType, PieceStyle, PrivateUser, ShopItem } from '../lib/types';

const TABS: { type: ItemType; label: TranslationKey; icon: string }[] = [
  { type: 'board', label: 'shop.tabBoards', icon: '🟫' },
  { type: 'pieces', label: 'shop.tabPieces', icon: '♞' },
  { type: 'avatar', label: 'shop.tabAvatars', icon: '🙂' },
  { type: 'character', label: 'shop.tabCharacters', icon: '🧍' },
  { type: 'move', label: 'shop.tabMoves', icon: '🕺' },
];

export default function Shop() {
  const { user, setUser } = useAuth();
  const { items } = useCosmetics();
  const look = useMyLook();
  const toast = useToast();
  const { t, lang, locale } = useT();
  const [tab, setTab] = useState<ItemType>('board');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ShopItem | null>(null);
  /** Boneco exibido no provador 3D (aba Bonecos). */
  const [trying, setTrying] = useState<string | null>(null);
  /** Preços das lojas (Play Store / App Store) para os itens lendários. */
  const [prices, setPrices] = useState<Record<string, string>>({});
  const storeOk = iapSupported();
  useEffect(() => {
    if (!storeOk) return;
    loadPrices(items.filter((i) => i.iap).map((i) => i.iap!)).then(setPrices);
  }, [storeOk, items]);
  const myCharacter = useCharacterStyle(user?.equipped.character);

  const fittingId = trying ?? user?.equipped.character;
  const fitting = items.find((i) => i.id === fittingId);
  const fittingFactory = useMemo(
    () =>
      fitting?.type === 'character'
        ? createShowcaseScene({ look: fitting.style, board: look.board, bg: colors.surface })
        : null,
    [fitting, look.board],
  );

  const list = useMemo(() => items.filter((i) => i.type === tab).sort((a, b) => a.price - b.price), [items, tab]);

  if (!user) {
    return (
      <Screen>
        <Card>
          <Text style={styles.text}>{t('shop.loginPrompt')}</Text>
          <Button title={t('common.login')} onPress={() => router.push('/login')} />
        </Card>
      </Screen>
    );
  }

  const run = async (itemId: string, action: 'buy' | 'equip') => {
    setBusy(itemId);
    try {
      const r = await api<{ user: PrivateUser }>(`/shop/${action}`, { body: { itemId } });
      setUser(r.user);
      const item = items.find((i) => i.id === itemId);
      const name = item ? itemName(item, lang) : undefined;
      toast(action === 'buy' ? t('shop.bought', { name: String(name) }) : t('shop.equippedToast', { name: String(name) }), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Itens lendários: compra com dinheiro real pela loja do aparelho. */
  const buyReal = async (item: ShopItem) => {
    if (!storeOk || !item.iap) {
      toast(t('shop.inAppOnly'), 'info');
      return;
    }
    setBusy(item.id);
    try {
      const u = await buyWithStore(item.iap);
      setUser(u);
      toast(t('shop.boughtReal', { name: itemName(item, lang) }), 'success');
    } catch (e) {
      if ((e as { status?: number }).status !== 499) toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const r = await restoreStorePurchases();
      if (r.user) setUser(r.user);
      toast(r.restored ? t('shop.restored', { count: r.restored }) : t('shop.nothingToRestore'), r.restored ? 'success' : 'info');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  const claimDaily = async () => {
    try {
      const r = await api<{ user: PrivateUser; amount: number }>('/rewards/daily', { body: {} });
      setUser(r.user);
      toast(t('shop.coinsGained', { n: r.amount }), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    }
  };

  return (
    <Screen>
      <Card style={styles.wallet}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.muted}>{t('shop.balance')}</Text>
          <Coins amount={user.coins} size={22} />
        </View>
        {user.dailyBonusAvailable ? (
          <Button small title={t('shop.dailyBonus')} icon="🎁" onPress={claimDaily} />
        ) : (
          <Text style={styles.muted}>{t('shop.bonusClaimed')}</Text>
        )}
      </Card>
      <Text style={styles.hint}>
        {isLocalMode()
          ? t('shop.hintLocal')
          : t('shop.hintOnline')}
      </Text>

      {storeOk && (
        <Button small variant="ghost" title={t('shop.restore')} icon="↺" loading={busy === 'restore'} onPress={restore} />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((tb) => (
          <Pressable key={tb.type} onPress={() => setTab(tb.type)} style={[styles.chip, tab === tb.type && styles.chipActive]}>
            <Text style={styles.chipText}>
              {tb.icon} {t(tb.label)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'character' && fittingFactory && fitting?.type === 'character' && (
        <Card style={styles.fitting}>
          <Scene3D
            key={fitting.id}
            factory={fittingFactory}
            style={styles.fittingScene}
            fallback={<CharacterThumb look={fitting.style} size={200} />}
          />
          <Text style={styles.fittingName}>{t('shop.fitting', { name: itemName(fitting, lang) })}</Text>
          <Text style={styles.muted}>{t('shop.tapToTry')}</Text>
        </Card>
      )}

      {list.map((item) => {
        const owned = user.inventory.includes(item.id);
        const equipped = user.equipped[item.type] === item.id;
        const rarity = RARITY[item.rarity];
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              if (item.type === 'character') setTrying(item.id);
              else if (item.type === 'board' || item.type === 'pieces' || item.type === 'move') setPreview(item);
            }}
            style={[styles.item, { borderColor: equipped ? colors.accent : trying === item.id ? colors.primary : colors.border }]}
          >
            <View style={styles.preview}>
              <ItemPreview item={item} board={look.board} pieces={look.pieces} username={user.username} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name}>{itemName(item, lang)}</Text>
              <Text style={[styles.rarity, { color: rarity.color }]}>{t(`rarity.${item.rarity}` as TranslationKey)}</Text>
              {item.description ? <Text style={styles.muted}>{itemDescription(item, lang)}</Text> : null}
              {item.iap && !owned ? <Text style={styles.realBadge}>{t('shop.legendaryReal')}</Text> : null}
              <View style={styles.actions}>
                {(item.type === 'move' || item.type === 'board' || item.type === 'pieces') && (
                  <Button small variant="secondary" title={t('shop.view')} icon={item.type === 'move' ? '▶' : '👁'} onPress={() => setPreview(item)} />
                )}
                {equipped ? (
                  <Text style={styles.equipped}>{t('common.equipped')}</Text>
                ) : owned ? (
                  <Button small variant="secondary" title={t('common.equip')} loading={busy === item.id} onPress={() => run(item.id, 'equip')} />
                ) : item.iap ? (
                  <Button
                    small
                    variant="gold"
                    title={`💳 ${prices[item.iap] ?? t('shop.realPurchase')}`}
                    loading={busy === item.id}
                    onPress={() => buyReal(item)}
                  />
                ) : (
                  <Button
                    small
                    variant="gold"
                    title={`🪙 ${item.price.toLocaleString(locale)}`}
                    disabled={user.coins < item.price}
                    loading={busy === item.id}
                    onPress={() =>
                      confirmAction(
                        t('shop.buyQ', { name: itemName(item, lang) }),
                        t('shop.buyBody', { price: item.price, coins: user.coins }),
                        () => run(item.id, 'buy'),
                        t('common.buy'),
                      )
                    }
                  />
                )}
              </View>
            </View>
          </Pressable>
        );
      })}

      {preview && (preview.type === 'board' || preview.type === 'pieces') && (
        <ItemPreviewModal
          item={preview}
          board={look.board}
          pieces={look.pieces}
          owned={user.inventory.includes(preview.id)}
          equipped={user.equipped[preview.type] === preview.id}
          coins={user.coins}
          storePrice={preview.iap ? prices[preview.iap] : undefined}
          busy={busy === preview.id}
          onBuy={() =>
            preview.iap
              ? buyReal(preview)
              : confirmAction(
              t('shop.buyQ', { name: itemName(preview, lang) }),
              t('shop.buyBody', { price: preview.price, coins: user.coins }),
              () => run(preview.id, 'buy'),
              t('common.buy'),
            )
          }
          onEquip={() => run(preview.id, 'equip')}
          onClose={() => setPreview(null)}
        />
      )}

      {preview && preview.type === 'move' && (
        <Finale
          visible
          winner={{ name: user.username, look: myCharacter }}
          loser={{ name: t('shop.rival'), look: AI_CHARACTER }}
          move={preview.style.animation}
          moveName={itemName(preview, lang)}
          title={t('shop.preview')}
          subtitle={itemDescription(preview, lang)}
          onDone={() => setPreview(null)}
        />
      )}
    </Screen>
  );
}

function ItemPreview({
  item,
  board,
  pieces,
  username,
}: {
  item: ShopItem;
  board: BoardStyle;
  pieces: PieceStyle;
  username: string;
}) {
  switch (item.type) {
    case 'board':
      return <MiniBoard board={item.style} pieces={pieces} />;
    case 'pieces':
      return <MiniBoard board={board} pieces={item.style} />;
    case 'avatar':
      return <Avatar name={username} size={64} icon={item.id} />;
    case 'character':
      return <CharacterThumb look={item.style} size={84} />;
    case 'move':
      return <Text style={{ fontSize: 46 }}>{item.style.emoji}</Text>;
  }
}

const MINI_PIECES: (null | [string, 'w' | 'b'])[] = [
  ['k', 'b'], null, ['q', 'b'], null,
  null, ['p', 'b'], null, ['n', 'b'],
  ['n', 'w'], null, ['p', 'w'], null,
  null, ['q', 'w'], null, ['k', 'w'],
];

function MiniBoard({ board, pieces }: { board: BoardStyle; pieces: PieceStyle }) {
  const size = 88;
  const style = { ...board, frame: Math.min(board.frame, 5) };
  const sq = (size - style.frame * 2) / 4;
  return (
    <BoardFrame style={style} size={size}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MINI_PIECES.map((p, i) => {
          // Canto inferior esquerdo escuro, como no tabuleiro de verdade.
          const light = isLight(`${'abcd'[i % 4]}${4 - Math.floor(i / 4)}`);
          return (
            <View key={i} style={{ width: sq, height: sq, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <SquareSurface style={style} index={i * 3 + 7} size={sq} light={light} />
              {p && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ChessPiece type={p[0] as PieceType} color={p[1]} style={pieces} size={sq} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </BoardFrame>
  );
}

const styles = StyleSheet.create({
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.textMuted, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: '#c8b3ff' },
  chipText: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  item: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 2,
  },
  preview: { width: 92, minHeight: 92, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 19, fontFamily: fonts.bold },
  rarity: { fontSize: 12, fontFamily: fonts.black, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  equipped: { color: colors.accent, fontFamily: fonts.black },
  realBadge: { color: '#ffc83d', fontSize: 12, fontFamily: fonts.bold },
  fitting: { padding: 0, overflow: 'hidden', alignItems: 'center', paddingBottom: 12 },
  fittingScene: { width: '100%', height: 240 },
  fittingName: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
});

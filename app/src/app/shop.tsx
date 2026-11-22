import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CharacterThumb } from '../components/Character';
import { ItemPreviewModal } from '../components/ItemPreviewModal';
import { ItemPreview } from '../components/ItemThumb';
import { Finale } from '../components/Finale';
import { Button, Card, Screen } from '../components/ui';
import { CoinIcon, Icon, type IconName } from '../components/Icon';
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
import type { CharacterStyle, ItemType, PrivateUser, ShopItem } from '../lib/types';

const TABS: { type: ItemType; label: TranslationKey; icon: IconName; color: string }[] = [
  { type: 'board', label: 'shop.tabBoards', icon: 'board', color: '#f4b942' },
  { type: 'pieces', label: 'shop.tabPieces', icon: 'knight', color: '#a68bff' },
  { type: 'entrance', label: 'shop.tabEntrances', icon: 'sparkle', color: '#36d1b5' },
  { type: 'character', label: 'shop.tabCharacters', icon: 'user', color: '#6fb8ff' },
  { type: 'avatar', label: 'shop.tabAvatars', icon: 'smile', color: '#ff7f7f' },
  { type: 'move', label: 'shop.tabMoves', icon: 'music', color: '#ff9ce6' },
];

const RARITY_ORDER = { comum: 0, raro: 1, epico: 2, lendario: 3 } as const;

export default function Shop() {
  const { user, setUser } = useAuth();
  const { items } = useCosmetics();
  const look = useMyLook();
  const toast = useToast();
  const { t, lang, locale } = useT();
  // "Meu perfil" abre a loja direto numa categoria (ex.: /shop?tab=entrance).
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<ItemType>(() => TABS.find((x) => x.type === params.tab)?.type ?? 'board');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const { width } = useWindowDimensions();
  // Duas colunas; a largura da tela (até 640) menos as margens e o espaço entre os cartões.
  const cardW = Math.floor((Math.min(width, 640) - 32 - 12) / 2);
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

  const all = useMemo(
    () =>
      items
        .filter((i) => i.type === tab)
        .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.price - b.price),
    [items, tab],
  );

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

  /** Modo desenvolvedor (Configurações): todos os itens de graça, sem confirmação. */
  const dev = !!user.devMode;

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

  const owns = (id: string) => user.inventory.includes(id);
  const ownedCount = all.filter((i) => owns(i.id)).length;
  const list = onlyOwned ? all.filter((i) => owns(i.id)) : all;
  // Destaque: o item mais raro (e mais caro) da categoria que a pessoa ainda não tem.
  const featured = onlyOwned
    ? undefined
    : [...all].reverse().find((i) => !owns(i.id) && i.rarity !== 'comum' && i.type !== 'avatar');
  const grid = list.filter((i) => i.id !== featured?.id);

  const open = (item: ShopItem) => {
    if (item.type === 'character') setTrying(item.id);
    else if (item.type !== 'avatar') setPreview(item);
  };

  const confirmBuy = (item: ShopItem) =>
    confirmAction(
      t('shop.buyQ', { name: itemName(item, lang) }),
      t('shop.buyBody', { price: item.price, coins: user.coins }),
      () => run(item.id, 'buy'),
      t('common.buy'),
    );

  /** Ação principal de um item: equipar, comprar com moedas, comprar na loja do aparelho ou pegar grátis (dev). */
  const action = (item: ShopItem, wide?: boolean) => {
    const owned = owns(item.id);
    const equipped = user.equipped[item.type] === item.id;
    const loading = busy === item.id;
    if (equipped)
      return (
        <View style={[styles.state, wide && styles.wide]}>
          <Icon name="check" size={15} color={colors.success} strokeWidth={2.4} />
          <Text style={[styles.stateText, { color: colors.success }]}>{t('common.equipped')}</Text>
        </View>
      );
    if (owned)
      return <PriceButton label={t('common.equip')} kind="outline" wide={wide} loading={loading} onPress={() => run(item.id, 'equip')} />;
    if (dev)
      return <PriceButton label={t('shop.devFree')} icon="wrench" kind="gold" wide={wide} loading={loading} onPress={() => run(item.id, 'buy')} />;
    // Recompensa exclusiva: não se compra, se ganha vencendo a IA.
    if (item.unlock)
      return (
        <View style={[styles.locked, wide && styles.wide]}>
          <Icon name="lockFill" size={14} color={colors.accent} />
          <Text style={styles.lockedText} numberOfLines={1}>
            {t('badges.rewardHint', { name: t(`ai.${item.unlock}.name` as TranslationKey) })}
          </Text>
        </View>
      );
    if (item.iap)
      return (
        <PriceButton
          label={prices[item.iap] ?? t('shop.realPurchase')}
          icon="card"
          kind="gold"
          wide={wide}
          loading={loading}
          onPress={() => buyReal(item)}
        />
      );
    return (
      <PriceButton
        label={item.price.toLocaleString(locale)}
        coin
        kind={user.coins < item.price ? 'locked' : 'gold'}
        wide={wide}
        loading={loading}
        disabled={user.coins < item.price}
        onPress={() => confirmBuy(item)}
      />
    );
  };

  return (
    <Screen style={{ gap: 18, paddingBottom: 40 }}>
      {/* Saldo e bônus diário */}
      <View style={styles.wallet}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>{t('shop.balance')}</Text>
          <View style={styles.balanceRow}>
            <CoinIcon size={24} />
            <Text style={styles.balance}>{user.coins.toLocaleString(locale)}</Text>
          </View>
        </View>
        {user.dailyBonusAvailable ? (
          <Pressable onPress={claimDaily} style={({ pressed }) => [styles.daily, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Icon name="gift" size={18} color={colors.accentText} strokeWidth={2} />
            <Text style={styles.dailyText}>{t('shop.dailyBonus')}</Text>
          </Pressable>
        ) : (
          <View style={styles.dailyDone}>
            <Icon name="check" size={14} color={colors.textMuted} strokeWidth={2.2} />
            <Text style={styles.dailyDoneText}>{t('shop.bonusClaimed')}</Text>
          </View>
        )}
      </View>

      {dev && (
        <View style={styles.devBanner}>
          <Icon name="wrench" size={16} color={colors.accent} />
          <Text style={styles.devText}>{t('shop.devBanner')}</Text>
        </View>
      )}

      {/* Categorias */}
      {/* Categorias: todas visíveis de uma vez (grade 3×2), com quantos itens você já tem em cada. */}
      <View style={styles.cats} accessibilityRole="tablist">
        {TABS.map((tb) => {
          const active = tab === tb.type;
          const ofType = items.filter((i) => i.type === tb.type);
          const mine = ofType.filter((i) => owns(i.id)).length;
          return (
            <Pressable
              key={tb.type}
              testID={`cat-${tb.type}`}
              onPress={() => {
                setTab(tb.type);
                setOnlyOwned(false);
              }}
              style={({ pressed }) => [styles.cat, active && styles.catActive, pressed && { transform: [{ translateY: 2 }] }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.catIcon, { backgroundColor: active ? 'rgba(42,26,0,0.14)' : `${tb.color}29` }]}>
                <Icon name={tb.icon} size={20} color={active ? colors.accentText : tb.color} strokeWidth={2.2} />
              </View>
              <Text style={[styles.catText, active && { color: colors.accentText }]} numberOfLines={1}>
                {t(tb.label)}
              </Text>
              <Text style={[styles.catCount, active && { color: '#5c3d00' }]}>
                {mine}/{ofType.length}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listHead}>
        <Text style={styles.collection}>{t('shop.collection', { owned: ownedCount, total: all.length })}</Text>
        <View style={styles.filter}>
          {[false, true].map((o) => (
            <Pressable key={String(o)} onPress={() => setOnlyOwned(o)} style={[styles.filterBtn, onlyOwned === o && styles.filterOn]}>
              <Text style={[styles.filterText, onlyOwned === o && { color: colors.text }]}>{o ? t('shop.filterOwned') : t('shop.filterAll')}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'character' && fittingFactory && fitting?.type === 'character' && (
        <View style={styles.fitting}>
          <Scene3D
            key={fitting.id}
            factory={fittingFactory}
            style={styles.fittingScene}
            fallback={<CharacterThumb look={fitting.style} size={200} />}
          />
          <View style={styles.fittingBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('shop.fittingRoom')}</Text>
              <Text style={styles.fittingName}>{itemName(fitting, lang)}</Text>
            </View>
            {action(fitting)}
          </View>
        </View>
      )}

      {/* Destaque da categoria: cartão horizontal e compacto, para a grade aparecer logo abaixo */}
      {featured && tab !== 'character' && (
        <Pressable
          onPress={() => open(featured)}
          style={({ pressed }) => [styles.featured, pressed && { backgroundColor: colors.surfaceAlt }]}
        >
          <View style={[styles.featuredArt, { backgroundColor: tintFor(featured.rarity) }]}>
            <ItemPreview item={featured} board={look.board} pieces={look.pieces} username={user.username} size={112} />
            {featured.type !== 'avatar' && featured.type !== 'move' && (
              <View style={styles.artBadge}>
                <Icon name={featured.type === 'entrance' ? 'play' : 'eye'} size={13} color={colors.text} strokeWidth={2} />
              </View>
            )}
          </View>
          <View style={styles.featuredBody}>
            <View style={styles.featuredTag}>
              <Icon name="crown" size={12} color={RARITY[featured.rarity].color} strokeWidth={2.2} />
              <Text style={[styles.eyebrow, { color: RARITY[featured.rarity].color }]} numberOfLines={1}>
                {t('shop.featured')} · {t(`rarity.${featured.rarity}` as TranslationKey)}
              </Text>
            </View>
            <Text style={styles.featuredName} numberOfLines={2}>
              {itemName(featured, lang)}
            </Text>
            {featured.description ? (
              <Text style={styles.featuredDesc} numberOfLines={2}>
                {itemDescription(featured, lang)}
              </Text>
            ) : null}
            <View style={styles.featuredAction}>{action(featured)}</View>
          </View>
        </Pressable>
      )}

      {grid.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bag" size={26} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('shop.noneOwned')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {grid.map((item) => {
            const equipped = user.equipped[item.type] === item.id;
            const rarity = RARITY[item.rarity];
            const selected = tab === 'character' && trying === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => open(item)}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardW },
                  (equipped || selected) && { borderColor: equipped ? 'rgba(95, 191, 138, 0.55)' : colors.accent },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.art, { height: cardW - 24, backgroundColor: tintFor(item.rarity) }]}>
                  <ItemPreview item={item} board={look.board} pieces={look.pieces} username={user.username} size={cardW - 44} />
                  {item.iap && !owns(item.id) && !dev && (
                    <View style={styles.cornerTag}>
                      <Icon name="card" size={12} color={colors.accent} strokeWidth={2} />
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {itemName(item, lang)}
                  </Text>
                  <View style={styles.rarityRow}>
                    <View style={[styles.rarityDot, { backgroundColor: rarity.color }]} />
                    <Text style={[styles.rarity, { color: rarity.color }]}>{t(`rarity.${item.rarity}` as TranslationKey)}</Text>
                  </View>
                  <View style={{ marginTop: 8 }}>{action(item, true)}</View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Como ganhar moedas */}
      <View style={styles.earn}>
        <CoinIcon size={20} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.earnTitle}>{t('shop.earnTitle')}</Text>
          <Text style={styles.earnText}>{isLocalMode() ? t('shop.hintLocal') : t('shop.hintOnline')}</Text>
        </View>
      </View>

      {storeOk && (
        <Button small variant="ghost" title={t('shop.restore')} iconName="refresh" loading={busy === 'restore'} onPress={restore} />
      )}

      {preview && (preview.type === 'board' || preview.type === 'pieces' || preview.type === 'entrance') && (
        <ItemPreviewModal
          item={preview}
          board={look.board}
          pieces={look.pieces}
          owned={owns(preview.id)}
          equipped={user.equipped[preview.type] === preview.id}
          coins={user.coins}
          storePrice={preview.iap ? prices[preview.iap] : undefined}
          busy={busy === preview.id}
          free={dev}
          onBuy={() => (dev ? run(preview.id, 'buy') : preview.iap ? buyReal(preview) : confirmBuy(preview))}
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

/** Fundo da arte do item: o mesmo tom escuro, levemente puxado para a cor da raridade. */
function tintFor(rarity: ShopItem['rarity']) {
  return { comum: '#202a52', raro: '#1c2c55', epico: '#262458', lendario: '#2c2a50' }[rarity];
}

function PriceButton({
  label,
  icon,
  coin,
  kind,
  wide,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  coin?: boolean;
  kind: 'gold' | 'outline' | 'locked';
  wide?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const fg = kind === 'gold' ? colors.accentText : kind === 'locked' ? colors.textMuted : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.priceBtn,
        kind === 'gold' && { backgroundColor: colors.accent, borderBottomWidth: 4, borderBottomColor: colors.accentDark },
        kind === 'outline' && { borderWidth: 1.5, borderColor: colors.borderStrong, borderBottomWidth: 4, borderBottomColor: colors.shadow },
        kind === 'locked' && { backgroundColor: colors.raised },
        wide && styles.wide,
        pressed && { opacity: 0.8 },
        loading && { opacity: 0.6 },
      ]}
    >
      {coin && <CoinIcon size={16} />}
      {icon && <Icon name={icon} size={15} color={fg} strokeWidth={2} />}
      <Text style={[styles.priceText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 15, fontFamily: fonts.regular },
  eyebrow: { color: colors.textFaint, fontSize: 11, fontFamily: fonts.black, letterSpacing: 1.3, textTransform: 'uppercase' },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: colors.shadow,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 32, fontVariant: ['tabular-nums'] },
  daily: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: colors.accentDark,
  },
  dailyText: { color: colors.accentText, fontFamily: fonts.black, fontSize: 14 },
  dailyDone: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150 },
  dailyDoneText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, flexShrink: 1 },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(220, 171, 79, 0.3)',
  },
  devText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 13, flex: 1 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 4,
    borderBottomColor: colors.shadow,
  },
  catActive: { backgroundColor: colors.accent, borderColor: colors.accent, borderBottomColor: colors.accentDark },
  catIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  catText: { color: colors.text, fontFamily: fonts.black, fontSize: 13 },
  catCount: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 },
  collection: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  filter: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: colors.border },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  filterOn: { backgroundColor: colors.raised },
  filterText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12 },
  featured: {
    flexDirection: 'row',
    gap: 14,
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: '#24285e',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: colors.shadow,
  },
  featuredArt: { width: 132, height: 132, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artBadge: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 14, 12, 0.75)',
  },
  featuredBody: { flex: 1, paddingVertical: 6, paddingRight: 6, gap: 4 },
  featuredTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featuredName: { color: colors.text, fontFamily: fonts.display, fontSize: 21, lineHeight: 25 },
  featuredDesc: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  featuredAction: { flexDirection: 'row', marginTop: 'auto', paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: colors.shadow,
    padding: 6,
  },
  art: { borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cornerTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 14, 12, 0.7)',
  },
  cardBody: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8, gap: 3 },
  name: { color: colors.text, fontSize: 15.5, fontFamily: fonts.display },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rarityDot: { width: 6, height: 6, borderRadius: 3 },
  rarity: { fontSize: 12, fontFamily: fonts.bold },
  priceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  wide: { alignSelf: 'stretch' },
  priceText: { fontFamily: fonts.black, fontSize: 14, fontVariant: ['tabular-nums'] },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 185, 66, 0.45)',
    borderStyle: 'dashed',
  },
  lockedText: { color: colors.accent, fontFamily: fonts.black, fontSize: 12.5, flexShrink: 1 },
  state: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36 },
  stateText: { fontFamily: fonts.bold, fontSize: 14 },
  moveArt: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  moveBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  earn: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  earnTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  earnText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  fitting: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fittingScene: { width: '100%', height: 260 },
  fittingBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  fittingName: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
});

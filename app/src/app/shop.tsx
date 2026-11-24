import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { CharacterThumb } from '../components/Character';
import { ItemPreviewModal } from '../components/ItemPreviewModal';
import { ItemPreview } from '../components/ItemThumb';
import { Finale } from '../components/Finale';
import { Button, Card, Screen } from '../components/ui';
import { CoinIcon, Icon, type IconName } from '../components/Icon';
import { api, isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { gearName, itemDescription, itemName } from '../lib/catalogI18n';
import { confirmAction } from '../lib/confirm';
import { AI_CHARACTER, evolvedLook, RARITY, useCosmetics, useFullLook, useMyLook, type FullLook } from '../lib/cosmetics';
import { colors, fonts, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';
import { useToast } from '../lib/toast';
import { buyWithStore, iapSupported, loadPrices, restoreStorePurchases } from '../lib/iap';
import { translateServerText, useT, type TranslationKey } from '../lib/i18n';
import type { CharacterStyle, ItemType, PrivateUser, ShopItem } from '../lib/types';

type EvolutionItem = Extract<ShopItem, { type: 'evolution' }>;

const TABS: { type: ItemType; label: TranslationKey; icon: IconName; color: string }[] = [
  { type: 'evolution', label: 'shop.tabEvolutions', icon: 'sparkle', color: '#ffc83d' },
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
  // Abre nas Evoluções: são o destaque da loja.
  const [tab, setTab] = useState<ItemType>(() => TABS.find((x) => x.type === params.tab)?.type ?? 'evolution');
  const scroll = useRef<ScrollViewInstance>(null);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const { width } = useWindowDimensions();
  // Duas colunas; a largura da tela (até 640) menos as margens e o espaço entre os cartões.
  const cardW = Math.floor((Math.min(width, 640) - 32 - 12) / 2);
  // Cartão do carrossel de Evoluções: quase a largura toda, deixando o próximo aparecer.
  const heroW = Math.floor((Math.min(width, 640) - 32) * 0.84);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ShopItem | null>(null);
  /** Boneco (ou evolução) exibido no provador 3D. */
  const [trying, setTrying] = useState<string | null>(null);
  /** No provador da aba Bonecos: mostrar a versão evoluída. */
  const [showEvolved, setShowEvolved] = useState(false);
  /** Preços das lojas (Play Store / App Store) para os itens lendários. */
  const [prices, setPrices] = useState<Record<string, string>>({});
  const storeOk = iapSupported();
  useEffect(() => {
    if (!storeOk) return;
    loadPrices(items.filter((i) => i.iap).map((i) => i.iap!)).then(setPrices);
  }, [storeOk, items]);
  const myCharacter = useFullLook(user?.equipped.character, user?.equipped.evolution);
  const evolutions = useMemo(() => items.filter((i): i is EvolutionItem => i.type === 'evolution'), [items]);
  const evolutionFor = (characterId: string) => evolutions.find((e) => e.style.character === characterId);

  // Provador: na aba Evoluções mostra a evolução escolhida; na aba Bonecos, o boneco (normal ou evoluído).
  const fittingId =
    tab === 'evolution'
      ? trying && evolutions.some((e) => e.id === trying)
        ? trying
        : (evolutions.find((e) => user?.equipped.evolution === e.id) ?? evolutions[evolutions.length - 4] ?? evolutions[0])?.id
      : (trying && items.find((i) => i.id === trying)?.type === 'character' ? trying : user?.equipped.character);
  const fitting = items.find((i) => i.id === fittingId);
  const fittingLook: FullLook | null = useMemo(() => {
    if (fitting?.type === 'evolution') {
      const ch = items.find((i) => i.id === fitting.style.character);
      return ch?.type === 'character' ? evolvedLook({ ...ch.style, id: ch.id }, fitting.style) : null;
    }
    if (fitting?.type === 'character') {
      const evo = items.find((i): i is EvolutionItem => i.type === 'evolution' && i.style.character === fitting.id);
      const base = { ...fitting.style, id: fitting.id };
      return showEvolved && evo ? evolvedLook(base, evo.style) : base;
    }
    return null;
  }, [fitting, items, showEvolved]);
  const fittingFactory = useMemo(
    () => (fittingLook ? createShowcaseScene({ look: fittingLook, board: look.board, bg: colors.surface }) : null),
    [fittingLook, look.board],
  );

  const all = useMemo(
    () =>
      tab === 'evolution'
        ? evolutions
        : items.filter((i) => i.type === tab).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.price - b.price),
    [items, tab, evolutions],
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

  /** Volta ao visual normal do boneco (desliga a evolução). */
  const useNormal = async () => {
    setBusy('normal');
    try {
      const r = await api<{ user: PrivateUser }>('/shop/unequip', { body: { type: 'evolution' } });
      setUser(r.user);
      toast(t('shop.evoOff'), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

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
  const featured = onlyOwned || tab === 'evolution'
    ? undefined
    : [...all].reverse().find((i) => !owns(i.id) && i.rarity !== 'comum' && i.type !== 'avatar');
  const grid = list.filter((i) => i.id !== featured?.id);

  const open = (item: ShopItem) => {
    if (item.type === 'character' || item.type === 'evolution') {
      setTrying(item.id);
      setShowEvolved(false);
      scroll.current?.scrollTo({ y: 0, animated: true });
    } else if (item.type !== 'avatar') setPreview(item);
  };

  /** Abre uma evolução no provador (a partir do carrossel de destaque). */
  const openEvolution = (evo: EvolutionItem) => {
    setTab('evolution');
    setOnlyOwned(false);
    setTrying(evo.id);
  };

  const isActive = (item: ShopItem) =>
    item.type === 'evolution'
      ? user.equipped.evolution === item.id && user.equipped.character === item.style.character
      : user.equipped[item.type] === item.id;

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
    const equipped = isActive(item);
    const loading = busy === item.id;
    // O Guardião Paladino precisa do Guardião da Torre (recompensa da IA), que não vem junto.
    const needsReward = item.type === 'evolution' && !owns(item.style.character) ? items.find((i) => i.id === item.style.character)?.unlock : undefined;
    if (equipped)
      return (
        <View style={[styles.state, wide && styles.wide]}>
          <Icon name="check" size={15} color={colors.success} strokeWidth={2.4} />
          <Text style={[styles.stateText, { color: colors.success }]}>{t('common.equipped')}</Text>
        </View>
      );
    if (owned && needsReward)
      return (
        <View style={[styles.locked, wide && styles.wide]}>
          <Icon name="lockFill" size={14} color={colors.accent} />
          <Text style={styles.lockedText} numberOfLines={1}>
            {t('badges.rewardHint', { name: t(`ai.${needsReward}.name` as TranslationKey) })}
          </Text>
        </View>
      );
    if (owned)
      return (
        <PriceButton
          label={item.type === 'evolution' ? t('shop.wear') : t('common.equip')}
          kind="outline"
          wide={wide}
          loading={loading}
          onPress={() => run(item.id, 'equip')}
        />
      );
    if (dev)
      return <PriceButton label={t('shop.devFree')} icon="wrench" kind="gold" wide={wide} loading={loading} onPress={() => run(item.id, 'buy')} />;
    // Recompensa exclusiva: não se compra, se ganha vencendo a IA.
    const lockLevel = item.unlock ?? needsReward;
    if (lockLevel)
      return (
        <View style={[styles.locked, wide && styles.wide]}>
          <Icon name="lockFill" size={14} color={colors.accent} />
          <Text style={styles.lockedText} numberOfLines={1}>
            {t('badges.rewardHint', { name: t(`ai.${lockLevel}.name` as TranslationKey) })}
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
    <Screen scrollRef={scroll} style={{ gap: 18, paddingBottom: 40 }}>
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

      {/* Destaque: carrossel das Evoluções (compra com dinheiro real) */}
      {tab !== 'evolution' && evolutions.length > 0 && (
        <View style={{ gap: 10 }}>
          <EvoHeader count={evolutions.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={heroW + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {evolutions.map((evo) => (
              <EvoCard key={evo.id} evo={evo} width={heroW} compact onOpen={() => openEvolution(evo)} action={action(evo, true)} owned={owns(evo.id)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Categorias: todas visíveis de uma vez (grade), com quantos itens você já tem em cada. */}
      {/* Evoluções: categoria de destaque, larga e dourada */}
      {(() => {
        const active = tab === 'evolution';
        const mine = evolutions.filter((e) => owns(e.id)).length;
        return (
          <Pressable
            testID="cat-evolution"
            onPress={() => {
              setTab('evolution');
              setOnlyOwned(false);
            }}
            style={({ pressed }) => [styles.catEvo, active && styles.catEvoActive, pressed && { transform: [{ translateY: 2 }] }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.catIcon, { backgroundColor: active ? 'rgba(42,26,0,0.14)' : 'rgba(255,200,61,0.2)' }]}>
              <Icon name="sparkle" size={20} color={active ? colors.accentText : '#ffc83d'} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.catEvoTitle, active && { color: colors.accentText }]}>{t('shop.tabEvolutions')}</Text>
                <Text style={styles.newChip}>{t('shop.new')}</Text>
              </View>
              <Text style={[styles.catCount, active && { color: '#5c3d00' }]}>
                {mine}/{evolutions.length}
              </Text>
            </View>
            <View style={styles.catEvoArt}>
              {['char_ninja', 'char_wizard', 'char_king'].map((id, i) => (
                <View key={id} style={{ marginLeft: i ? -18 : 0 }}>
                  <CharacterThumb look={{ id, evolution: 'x' }} size={46} />
                </View>
              ))}
            </View>
          </Pressable>
        );
      })()}
      <View style={styles.cats} accessibilityRole="tablist">
        {TABS.filter((tb) => tb.type !== 'evolution').map((tb) => {
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

      {(tab === 'character' || tab === 'evolution') && fittingFactory && fittingLook && fitting && (
        <View style={[styles.fitting, fitting.type === 'evolution' && { borderColor: fitting.style.color, borderWidth: 2 }]}>
          <Scene3D
            key={`${fitting.id}-${fittingLook.evolution ?? 'n'}`}
            factory={fittingFactory}
            style={styles.fittingScene}
            fallback={<CharacterThumb look={fittingLook} size={200} />}
          />
          {fitting.type === 'evolution' && (
            <View style={[styles.evoRibbon, { backgroundColor: fitting.style.color }]}>
              <Icon name="sparkle" size={13} color="#1a1200" strokeWidth={2.4} />
              <Text style={styles.evoRibbonText}>{t('shop.evoBadge')}</Text>
            </View>
          )}
          {fitting.type === 'character' && evolutionFor(fitting.id) && (
            <View style={styles.toggle}>
              {[false, true].map((on) => (
                <Pressable
                  key={String(on)}
                  testID={on ? 'fit-evolved' : 'fit-normal'}
                  onPress={() => setShowEvolved(on)}
                  style={[styles.toggleBtn, showEvolved === on && { backgroundColor: on ? evolutionFor(fitting.id)!.style.color : colors.raised }]}
                >
                  {on && <Icon name="sparkle" size={13} color={showEvolved ? '#1a1200' : colors.textMuted} strokeWidth={2.2} />}
                  <Text style={[styles.toggleText, showEvolved === on && { color: on ? '#1a1200' : colors.text }]}>{on ? t('shop.evolved') : t('shop.normal')}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.fittingBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{fitting.type === 'evolution' ? t('shop.evoIncludesShort') : t('shop.fittingRoom')}</Text>
              <Text style={styles.fittingName}>
                {fitting.type === 'character' && showEvolved && evolutionFor(fitting.id) ? itemName(evolutionFor(fitting.id)!, lang) : itemName(fitting, lang)}
              </Text>
              {fitting.type === 'evolution' && <Text style={styles.fittingSub}>{t('shop.evoIncludes', { gear: gearName(fitting, lang) })}</Text>}
            </View>
            {fitting.type === 'character' && showEvolved && evolutionFor(fitting.id)
              ? action(evolutionFor(fitting.id)!)
              : action(fitting)}
          </View>
          {fitting.type === 'evolution' && isActive(fitting) && (
            <Button small variant="ghost" title={t('shop.useNormal')} loading={busy === 'normal'} onPress={useNormal} />
          )}
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

      {tab === 'evolution' ? (
        <View style={{ gap: 12 }}>
          <EvoHeader count={evolutions.length} />
          {list.map((evo) =>
            evo.type === 'evolution' ? (
              <EvoCard key={evo.id} evo={evo} width={Math.min(width, 640) - 32} onOpen={() => open(evo)} action={action(evo, true)} owned={owns(evo.id)} selected={fittingId === evo.id} />
            ) : null,
          )}
        </View>
      ) : grid.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bag" size={26} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('shop.noneOwned')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {grid.map((item) => {
            const equipped = isActive(item);
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
                  {item.type === 'character' && evolutionFor(item.id) && (
                    <View style={[styles.evoTag, { backgroundColor: evolutionFor(item.id)!.style.color }]}>
                      <Icon name="sparkle" size={11} color="#1a1200" strokeWidth={2.4} />
                      <Text style={styles.evoTagText}>{owns(evolutionFor(item.id)!.id) ? t('shop.evoOwned') : t('shop.evoBadge')}</Text>
                    </View>
                  )}
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

/** Título da seção de Evoluções, com selo de novidade. */
function EvoHeader({ count }: { count: number }) {
  const { t } = useT();
  return (
    <View style={styles.evoHead}>
      <View style={styles.evoHeadIcon}>
        <Icon name="sparkle" size={18} color="#1a1200" strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.evoHeadTitle}>{t('shop.evoTitle')}</Text>
          <Text style={styles.newChip}>{t('shop.new')}</Text>
        </View>
        <Text style={styles.evoHeadSub}>{t('shop.evoSubtitle', { count })}</Text>
      </View>
    </View>
  );
}

/** Cartão de uma Evolução: antes → depois, o que vem junto e o botão de compra. */
function EvoCard({
  evo,
  width,
  compact,
  selected,
  owned,
  action,
  onOpen,
}: {
  evo: EvolutionItem;
  width: number;
  compact?: boolean;
  selected?: boolean;
  owned: boolean;
  action: ReactNode;
  onOpen: () => void;
}) {
  const { t, lang } = useT();
  const { get } = useCosmetics();
  const ch = get(evo.style.character);
  const imgH = compact ? 150 : 170;
  return (
    <Pressable
      testID={`evo-${evo.id}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.evoCard,
        { width, borderColor: selected ? evo.style.color : `${evo.style.color}66`, backgroundColor: `${evo.style.color}1f` },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.evoArt, { height: imgH }]}>
        <View style={[styles.evoHalo, { backgroundColor: `${evo.style.color}40`, width: imgH * 0.95, height: imgH * 0.95, borderRadius: imgH }]} />
        <View style={{ opacity: 0.55, alignItems: 'center' }}>
          <CharacterThumb look={{ id: evo.style.character }} size={imgH * 0.66} />
          <Text style={styles.evoSmall} numberOfLines={1}>{ch ? itemName(ch, lang) : ''}</Text>
        </View>
        <Icon name="chevron" size={22} color={evo.style.color} strokeWidth={3} />
        <CharacterThumb look={{ id: evo.style.character, evolution: evo.style.outfit }} size={imgH} />
        <View style={[styles.evoEmoji, { backgroundColor: evo.style.color }]}>
          <Text style={{ fontSize: 15 }}>{evo.style.emoji}</Text>
        </View>
        {owned && (
          <View style={styles.evoOwned}>
            <Icon name="check" size={12} color={colors.success} strokeWidth={2.6} />
          </View>
        )}
      </View>
      <View style={{ gap: 3 }}>
        <Text style={[styles.eyebrow, { color: evo.style.color }]}>{t('shop.evoBadge')} · {t('rarity.lendario')}</Text>
        <Text style={styles.evoName} numberOfLines={1}>{itemName(evo, lang)}</Text>
        <Text style={styles.evoDesc} numberOfLines={compact ? 2 : 3}>{itemDescription(evo, lang)}</Text>
        <View style={styles.evoIncl}>
          {[t('shop.inclOutfit'), gearName(evo, lang), t('shop.inclCharacter')].map((x) => (
            <View key={x} style={styles.evoChip}>
              <Icon name="check" size={11} color={evo.style.color} strokeWidth={2.6} />
              <Text style={styles.evoChipText} numberOfLines={1}>{x}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ marginTop: 4 }}>{action}</View>
    </Pressable>
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
  catEvo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 200, 61, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 61, 0.6)',
    borderBottomWidth: 4,
    borderBottomColor: colors.accentDark,
    marginBottom: -8,
  },
  catEvoActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catEvoTitle: { color: colors.text, fontFamily: fonts.black, fontSize: 15 },
  catEvoArt: { flexDirection: 'row', alignItems: 'flex-end' },
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
  fittingSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  evoRibbon: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  evoRibbonText: { color: '#1a1200', fontFamily: fonts.black, fontSize: 12 },
  toggle: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', backgroundColor: 'rgba(10,12,30,0.75)', borderRadius: 999, padding: 3 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  toggleText: { color: colors.textMuted, fontFamily: fonts.black, fontSize: 12.5 },
  evoTag: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  evoTagText: { color: '#1a1200', fontFamily: fonts.black, fontSize: 10.5 },
  evoHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  evoHeadIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#ffc83d', alignItems: 'center', justifyContent: 'center' },
  evoHeadTitle: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22 },
  evoHeadSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  newChip: { color: '#1a1200', backgroundColor: '#2ee59d', fontFamily: fonts.black, fontSize: 10.5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  evoCard: { borderRadius: radius.lg, borderWidth: 2, padding: 12, gap: 8, borderBottomWidth: 5 },
  evoArt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  evoHalo: { position: 'absolute', right: '18%' },
  evoSmall: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10.5, maxWidth: 90 },
  evoEmoji: { position: 'absolute', right: 6, bottom: 6, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  evoOwned: { position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(15,14,12,0.7)', alignItems: 'center', justifyContent: 'center' },
  evoName: { color: colors.text, fontFamily: fonts.display, fontSize: 21 },
  evoDesc: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  evoIncl: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  evoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(10,12,30,0.45)' },
  evoChipText: { color: colors.text, fontFamily: fonts.bold, fontSize: 11.5 },
});

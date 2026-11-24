import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Button, Card, EmptyState, Screen } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { ItemPreview } from '../components/ItemThumb';
import { Emblem } from '../components/Emblem';
import { Flag } from '../components/Flag';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BADGES } from '../lib/badges';
import { itemName } from '../lib/catalogI18n';
import { DEFAULT_LOOK, useCosmetics, useMyLook } from '../lib/cosmetics';
import { translateServerText, useT, type TranslationKey } from '../lib/i18n';
import { colors, fonts, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
import type { ItemType, PrivateUser, ShopItem } from '../lib/types';

/** Categorias na ordem em que aparecem (o que mais muda o visual vem primeiro). */
const SECTIONS: { type: ItemType; label: TranslationKey; icon: IconName; color: string }[] = [
  { type: 'character', label: 'shop.tabCharacters', icon: 'user', color: '#6fb8ff' },
  { type: 'evolution', label: 'me.evolution', icon: 'sparkle', color: '#ffc83d' },
  { type: 'avatar', label: 'shop.tabAvatars', icon: 'smile', color: '#ff7f7f' },
  { type: 'board', label: 'shop.tabBoards', icon: 'board', color: '#f4b942' },
  { type: 'pieces', label: 'shop.tabPieces', icon: 'knight', color: '#a68bff' },
  { type: 'entrance', label: 'shop.tabEntrances', icon: 'sparkle', color: '#36d1b5' },
  { type: 'move', label: 'shop.tabMoves', icon: 'music', color: '#ff9ce6' },
];

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * "Meu perfil": troca de nome, emblema e tudo o que o jogador já tem (boneco, ícone, tabuleiro,
 * peças, surgimento e finalização), sem precisar passar pela loja.
 */
export default function MyProfile() {
  const { user, setUser } = useAuth();
  const { items } = useCosmetics();
  const look = useMyLook();
  const { t, lang } = useT();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.username ?? '');

  const owned = useMemo(() => {
    const inv = new Set(user?.inventory ?? []);
    const map = new Map<ItemType, ShopItem[]>();
    for (const it of items) {
      // Os itens grátis do começo também contam (contas antigas podem não ter no inventário).
      if (!inv.has(it.id) && DEFAULT_LOOK[it.type] !== it.id) continue;
      map.set(it.type, [...(map.get(it.type) ?? []), it]);
    }
    return map;
  }, [items, user?.inventory]);

  if (!user) {
    return (
      <Screen>
        <EmptyState iconName="user" text={t('me.guest')} />
        <Button title={t('common.createAccount')} onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  /** Item em uso agora (a evolução só conta se o boneco dela estiver equipado). */
  const isOn = (item: ShopItem) =>
    item.type === 'evolution'
      ? user.equipped.evolution === item.id && user.equipped.character === item.style.character
      : (user.equipped[item.type] ?? DEFAULT_LOOK[item.type]) === item.id;

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

  const equip = async (item: ShopItem) => {
    if (isOn(item)) return;
    setBusy(item.id);
    try {
      const r = await api<{ user: PrivateUser }>('/shop/equip', { body: { itemId: item.id } });
      setUser(r.user);
      toast(t('shop.equippedToast', { name: itemName(item, lang) }), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  const nameValid = USERNAME_RE.test(name.trim());
  const saveName = async () => {
    const next = name.trim();
    if (next === user.username) return setEditing(false);
    setBusy('name');
    try {
      const r = await api<{ user: PrivateUser }>('/me/username', { body: { username: next } });
      setUser(r.user);
      setEditing(false);
      toast(t('me.nameSaved'), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  const selectBadge = async (badge: string | null) => {
    setBusy(badge ?? 'nobadge');
    try {
      const r = await api<{ user: PrivateUser }>('/badges/select', { body: { badge } });
      setUser(r.user);
      toast(badge ? t('badges.showing') : t('badges.hidden'), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(null);
    }
  };

  const badges = BADGES.filter((b) => (user.badges ?? []).includes(b.id));

  return (
    <Screen>
      {/* Cartão do jogador: ícone, nome (com troca) e emblema */}
      <Card style={styles.idCard}>
        <Avatar name={user.username} size={76} icon={user.equipped.avatar} />
        {editing ? (
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <Text style={styles.label}>{t('me.newName')}</Text>
            <TextInput
              testID="me-name"
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={[styles.input, !nameValid && name.length > 0 && { borderColor: colors.danger }]}
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={() => nameValid && saveName()}
              returnKeyType="done"
            />
            <Text style={styles.help}>{t('me.nameRules')}</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button title={t('common.cancel')} variant="secondary" onPress={() => { setEditing(false); setName(user.username); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('settings.save')} loading={busy === 'name'} disabled={!nameValid} onPress={saveName} />
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.nameRow}>
              {user.country ? <Flag code={user.country} size={16} /> : null}
              <Text style={styles.name} numberOfLines={1}>{user.username}</Text>
              {user.badge ? <Emblem id={user.badge} size={26} /> : null}
            </View>
            <Pressable
              testID="me-edit-name"
              onPress={() => { setName(user.username); setEditing(true); }}
              style={styles.editBtn}
              hitSlop={6}
            >
              <Icon name="pencil" size={14} color={colors.accent} strokeWidth={2.4} />
              <Text style={styles.editText}>{t('me.changeName')}</Text>
            </Pressable>
          </>
        )}
      </Card>

      {/* Emblema que aparece ao lado do nome */}
      <SectionHead icon="medalFill" color={colors.accent} title={t('badges.title')} />
      {badges.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          <Pressable onPress={() => user.badge && selectBadge(null)} style={[styles.badgeTile, !user.badge && styles.tileOn]}>
            <View style={styles.noBadge}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.tileName}>{t('me.noBadge')}</Text>
          </Pressable>
          {badges.map((b) => {
            const on = user.badge === b.id;
            return (
              <Pressable key={b.id} onPress={() => !on && selectBadge(b.id)} style={[styles.badgeTile, on && styles.tileOn]}>
                <Emblem id={b.id} size={44} />
                <Text style={styles.tileName} numberOfLines={1}>{t(`ai.${b.level}.name` as TranslationKey)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Pressable onPress={() => router.push('/ai')} style={styles.hintCard}>
          <Emblem id="ai_1" size={36} locked />
          <Text style={styles.hintText}>{t('badges.howTo')}</Text>
          <Icon name="chevron" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      {/* Uma faixa por categoria com tudo o que o jogador já tem */}
      {SECTIONS.map((s) => {
        const list = owned.get(s.type) ?? [];
        const total = items.filter((i) => i.type === s.type).length;
        const evoActive = list.some((i) => isOn(i));
        return (
          <View key={s.type} style={{ gap: 8 }}>
            <SectionHead icon={s.icon} color={s.color} title={t(s.label)} count={`${list.length}/${total}`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {s.type === 'evolution' && list.length > 0 && (
                <Pressable
                  testID="me-evo-normal"
                  onPress={useNormal}
                  disabled={busy !== null || !evoActive}
                  style={[styles.tile, !evoActive && styles.tileOn, busy === 'normal' && { opacity: 0.6 }]}
                >
                  <View style={styles.thumb}>
                    <ItemPreview item={items.find((i) => i.id === user.equipped.character) ?? list[0]} board={look.board} pieces={look.pieces} username={user.username} size={84} />
                  </View>
                  <Text style={styles.tileName} numberOfLines={1}>{t('me.normalLook')}</Text>
                  {!evoActive ? (
                    <View style={styles.onChip}>
                      <Icon name="check" size={11} color={colors.accentText} strokeWidth={3} />
                      <Text style={styles.onText}>{t('common.equipped')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.useText}>{t('me.use')}</Text>
                  )}
                </Pressable>
              )}
              {list.map((item) => {
                const on = isOn(item);
                return (
                  <Pressable
                    key={item.id}
                    testID={`me-${item.id}`}
                    accessibilityLabel={itemName(item, lang)}
                    onPress={() => equip(item)}
                    disabled={busy !== null}
                    style={[styles.tile, on && styles.tileOn, busy === item.id && { opacity: 0.6 }]}
                  >
                    <View style={styles.thumb}>
                      <ItemPreview item={item} board={look.board} pieces={look.pieces} username={user.username} size={84} />
                    </View>
                    <Text style={styles.tileName} numberOfLines={1}>{itemName(item, lang)}</Text>
                    {on ? (
                      <View style={styles.onChip}>
                        <Icon name="check" size={11} color={colors.accentText} strokeWidth={3} />
                        <Text style={styles.onText}>{t('common.equipped')}</Text>
                      </View>
                    ) : (
                      <Text style={styles.useText}>{t('me.use')}</Text>
                    )}
                  </Pressable>
                );
              })}
              <Pressable onPress={() => router.push(`/shop?tab=${s.type}`)} style={[styles.tile, styles.moreTile]}>
                <View style={[styles.moreIcon, { backgroundColor: s.color }]}>
                  <Icon name="plus" size={22} color={colors.accentText} strokeWidth={3} />
                </View>
                <Text style={styles.moreText}>{t('me.more')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        );
      })}
    </Screen>
  );
}

function SectionHead({ icon, color, title, count }: { icon: IconName; color: string; title: string; count?: string }) {
  return (
    <View style={styles.head}>
      <View style={[styles.headIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={15} color={colors.accentText} strokeWidth={2.4} />
      </View>
      <Text style={styles.headTitle}>{title}</Text>
      {count ? <Text style={styles.headCount}>{count}</Text> : null}
    </View>
  );
}

const TILE = 112;

const styles = StyleSheet.create({
  idCard: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  name: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 26, flexShrink: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.accentSoft,
  },
  editText: { color: colors.accent, fontFamily: fonts.black, fontSize: 13 },
  label: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 13 },
  input: {
    backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.bold, fontSize: 17,
  },
  help: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  headIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, flex: 1 },
  headCount: { color: colors.textFaint, fontFamily: fonts.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  strip: { gap: 10, paddingRight: 4, paddingBottom: 4 },
  tile: {
    width: TILE, alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 6,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    borderBottomWidth: 5, borderBottomColor: colors.shadow,
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  thumb: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  tileName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12.5, maxWidth: TILE - 12 },
  onChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.accent,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  onText: { color: colors.accentText, fontFamily: fonts.black, fontSize: 11 },
  useText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11.5, paddingVertical: 2 },
  moreTile: { justifyContent: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' },
  moreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12.5, textAlign: 'center' },
  badgeTile: {
    width: 88, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderBottomWidth: 5, borderBottomColor: colors.shadow,
  },
  noBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  hintText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, flex: 1, lineHeight: 18 },
});

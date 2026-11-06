import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CharacterThumb } from '../components/Character';
import { SquarePattern } from '../components/ChessBoard';
import { ChessPiece, type PieceType } from '../components/ChessPiece';
import { Finale } from '../components/Finale';
import { Avatar, Button, Card, Coins, Screen } from '../components/ui';
import { api, isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { confirmAction } from '../lib/confirm';
import { AI_CHARACTER, RARITY, useCharacterStyle, useCosmetics, useMyLook } from '../lib/cosmetics';
import { colors, fonts, radius } from '../lib/theme';
import { Scene3D } from '../three/Scene3D';
import { createShowcaseScene } from '../three/scenes';
import { useToast } from '../lib/toast';
import type { BoardStyle, CharacterStyle, ItemType, PieceStyle, PrivateUser, ShopItem } from '../lib/types';

const TABS: { type: ItemType; label: string; icon: string }[] = [
  { type: 'board', label: 'Tabuleiros', icon: '🟫' },
  { type: 'pieces', label: 'Peças', icon: '♞' },
  { type: 'avatar', label: 'Ícones', icon: '🙂' },
  { type: 'character', label: 'Bonecos', icon: '🧍' },
  { type: 'move', label: 'Movimentos', icon: '🕺' },
];

export default function Shop() {
  const { user, setUser } = useAuth();
  const { items } = useCosmetics();
  const look = useMyLook();
  const toast = useToast();
  const [tab, setTab] = useState<ItemType>('board');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ShopItem | null>(null);
  /** Boneco exibido no provador 3D (aba Bonecos). */
  const [trying, setTrying] = useState<string | null>(null);
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
          <Text style={styles.text}>Entre na sua conta para ganhar moedas e comprar itens.</Text>
          <Button title="Entrar" onPress={() => router.push('/login')} />
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
      toast(action === 'buy' ? `${item?.name} comprado e equipado!` : `${item?.name} equipado.`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const claimDaily = async () => {
    try {
      const r = await api<{ user: PrivateUser; amount: number }>('/rewards/daily', { body: {} });
      setUser(r.user);
      toast(`+${r.amount} moedas!`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Screen>
      <Card style={styles.wallet}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.muted}>Seu saldo</Text>
          <Coins amount={user.coins} size={22} />
        </View>
        {user.dailyBonusAvailable ? (
          <Button small title="Bônus diário +50" icon="🎁" onPress={claimDaily} />
        ) : (
          <Text style={styles.muted}>Bônus de hoje{'\n'}já resgatado ✓</Text>
        )}
      </Card>
      <Text style={styles.hint}>
        {isLocalMode()
          ? 'Ganhe moedas vencendo a IA: de 15 (nível 1) a 35 (nível 5) por vitória, mais bônus por vitórias seguidas.'
          : 'Ganhe moedas jogando online: vitória 30 · empate 15 · derrota 5 (amistosas valem metade).'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((t) => (
          <Pressable key={t.type} onPress={() => setTab(t.type)} style={[styles.chip, tab === t.type && styles.chipActive]}>
            <Text style={styles.chipText}>
              {t.icon} {t.label}
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
          <Text style={styles.fittingName}>🪞 Provador: {fitting.name}</Text>
          <Text style={styles.muted}>Toque num boneco para experimentar.</Text>
        </Card>
      )}

      {list.map((item) => {
        const owned = user.inventory.includes(item.id);
        const equipped = user.equipped[item.type] === item.id;
        const rarity = RARITY[item.rarity];
        return (
          <Pressable
            key={item.id}
            onPress={() => item.type === 'character' && setTrying(item.id)}
            style={[styles.item, { borderColor: equipped ? colors.accent : trying === item.id ? colors.primary : colors.border }]}
          >
            <View style={styles.preview}>
              <ItemPreview item={item} board={look.board} pieces={look.pieces} username={user.username} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={[styles.rarity, { color: rarity.color }]}>{rarity.label}</Text>
              {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
              <View style={styles.actions}>
                {item.type === 'move' && (
                  <Button small variant="secondary" title="Ver" icon="▶" onPress={() => setPreview(item)} />
                )}
                {equipped ? (
                  <Text style={styles.equipped}>✓ Equipado</Text>
                ) : owned ? (
                  <Button small variant="secondary" title="Equipar" loading={busy === item.id} onPress={() => run(item.id, 'equip')} />
                ) : (
                  <Button
                    small
                    variant="gold"
                    title={`🪙 ${item.price.toLocaleString('pt-BR')}`}
                    disabled={user.coins < item.price}
                    loading={busy === item.id}
                    onPress={() =>
                      confirmAction(`Comprar ${item.name}?`, `Custa ${item.price} moedas. Você tem ${user.coins}.`, () => run(item.id, 'buy'), 'Comprar')
                    }
                  />
                )}
              </View>
            </View>
          </Pressable>
        );
      })}

      {preview && preview.type === 'move' && (
        <Finale
          visible
          winner={{ name: user.username, look: myCharacter }}
          loser={{ name: 'Rival', look: AI_CHARACTER }}
          move={preview.style.animation}
          moveName={preview.name}
          title="Prévia"
          subtitle={preview.description}
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
  const size = 84;
  const frame = Math.min(board.frame, 5);
  const sq = (size - frame * 2) / 4;
  return (
    <View
      style={{ width: size, height: size, borderWidth: frame, borderColor: board.border, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}
    >
      {MINI_PIECES.map((p, i) => {
        const light = (Math.floor(i / 4) + i) % 2 === 0;
        return (
          <View key={i} style={{ width: sq, height: sq, backgroundColor: light ? board.light : board.dark, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <SquarePattern style={board} index={i * 3 + 7} size={sq} light={light} />
            {p && (
              <ChessPiece type={p[0] as PieceType} color={p[1]} style={pieces} size={sq * 0.95} />
            )}
          </View>
        );
      })}
    </View>
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
  preview: { width: 88, minHeight: 88, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 19, fontFamily: fonts.bold },
  rarity: { fontSize: 12, fontFamily: fonts.black, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  equipped: { color: colors.accent, fontFamily: fonts.black },
  fitting: { padding: 0, overflow: 'hidden', alignItems: 'center', paddingBottom: 12 },
  fittingScene: { width: '100%', height: 240 },
  fittingName: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
});

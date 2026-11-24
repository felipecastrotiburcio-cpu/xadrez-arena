import { StyleSheet, Text, View } from 'react-native';
import { CharacterThumb } from './Character';
import { BoardFrame, isLight, SquareSurface } from './ChessBoard';
import { EntranceDemo } from './PieceEntrance';
import { ChessPiece, type PieceType } from './ChessPiece';
import { Avatar } from './ui';
import { Icon } from './Icon';
import { colors, fonts } from '../lib/theme';
import type { BoardStyle, PieceStyle, ShopItem } from '../lib/types';

/** Miniatura de um item (loja e "Meu perfil"): tabuleiro, peças, ícone, boneco, finalização ou surgimento. */
export function ItemPreview({
  item,
  board,
  pieces,
  username,
  size = 88,
}: {
  item: ShopItem;
  board: BoardStyle;
  pieces: PieceStyle;
  username: string;
  size?: number;
}) {
  switch (item.type) {
    case 'board':
      return <MiniBoard board={item.style} pieces={pieces} size={size} />;
    case 'pieces':
      return <MiniBoard board={board} pieces={item.style} size={size} />;
    case 'avatar':
      return <Avatar name={username} size={Math.round(size * 0.68)} icon={item.id} />;
    case 'character':
      return <CharacterThumb look={{ id: item.id }} size={Math.round(size * 0.95)} />;
    case 'evolution':
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={[styles.evoGlow, { width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4, backgroundColor: `${item.style.color}33` }]} />
          <CharacterThumb look={{ id: item.style.character, evolution: item.style.outfit }} size={Math.round(size * 0.98)} />
          <View style={[styles.evoBadge, { backgroundColor: item.style.color }]}>
            <Text style={{ fontSize: Math.max(11, size * 0.13) }}>{item.style.emoji}</Text>
          </View>
        </View>
      );
    case 'move':
      return (
        <View style={[styles.moveArt, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35 }]}>
          <Text style={{ fontFamily: fonts.regular, fontSize: size * 0.36 }}>{item.style.emoji}</Text>
          <View style={styles.moveBadge}>
            <Icon name="play" size={12} color={colors.accentText} />
          </View>
        </View>
      );
    case 'entrance':
      return <EntranceDemo entrance={item.style} pieceStyle={pieces} light={board.light} dark={board.dark} size={Math.round(size * 0.9)} />;
  }
}

const MINI_PIECES: (null | [string, 'w' | 'b'])[] = [
  ['k', 'b'], null, ['q', 'b'], null,
  null, ['p', 'b'], null, ['n', 'b'],
  ['n', 'w'], null, ['p', 'w'], null,
  null, ['q', 'w'], null, ['k', 'w'],
];

export function MiniBoard({ board, pieces, size = 88 }: { board: BoardStyle; pieces: PieceStyle; size?: number }) {
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
  evoGlow: { position: 'absolute' },
  evoBadge: { position: 'absolute', right: -4, bottom: 2, minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)' },
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
});

import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess, type Square } from 'chess.js';
import { ChessPiece } from './ChessPiece';
import { colors } from '../lib/theme';
import type { BoardStyle, PieceStyle, Side } from '../lib/types';

export interface BoardMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

interface Props {
  fen: string;
  size: number;
  orientation: Side;
  /** Cor que o usuário pode mover (null = tabuleiro bloqueado). */
  movableColor: Side | 'both' | null;
  lastMove?: { from: string; to: string } | null;
  hint?: { from: string; to: string } | null;
  onMove: (move: BoardMove) => void;
  boardStyle: BoardStyle;
  pieceStyle: PieceStyle;
}

const FILES = 'abcdefgh';

function ChessBoardBase({ fen, size: outerSize, orientation, movableColor, lastMove, hint, onMove, boardStyle, pieceStyle }: Props) {
  const size = outerSize - boardStyle.frame * 2;
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen]);

  const turn = chess.turn();
  const canMove = movableColor === 'both' || movableColor === turn;

  const targets = useMemo(() => {
    if (!selected) return new Map<string, { capture: boolean; promotion: boolean }>();
    const map = new Map<string, { capture: boolean; promotion: boolean }>();
    for (const m of chess.moves({ square: selected, verbose: true })) {
      map.set(m.to, { capture: !!m.captured, promotion: !!m.promotion });
    }
    return map;
  }, [chess, selected]);

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) {
      for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square;
    }
    return null;
  }, [chess, turn]);

  const sq = size / 8;

  const handlePress = (square: Square) => {
    if (!canMove) return;
    const target = targets.get(square);
    if (selected && target) {
      if (target.promotion) {
        setPromotion({ from: selected, to: square });
      } else {
        onMove({ from: selected, to: square });
      }
      setSelected(null);
      return;
    }
    const piece = chess.get(square);
    if (piece && piece.color === turn && square !== selected) setSelected(square);
    else setSelected(null);
  };

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'w' ? FILES.split('') : FILES.split('').reverse();

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: 6 + boardStyle.frame / 2,
        borderWidth: boardStyle.frame,
        borderColor: boardStyle.border,
        overflow: 'hidden',
        backgroundColor: boardStyle.border,
      }}
    >
      {ranks.map((rank, ri) => (
        <View key={rank} style={styles.row}>
          {files.map((file, fi) => {
            const square = `${file}${rank}` as Square;
            const light = (FILES.indexOf(file) + rank) % 2 === 1;
            const piece = chess.get(square);
            const target = targets.get(square);
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isHint = hint && (hint.from === square || hint.to === square);
            return (
              <Pressable
                key={square}
                onPress={() => handlePress(square)}
                accessibilityLabel={`${square}${piece ? ` ${piece.color === 'w' ? 'branco' : 'preto'} ${piece.type}` : ''}`}
                style={{ width: sq, height: sq, backgroundColor: light ? boardStyle.light : boardStyle.dark, overflow: 'hidden' }}
              >
                <SquarePattern style={boardStyle} index={FILES.indexOf(file) * 8 + rank} size={sq} light={light} />
                {isLast && <View style={[StyleSheet.absoluteFill, { backgroundColor: boardStyle.highlight }]} />}
                {isHint && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.hint }]} />}
                {selected === square && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.selected }]} />}
                {checkSquare === square && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.check, borderRadius: sq / 2 }]} />
                )}
                {fi === 0 && (
                  <Text style={[styles.coord, styles.rankCoord, { color: light ? boardStyle.coord.light : boardStyle.coord.dark }]}>
                    {rank}
                  </Text>
                )}
                {ri === 7 && (
                  <Text style={[styles.coord, styles.fileCoord, { color: light ? boardStyle.coord.light : boardStyle.coord.dark }]}>
                    {file}
                  </Text>
                )}
                {piece && (
                  <View style={[StyleSheet.absoluteFill, styles.pieceBox]} pointerEvents="none">
                    <ChessPiece type={piece.type} color={piece.color} style={pieceStyle} size={sq} />
                  </View>
                )}
                {target &&
                  (target.capture ? (
                    <View style={[styles.captureRing, { borderRadius: sq / 2, borderWidth: sq * 0.08 }]} />
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        { width: sq * 0.3, height: sq * 0.3, borderRadius: sq, left: sq * 0.35, top: sq * 0.35 },
                      ]}
                    />
                  ))}
              </Pressable>
            );
          })}
        </View>
      ))}

      {promotion && (
        <Pressable style={styles.promoOverlay} onPress={() => setPromotion(null)}>
          <View style={styles.promoBox}>
            {(['q', 'r', 'b', 'n'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.promoOption, { width: sq * 1.1, height: sq * 1.1, backgroundColor: boardStyle.light }]}
                onPress={() => {
                  onMove({ ...promotion, promotion: p });
                  setPromotion(null);
                }}
              >
                <ChessPiece type={p} color={turn} style={pieceStyle} size={sq} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}
    </View>
  );
}

export const ChessBoard = memo(ChessBoardBase);

// Pseudo-aleatório determinístico por casa (o desenho não "pisca" a cada render).
const rand = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Decoração de cada casa: veios, mármore, grade neon, estrelas ou brilho. */
export function SquarePattern({ style, index, size, light }: { style: BoardStyle; index: number; size: number; light: boolean }) {
  const c = style.patternColor;
  switch (style.pattern) {
    case 'grain':
      return (
        <>
          {[0.22, 0.5, 0.78].map((y, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute', left: -2, right: -2, height: 1.5, backgroundColor: c,
                top: size * (y + (rand(index + i) - 0.5) * 0.12), transform: [{ rotate: `${(rand(index * 3 + i) - 0.5) * 6}deg` }],
              }}
            />
          ))}
        </>
      );
    case 'marble':
      return (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: size * 1.6, height: 1.5, backgroundColor: c,
            left: -size * 0.3, top: size * (0.2 + rand(index) * 0.6),
            transform: [{ rotate: `${20 + rand(index * 7) * 40}deg` }],
          }}
        />
      );
    case 'grid':
      return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 0.75, borderColor: c }]} />;
    case 'stars':
      return (
        <>
          {[0, 1].map((i) => {
            const d = 1.5 + rand(index * 5 + i) * 2;
            return rand(index * 11 + i) > (light ? 0.6 : 0.3) ? (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute', width: d, height: d, borderRadius: d, backgroundColor: c,
                  left: rand(index * 13 + i) * (size - d), top: rand(index * 17 + i) * (size - d),
                }}
              />
            ) : null;
          })}
        </>
      );
    case 'shine':
      return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: size * 0.45, backgroundColor: c }} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  pieceBox: { alignItems: 'center', justifyContent: 'center' },
  coord: { position: 'absolute', fontSize: 10, fontWeight: '700' },
  rankCoord: { top: 2, left: 3 },
  fileCoord: { bottom: 1, right: 3 },
  dot: { position: 'absolute', backgroundColor: 'rgba(20, 30, 20, 0.35)' },
  captureRing: { ...StyleSheet.absoluteFill, borderColor: 'rgba(20, 30, 20, 0.4)' },
  promoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promoOption: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

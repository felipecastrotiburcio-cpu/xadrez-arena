import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess, type Square } from 'chess.js';
import { ChessPiece, type PieceType } from './ChessPiece';
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

  // O handler muda a cada render; as casas recebem uma função estável que lê a versão atual.
  const handlerRef = useRef<(square: Square) => void>(() => {});
  handlerRef.current = (square: Square) => {
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
  const onPressSquare = useCallback((square: Square) => handlerRef.current(square), []);

  // Anima só lances novos (não ao desfazer): compara o número de meio-lances.
  const ply = plyOf(fen);
  const prevPly = useRef(ply);
  const animate = ply > prevPly.current;
  useEffect(() => {
    prevPly.current = ply;
  }, [ply]);
  const moving = lastMove ? chess.get(lastMove.to as Square) : null;

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
            const piece = chess.get(square);
            const target = targets.get(square);
            return (
              <BoardSquare
                key={square}
                square={square}
                light={(FILES.indexOf(file) + rank) % 2 === 1}
                pieceType={piece ? piece.type : null}
                pieceColor={piece ? piece.color : null}
                hidePiece={!!moving && lastMove?.to === square}
                last={!!lastMove && (lastMove.from === square || lastMove.to === square)}
                hinted={!!hint && (hint.from === square || hint.to === square)}
                selected={selected === square}
                check={checkSquare === square}
                target={!target ? 0 : target.capture ? 2 : 1}
                rankLabel={fi === 0 ? String(rank) : ''}
                fileLabel={ri === 7 ? file : ''}
                sq={sq}
                boardStyle={boardStyle}
                pieceStyle={pieceStyle}
                onPressSquare={onPressSquare}
              />
            );
          })}
        </View>
      ))}

      {/* A peça do último lance desliza da casa de origem até a de destino. */}
      {lastMove && moving && (
        <MovingPiece
          key={`${lastMove.from}${lastMove.to}${ply}`}
          from={lastMove.from}
          to={lastMove.to}
          pieceType={moving.type}
          pieceColor={moving.color}
          animate={animate}
          orientation={orientation}
          sq={sq}
          pieceStyle={pieceStyle}
        />
      )}

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

/** Duração da animação de deslizar a peça (ms). */
export const SLIDE_MS = 230;

/** Número de meio-lances já jogados, a partir do FEN. */
function plyOf(fen: string) {
  const parts = fen.split(' ');
  return (Number(parts[5]) - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}

const col = (square: string, orientation: Side) => {
  const f = FILES.indexOf(square[0]);
  return orientation === 'w' ? f : 7 - f;
};
const row = (square: string, orientation: Side) => {
  const r = Number(square[1]);
  return orientation === 'w' ? 8 - r : r - 1;
};

interface SquareProps {
  square: Square;
  light: boolean;
  pieceType: string | null;
  pieceColor: Side | null;
  hidePiece: boolean;
  last: boolean;
  hinted: boolean;
  selected: boolean;
  check: boolean;
  /** 0 = nada, 1 = casa livre de destino, 2 = captura possível */
  target: 0 | 1 | 2;
  rankLabel: string;
  fileLabel: string;
  sq: number;
  boardStyle: BoardStyle;
  pieceStyle: PieceStyle;
  onPressSquare: (square: Square) => void;
}

/** Uma casa do tabuleiro. Memorizada: só redesenha quando algo dela muda. */
const BoardSquare = memo(function BoardSquare(p: SquareProps) {
  const { sq, boardStyle, light } = p;
  const coordColor = light ? boardStyle.coord.light : boardStyle.coord.dark;
  return (
    <Pressable
      onPress={() => p.onPressSquare(p.square)}
      accessibilityLabel={`${p.square}${p.pieceType ? ` ${p.pieceColor === 'w' ? 'branco' : 'preto'} ${p.pieceType}` : ''}`}
      style={{ width: sq, height: sq, backgroundColor: light ? boardStyle.light : boardStyle.dark, overflow: 'hidden' }}
    >
      <SquarePattern style={boardStyle} index={FILES.indexOf(p.square[0]) * 8 + Number(p.square[1])} size={sq} light={light} />
      {p.last && <View style={[StyleSheet.absoluteFill, { backgroundColor: boardStyle.highlight }]} />}
      {p.hinted && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.hint }]} />}
      {p.selected && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.selected }]} />}
      {p.check && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.check, borderRadius: sq / 2 }]} />}
      {!!p.rankLabel && <Text style={[styles.coord, styles.rankCoord, { color: coordColor }]}>{p.rankLabel}</Text>}
      {!!p.fileLabel && <Text style={[styles.coord, styles.fileCoord, { color: coordColor }]}>{p.fileLabel}</Text>}
      {p.pieceType && p.pieceColor && !p.hidePiece && (
        <View style={[StyleSheet.absoluteFill, styles.pieceBox]} pointerEvents="none">
          <ChessPiece type={p.pieceType as PieceType} color={p.pieceColor} style={p.pieceStyle} size={sq} />
        </View>
      )}
      {p.target === 2 && <View style={[styles.captureRing, { borderRadius: sq / 2, borderWidth: sq * 0.08 }]} />}
      {p.target === 1 && (
        <View style={[styles.dot, { width: sq * 0.3, height: sq * 0.3, borderRadius: sq, left: sq * 0.35, top: sq * 0.35 }]} />
      )}
    </Pressable>
  );
});

/** Peça do último lance, desenhada por cima do tabuleiro e animada (no thread nativo). */
function MovingPiece({
  from,
  to,
  pieceType,
  pieceColor,
  animate,
  orientation,
  sq,
  pieceStyle,
}: {
  from: string;
  to: string;
  pieceType: string;
  pieceColor: Side;
  animate: boolean;
  orientation: Side;
  sq: number;
  pieceStyle: PieceStyle;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animate, progress]);
  const dx = (col(from, orientation) - col(to, orientation)) * sq;
  const dy = (row(from, orientation) - row(to, orientation)) * sq;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pieceBox,
        {
          position: 'absolute',
          width: sq,
          height: sq,
          left: col(to, orientation) * sq,
          top: row(to, orientation) * sq,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
            // A peça "levanta" um pouco no meio do caminho.
            { scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) },
          ],
        },
      ]}
    >
      <ChessPiece type={pieceType as PieceType} color={pieceColor} style={pieceStyle} size={sq} />
    </Animated.View>
  );
}

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

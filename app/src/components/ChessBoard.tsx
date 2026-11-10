import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess, type Square } from 'chess.js';
import { ChessPiece, tint, type PieceType } from './ChessPiece';
import { FrameArt } from './FrameArt';
import { useT } from '../lib/i18n';
import { colors } from '../lib/theme';
import { playSound, preloadSounds, type BoardSound } from '../lib/sound';
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
  /** Tocar sons dos lances (padrão: sim). */
  sounds?: boolean;
  /** Cor que pode fazer pré-lance enquanto o adversário pensa (null = sem pré-lance). */
  premoveColor?: Side | null;
}

const FILES = 'abcdefgh';

function ChessBoardBase({
  fen, size: outerSize, orientation, movableColor, lastMove, hint, onMove, boardStyle, pieceStyle, sounds = true, premoveColor = null,
}: Props) {
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
  // Pré-lance: na vez do adversário, o jogador já escolhe o próximo lance; ele sai assim que chegar a vez.
  const premoving = !canMove && !!premoveColor && premoveColor !== turn;
  const [premove, setPremove] = useState<BoardMove | null>(null);

  const targets = useMemo(() => {
    const map = new Map<string, { capture: boolean; promotion: boolean; ep?: string }>();
    if (!selected) return map;
    if (premoving && premoveColor) {
      for (const to of premoveTargets(chess, selected, premoveColor)) map.set(to, { capture: false, promotion: false });
      return map;
    }
    for (const m of chess.moves({ square: selected, verbose: true })) {
      // En passant: o peão capturado fica ao lado, não na casa de destino.
      const ep = m.isEnPassant() ? `${m.to[0]}${m.from[1]}` : undefined;
      map.set(m.to, { capture: !!m.captured, promotion: !!m.promotion, ep });
    }
    return map;
  }, [chess, selected, premoving, premoveColor]);
  const epVictim = useMemo(() => {
    for (const t of targets.values()) if (t.ep) return t.ep;
    return null;
  }, [targets]);

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
    if (premoving && premoveColor) {
      if (selected && targets.has(square)) {
        const piece = chess.get(selected);
        const last = square[1] === (premoveColor === 'w' ? '8' : '1');
        setPremove({ from: selected, to: square, ...(piece?.type === 'p' && last ? { promotion: 'q' as const } : {}) });
        setSelected(null);
        return;
      }
      // Tocar em outra casa cancela o pré-lance; tocar numa peça sua começa outro.
      setPremove(null);
      const piece = chess.get(square);
      setSelected(piece && piece.color === premoveColor && square !== selected ? square : null);
      return;
    }
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
    // Lance desfeito ou partida reiniciada: o pré-lance perde o sentido.
    if (ply < prevPly.current) setPremove(null);
    prevPly.current = ply;
  }, [ply]);

  // Chegou a vez: executa o pré-lance se ele for legal agora (senão é descartado).
  useEffect(() => {
    if (!premove) return;
    if (!premoveColor) {
      setPremove(null);
      return;
    }
    if (!canMove) return;
    const legal = chess.moves({ square: premove.from as Square, verbose: true }).some((m) => m.to === premove.to);
    setPremove(null);
    if (legal) onMove(premove);
  }, [premove, canMove, chess, onMove, premoveColor]);

  // Aviso "En passant!" quando um peão captura en passant.
  const [epFlash, setEpFlash] = useState(0);
  const prevEp = useRef<{ ply: number; ep: string }>({ ply, ep: fen.split(' ')[3] });
  useEffect(() => {
    const prev = prevEp.current;
    prevEp.current = { ply, ep: fen.split(' ')[3] };
    if (ply !== prev.ply + 1 || !lastMove || prev.ep === '-' || lastMove.to !== prev.ep) return;
    if (chess.get(lastMove.to as Square)?.type !== 'p' || lastMove.from[0] === lastMove.to[0]) return;
    setEpFlash((n) => n + 1);
    const t = setTimeout(() => setEpFlash(0), 1600);
    return () => clearTimeout(t);
  }, [ply, fen, lastMove, chess]);
  const moving = lastMove ? chess.get(lastMove.to as Square) : null;

  // Sons: lance, captura, xeque e xeque-mate (tocam quando a peça chega à casa).
  const boardPart = fen.split(' ')[0];
  const prevBoard = useRef({ ply, pieces: countPieces(boardPart) });
  useEffect(() => {
    preloadSounds();
  }, []);
  useEffect(() => {
    const prev = prevBoard.current;
    const pieces = countPieces(boardPart);
    prevBoard.current = { ply, pieces };
    if (!sounds || ply !== prev.ply + 1) return;
    const kind: BoardSound = chess.isCheckmate() ? 'mate' : chess.inCheck() ? 'check' : pieces < prev.pieces ? 'capture' : 'move';
    const t = setTimeout(() => playSound(kind), SLIDE_MS * 0.7);
    return () => clearTimeout(t);
  }, [ply, boardPart, chess, sounds]);

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'w' ? FILES.split('') : FILES.split('').reverse();

  return (
    <BoardFrame style={boardStyle} size={outerSize}>
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
                light={isLight(square)}
                pieceType={piece ? piece.type : null}
                pieceColor={piece ? piece.color : null}
                hidePiece={!!moving && lastMove?.to === square}
                last={!!lastMove && (lastMove.from === square || lastMove.to === square)}
                hinted={!!hint && (hint.from === square || hint.to === square)}
                premoved={!!premove && (premove.from === square || premove.to === square)}
                epVictim={epVictim === square}
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

      {epFlash > 0 && (
        <View pointerEvents="none" style={styles.flashWrap}>
          <Text style={styles.flash}>En passant!</Text>
        </View>
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
    </BoardFrame>
  );
}

export const ChessBoard = memo(ChessBoardBase);

/** Duração da animação de deslizar a peça (ms). */
export const SLIDE_MS = 230;

/**
 * Casas para onde a peça poderia ir num pré-lance. Como o adversário ainda vai jogar,
 * vale o movimento "geométrico" da peça (como no Lichess): ignora bloqueios e
 * permite capturas de peão em casas vazias; só não pode cair numa peça da própria cor.
 */
function premoveTargets(chess: Chess, from: Square, color: Side): string[] {
  const piece = chess.get(from);
  if (!piece || piece.color !== color) return [];
  const f = FILES.indexOf(from[0]);
  const r = Number(from[1]);
  const out: string[] = [];
  const add = (ff: number, rr: number) => {
    if (ff < 0 || ff > 7 || rr < 1 || rr > 8) return false;
    const sqr = `${FILES[ff]}${rr}` as Square;
    const o = chess.get(sqr);
    if (!(o && o.color === color)) out.push(sqr);
    return true;
  };
  const ray = (df: number, dr: number) => {
    for (let k = 1; add(f + df * k, r + dr * k); k++);
  };
  switch (piece.type) {
    case 'n':
      for (const [a, b] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) add(f + a, r + b);
      break;
    case 'k': {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) add(f + a, r + b);
      const rights = chess.fen().split(' ')[2];
      const home = color === 'w' ? 1 : 8;
      if (f === 4 && r === home) {
        if (rights.includes(color === 'w' ? 'K' : 'k')) add(6, home);
        if (rights.includes(color === 'w' ? 'Q' : 'q')) add(2, home);
      }
      break;
    }
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      add(f, r + dir);
      if (r === (color === 'w' ? 2 : 7)) add(f, r + 2 * dir);
      add(f - 1, r + dir);
      add(f + 1, r + dir);
      break;
    }
    default: {
      const dirs: [number, number][] = [];
      if (piece.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
      if (piece.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
      for (const [a, b] of dirs) ray(a, b);
    }
  }
  return out;
}

/** Casa clara? (a1 é escura: cada dama começa na casa da sua cor). */
export const isLight = (square: string) => (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 0;

const countPieces = (board: string) => board.replace(/[^a-zA-Z]/g, '').length;

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
  premoved: boolean;
  epVictim: boolean;
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
  const { t } = useT();
  const coordColor = light ? boardStyle.coord.light : boardStyle.coord.dark;
  return (
    <Pressable
      onPress={() => p.onPressSquare(p.square)}
      accessibilityLabel={`${p.square}${p.pieceType ? ` ${t(p.pieceColor === 'w' ? 'common.pieceWhite' : 'common.pieceBlack')} ${p.pieceType}` : ''}`}
      style={{ width: sq, height: sq, overflow: 'hidden' }}
    >
      <SquareSurface style={boardStyle} index={FILES.indexOf(p.square[0]) * 8 + Number(p.square[1])} size={sq} light={light} />
      {p.last && <View style={[StyleSheet.absoluteFill, { backgroundColor: boardStyle.highlight }]} />}
      {p.hinted && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.hint }]} />}
      {p.premoved && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 64, 129, 0.45)' }]} />}
      {p.selected && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.selected }]} />}
      {p.check && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.check, borderRadius: sq / 2 }]} />}
      {p.pieceType && p.pieceColor && !p.hidePiece && (
        <View style={[StyleSheet.absoluteFill, styles.pieceBox]} pointerEvents="none">
          <ChessPiece type={p.pieceType as PieceType} color={p.pieceColor} style={p.pieceStyle} size={sq} />
        </View>
      )}
      {!!p.rankLabel && <Text style={[styles.coord, styles.rankCoord, { color: coordColor, fontSize: Math.max(9, sq * 0.2) }]}>{p.rankLabel}</Text>}
      {!!p.fileLabel && <Text style={[styles.coord, styles.fileCoord, { color: coordColor, fontSize: Math.max(9, sq * 0.2) }]}>{p.fileLabel}</Text>}
      {p.epVictim && (
        <View style={[styles.captureRing, { borderRadius: sq / 2, borderWidth: sq * 0.06, borderColor: 'rgba(230, 40, 60, 0.75)', borderStyle: 'dashed' }]} />
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

/** Moldura do tabuleiro: cada tema tem a sua borda (veja FrameArt). */
export function BoardFrame({ style, size, children }: { style: BoardStyle; size: number; children: React.ReactNode }) {
  const f = style.frame;
  const inner = size - f * 2;
  const castle = style.frameStyle === 'castle';
  return (
    <View
      style={{
        width: size, height: size, borderRadius: castle ? 0 : 6 + f / 2, padding: f, overflow: 'hidden',
        backgroundColor: castle && f >= 3 ? 'transparent' : style.border,
      }}
    >
      <FrameArt style={style} size={size} />
      <View style={{ width: inner, height: inner, borderRadius: f && !castle ? 2 : 0, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** Superfície de uma casa: cor, formato (liso, ladrilho, redondo, relevo, vidro) e decoração. */
export function SquareSurface({ style, index, size, light }: { style: BoardStyle; index: number; size: number; light: boolean }) {
  const color = light ? style.light : style.dark;
  const pattern = <SquarePattern style={style} index={index} size={size} light={light} />;
  switch (style.shape ?? 'flat') {
    case 'tiles':
    case 'round': {
      const round = style.shape === 'round';
      const gap = Math.max(1, size * (round ? 0.05 : 0.035));
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: style.border }]}>
          <View
            style={{
              position: 'absolute', left: gap, top: gap, right: gap, bottom: gap, backgroundColor: color,
              borderRadius: size * (round ? 0.32 : 0.12), overflow: 'hidden',
            }}
          >
            {pattern}
            <View style={{ position: 'absolute', left: '12%', right: '12%', top: '7%', height: '22%', borderRadius: size, backgroundColor: '#ffffff', opacity: round ? 0.28 : 0.12 }} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '14%', backgroundColor: '#000000', opacity: 0.12 }} />
          </View>
        </View>
      );
    }
    case 'bevel': {
      const b = Math.max(2, size * 0.085);
      return (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: color, overflow: 'hidden', borderWidth: b,
              borderTopColor: tint(color, 0.35), borderLeftColor: tint(color, 0.22),
              borderBottomColor: tint(color, -0.3), borderRightColor: tint(color, -0.2),
            },
          ]}
        >
          {pattern}
        </View>
      );
    }
    case 'glass':
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, overflow: 'hidden' }]}>
          {pattern}
          <View style={{ position: 'absolute', left: -size * 0.2, top: -size * 0.55, width: size * 1.2, height: size, borderRadius: size, backgroundColor: '#ffffff', opacity: 0.2 }} />
          <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomColor: 'rgba(0,0,0,0.18)', borderRightColor: 'rgba(0,0,0,0.12)' }]} />
        </View>
      );
    default:
      return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, overflow: 'hidden' }]}>
          {pattern}
        </View>
      );
  }
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
  flashWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  flash: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    backgroundColor: 'rgba(124, 77, 255, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
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

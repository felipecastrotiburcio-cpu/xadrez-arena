import { memo, type ReactNode } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { PieceStyle, Side } from '../lib/types';

/**
 * Peças de xadrez vetoriais (desenho próprio, viewBox 100x100).
 * O volume vem de um gradiente horizontal (luz à esquerda, sombra à direita),
 * mais contorno, detalhes e brilho especular. As cores vêm do estilo equipado.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor #rrggbb. */
export function tint(hex: string, amount: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.round(Math.max(0, Math.min(255, out))).toString(16).padStart(2, '0');
  };
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

interface Paint {
  fill: string;
  stroke: string;
  width: number;
  detail: string;
  shine: boolean;
}

/** Pedestal comum a todas as peças (duas camadas). */
const Base = ({ p }: { p: Paint }) => (
  <>
    <Rect x={24} y={73} width={52} height={9} rx={3.5} fill={p.fill} stroke={p.stroke} strokeWidth={p.width} />
    <Rect x={17} y={80} width={66} height={11} rx={5} fill={p.fill} stroke={p.stroke} strokeWidth={p.width} />
  </>
);

const Shine = ({ d, p }: { d: string; p: Paint }) =>
  p.shine ? <Path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" /> : null;

function shapes(type: PieceType, p: Paint): ReactNode {
  const common = { fill: p.fill, stroke: p.stroke, strokeWidth: p.width, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'p':
      return (
        <>
          <Base p={p} />
          <Path d="M33 74 C33 62 39 56 43 51 L57 51 C61 56 67 62 67 74 Z" {...common} />
          <Ellipse cx={50} cy={50} rx={15} ry={4.5} {...common} />
          <Circle cx={50} cy={33} r={13.5} {...common} />
          <Shine d="M41 27 A10 10 0 0 1 47 23" p={p} />
          <Shine d="M39 70 C39 63 42 59 45 56" p={p} />
        </>
      );
    case 'r':
      return (
        <>
          <Base p={p} />
          <Path d="M30 74 L33 42 L67 42 L70 74 Z" {...common} />
          <Rect x={26} y={33} width={48} height={11} rx={2.5} {...common} />
          <Path
            d="M26 34 L26 17 L36 17 L36 24 L45 24 L45 17 L55 17 L55 24 L64 24 L64 17 L74 17 L74 34 Z"
            {...common}
          />
          {/* tijolos e janela */}
          <Path d="M32 54 L68 54 M33 64 L67 64 M42 44 L42 54 M58 44 L58 54 M50 54 L50 64" stroke={p.detail} strokeWidth={1.6} strokeOpacity={0.55} />
          <Path d="M45 74 L45 67 Q50 61 55 67 L55 74 Z" fill={p.detail} fillOpacity={0.55} />
          <Shine d="M35 70 L37 47" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <Base p={p} />
          <Path d="M33 74 C35 64 41 60 43 56 L57 56 C59 60 65 64 67 74 Z" {...common} />
          <Ellipse cx={50} cy={55} rx={15} ry={4.5} {...common} />
          <Path d="M50 15 C65 26 67 41 58 52 L42 52 C33 41 35 26 50 15 Z" {...common} />
          <Circle cx={50} cy={11} r={5.5} {...common} />
          <Path d="M56 25 L46 38" stroke={p.detail} strokeWidth={3.2} strokeLinecap="round" />
          <Ellipse cx={50} cy={47} rx={9} ry={2.2} fill={p.detail} fillOpacity={0.35} />
          <Shine d="M41 43 C38 36 40 28 46 22" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <Base p={p} />
          <Path
            d="M70 74 C72 58 70 44 63 34 C58 27 52 22 45 20 L47 11 L38 18 C30 21 24 29 21 37 C19 43 21 48 26 49 C31 50 34 47 38 46 C42 46 44 49 41 55 C37 62 33 68 33 74 Z"
            {...common}
          />
          {/* crina */}
          <Path d="M48 21 C59 25 66 35 68 50 C69 58 69 66 68 72" fill="none" stroke={p.detail} strokeWidth={2.4} strokeOpacity={0.6} strokeLinecap="round" />
          <Path d="M53 24 L58 21 M58 28 L64 26 M62 34 L68 33 M65 41 L71 41 M67 49 L72 50" stroke={p.detail} strokeWidth={2} strokeOpacity={0.55} strokeLinecap="round" />
          {/* olho, narina e boca */}
          <Ellipse cx={37} cy={30} rx={3} ry={2.4} fill={p.detail} />
          <Circle cx={36} cy={29.3} r={0.9} fill="#ffffff" />
          <Circle cx={25} cy={42} r={1.7} fill={p.detail} />
          <Path d="M28 47 C31 47 33 46 35 45" stroke={p.detail} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Shine d="M27 36 C30 29 35 24 40 22" p={p} />
        </>
      );
    case 'q':
      return (
        <>
          <Base p={p} />
          <Path d="M32 74 C34 60 40 50 42 43 L58 43 C60 50 66 60 68 74 Z" {...common} />
          <Ellipse cx={50} cy={43} rx={16} ry={4.5} {...common} />
          <Path d="M29 38 L28 18 L39 30 L44 12 L50 27 L56 12 L61 30 L72 18 L71 38 Z" {...common} />
          <Rect x={29} y={33} width={42} height={8} rx={3.5} {...common} />
          {[
            [28, 16],
            [44, 10],
            [56, 10],
            [72, 16],
          ].map(([x, y]) => (
            <Circle key={x} cx={x} cy={y} r={4} {...common} />
          ))}
          <Circle cx={50} cy={37} r={2.8} fill={p.detail} />
          <Circle cx={40} cy={37} r={1.6} fill={p.detail} fillOpacity={0.7} />
          <Circle cx={60} cy={37} r={1.6} fill={p.detail} fillOpacity={0.7} />
          <Shine d="M39 70 C40 60 43 52 45 47" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <Base p={p} />
          <Path d="M32 74 C34 62 39 54 41 47 L59 47 C61 54 66 62 68 74 Z" {...common} />
          <Ellipse cx={50} cy={47} rx={16} ry={4.5} {...common} />
          <Path
            d="M33 44 C29 34 33 25 42 25 C46 25 48 28 50 31 C52 28 54 25 58 25 C67 25 71 34 67 44 Z"
            {...common}
          />
          <Rect x={32} y={39} width={36} height={8} rx={3.5} {...common} />
          <Rect x={46.5} y={4} width={7} height={23} rx={2} {...common} />
          <Rect x={40} y={10} width={20} height={7} rx={2} {...common} />
          <Path d="M50 31 L50 39" stroke={p.detail} strokeWidth={2} strokeOpacity={0.6} />
          <Shine d="M37 38 C35 33 37 29 41 28" p={p} />
          <Shine d="M39 70 C40 61 42 55 44 51" p={p} />
        </>
      );
  }
}

interface Props {
  type: PieceType;
  color: Side;
  style: PieceStyle;
  size: number;
}

function ChessPieceBase({ type, color, style, size }: Props) {
  const white = color === 'w';
  const base = white ? style.whiteFill : style.blackFill;
  const outline = white ? style.whiteOutline : style.blackOutline;
  // Detalhes contrastam com o corpo: escuros nas brancas, claros nas pretas.
  const detail = white ? outline : tint(base, 0.55);
  const id = `pc-${color}-${base.replace(/[^0-9a-z]/gi, '')}`;
  const paint: Paint = { fill: `url(#${id})`, stroke: outline, width: 2.6, detail, shine: true };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.35">
          <Stop offset="0" stopColor={tint(base, white ? 0.35 : 0.3)} />
          <Stop offset="0.45" stopColor={base} />
          <Stop offset="1" stopColor={tint(base, white ? -0.32 : -0.45)} />
        </LinearGradient>
      </Defs>
      {/* sombra no tabuleiro */}
      <Ellipse cx={50} cy={93} rx={33} ry={4} fill="#000000" fillOpacity={0.28} />
      {style.glow > 0 && (
        <G opacity={0.45}>{shapes(type, { fill: 'none', stroke: outline, width: 2.6 + style.glow * 1.4, detail: 'none', shine: false })}</G>
      )}
      {shapes(type, paint)}
    </Svg>
  );
}

export const ChessPiece = memo(ChessPieceBase);

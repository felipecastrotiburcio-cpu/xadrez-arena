import { memo, type ReactNode } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { PieceStyle, Side } from '../lib/types';

/**
 * Peças de xadrez vetoriais (desenho próprio, viewBox 100x100).
 * Cada conjunto da loja tem um MODELO (formato) próprio — clássico, moderno,
 * medieval, cristal, fofinho, robô ou pixel — além das cores do estilo.
 * O volume vem de um gradiente (luz à esquerda, sombra à direita), contorno,
 * detalhes e brilho especular.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceModel = NonNullable<PieceStyle['model']>;

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
  /** Cor dos detalhes gravados (contrasta com o corpo). */
  detail: string;
  shine: boolean;
  /** Cor "acesa": LEDs dos robôs, joias. */
  accent: string;
  /** Tons sólidos (pixel art e facetas). */
  base: string;
  light: string;
  dark: string;
  /** Desenho só do contorno (camada de brilho/neon): sem rostos e detalhes. */
  outline: boolean;
}

const solid = (p: Paint) => ({ fill: p.fill, stroke: p.stroke, strokeWidth: p.width, strokeLinejoin: 'round' as const });

const Shine = ({ d, p }: { d: string; p: Paint }) =>
  p.shine ? <Path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" /> : null;

/** Linhas de detalhe (não aparecem na camada de contorno). */
const Lines = ({ d, p, w = 1.6, o = 0.55, color }: { d: string; p: Paint; w?: number; o?: number; color?: string }) =>
  p.outline ? null : <Path d={d} fill="none" stroke={color ?? p.detail} strokeWidth={w} strokeOpacity={o} strokeLinecap="round" strokeLinejoin="round" />;

// =================================================================== CLÁSSICO (Staunton)

const StauntonBase = ({ p }: { p: Paint }) => (
  <>
    <Rect x={24} y={73} width={52} height={9} rx={3.5} {...solid(p)} />
    <Rect x={17} y={80} width={66} height={11} rx={5} {...solid(p)} />
  </>
);

function staunton(type: PieceType, p: Paint): ReactNode {
  const common = solid(p);
  switch (type) {
    case 'p':
      return (
        <>
          <StauntonBase p={p} />
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
          <StauntonBase p={p} />
          <Path d="M30 74 L33 42 L67 42 L70 74 Z" {...common} />
          <Rect x={26} y={33} width={48} height={11} rx={2.5} {...common} />
          <Path d="M26 34 L26 17 L36 17 L36 24 L45 24 L45 17 L55 17 L55 24 L64 24 L64 17 L74 17 L74 34 Z" {...common} />
          <Lines d="M32 54 L68 54 M33 64 L67 64 M42 44 L42 54 M58 44 L58 54 M50 54 L50 64" p={p} />
          {!p.outline && <Path d="M45 74 L45 67 Q50 61 55 67 L55 74 Z" fill={p.detail} fillOpacity={0.55} />}
          <Shine d="M35 70 L37 47" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <StauntonBase p={p} />
          <Path d="M33 74 C35 64 41 60 43 56 L57 56 C59 60 65 64 67 74 Z" {...common} />
          <Ellipse cx={50} cy={55} rx={15} ry={4.5} {...common} />
          <Path d="M50 15 C65 26 67 41 58 52 L42 52 C33 41 35 26 50 15 Z" {...common} />
          <Circle cx={50} cy={11} r={5.5} {...common} />
          <Lines d="M56 25 L46 38" p={p} w={3.2} o={1} />
          <Shine d="M41 43 C38 36 40 28 46 22" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <StauntonBase p={p} />
          <Path
            d="M70 74 C72 58 70 44 63 34 C58 27 52 22 45 20 L47 11 L38 18 C30 21 24 29 21 37 C19 43 21 48 26 49 C31 50 34 47 38 46 C42 46 44 49 41 55 C37 62 33 68 33 74 Z"
            {...common}
          />
          <Lines d="M48 21 C59 25 66 35 68 50 C69 58 69 66 68 72" p={p} w={2.4} o={0.6} />
          <Lines d="M53 24 L58 21 M58 28 L64 26 M62 34 L68 33 M65 41 L71 41 M67 49 L72 50" p={p} w={2} />
          {!p.outline && (
            <>
              <Ellipse cx={37} cy={30} rx={3} ry={2.4} fill={p.detail} />
              <Circle cx={36} cy={29.3} r={0.9} fill="#ffffff" />
              <Circle cx={25} cy={42} r={1.7} fill={p.detail} />
            </>
          )}
          <Lines d="M28 47 C31 47 33 46 35 45" p={p} o={1} />
          <Shine d="M27 36 C30 29 35 24 40 22" p={p} />
        </>
      );
    case 'q':
      return (
        <>
          <StauntonBase p={p} />
          <Path d="M32 74 C34 60 40 50 42 43 L58 43 C60 50 66 60 68 74 Z" {...common} />
          <Ellipse cx={50} cy={43} rx={16} ry={4.5} {...common} />
          <Path d="M29 38 L28 18 L39 30 L44 12 L50 27 L56 12 L61 30 L72 18 L71 38 Z" {...common} />
          <Rect x={29} y={33} width={42} height={8} rx={3.5} {...common} />
          {[[28, 16], [44, 10], [56, 10], [72, 16]].map(([x, y]) => (
            <Circle key={x} cx={x} cy={y} r={4} {...common} />
          ))}
          {!p.outline && <Circle cx={50} cy={37} r={2.8} fill={p.detail} />}
          <Shine d="M39 70 C40 60 43 52 45 47" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <StauntonBase p={p} />
          <Path d="M32 74 C34 62 39 54 41 47 L59 47 C61 54 66 62 68 74 Z" {...common} />
          <Ellipse cx={50} cy={47} rx={16} ry={4.5} {...common} />
          <Path d="M33 44 C29 34 33 25 42 25 C46 25 48 28 50 31 C52 28 54 25 58 25 C67 25 71 34 67 44 Z" {...common} />
          <Rect x={32} y={39} width={36} height={8} rx={3.5} {...common} />
          <Rect x={46.5} y={4} width={7} height={23} rx={2} {...common} />
          <Rect x={40} y={10} width={20} height={7} rx={2} {...common} />
          <Lines d="M50 31 L50 39" p={p} w={2} o={0.6} />
          <Shine d="M37 38 C35 33 37 29 41 28" p={p} />
          <Shine d="M39 70 C40 61 42 55 44 51" p={p} />
        </>
      );
  }
}

// =================================================================== MODERNO (geométrico)

const ModernBase = ({ p }: { p: Paint }) => <Rect x={20} y={80} width={60} height={11} rx={5.5} {...solid(p)} />;

function modern(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  switch (type) {
    case 'p':
      return (
        <>
          <ModernBase p={p} />
          <Path d="M35 81 L43 50 L57 50 L65 81 Z" {...c} />
          <Circle cx={50} cy={36} r={13} {...c} />
          <Shine d="M42 31 A8 8 0 0 1 47 27" p={p} />
        </>
      );
    case 'r':
      return (
        <>
          <ModernBase p={p} />
          <Rect x={33} y={34} width={34} height={47} rx={2} {...c} />
          <Path d="M29 20 L43 20 L43 27 L57 27 L57 20 L71 20 L71 36 L29 36 Z" {...c} />
          <Lines d="M33 58 L67 58" p={p} w={3} o={0.5} />
          <Shine d="M38 76 L38 42" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <ModernBase p={p} />
          <Path d="M34 81 L50 20 L66 81 Z" {...c} />
          <Circle cx={50} cy={14} r={6} {...c} />
          <Lines d="M42 52 L60 40" p={p} w={3.5} o={0.8} />
          <Shine d="M42 72 L49 38" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <ModernBase p={p} />
          <Path d="M36 81 L40 54 L24 50 L24 36 L42 18 L58 18 L68 30 L66 81 Z" {...c} />
          <Path d="M46 18 L52 8 L56 18" {...c} />
          {!p.outline && <Rect x={34} y={30} width={6} height={6} fill={p.detail} />}
          <Lines d="M58 22 L58 81" p={p} w={3} o={0.4} />
          <Shine d="M28 40 L42 24" p={p} />
        </>
      );
    case 'q':
      return (
        <>
          <ModernBase p={p} />
          <Path d="M33 81 L43 40 L57 40 L67 81 Z" {...c} />
          {/* diamante com três pontas */}
          <Path d="M50 12 L64 27 L50 42 L36 27 Z" {...c} />
          {[[42, 18], [50, 9], [58, 18]].map(([x, y]) => <Circle key={x} cx={x} cy={y} r={4} {...c} />)}
          {!p.outline && <Path d="M50 20 L57 27 L50 34 L43 27 Z" fill={p.detail} fillOpacity={0.6} />}
          <Rect x={38} y={38} width={24} height={6} rx={3} {...c} />
          <Shine d="M40 76 L46 46" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <ModernBase p={p} />
          <Path d="M33 81 L42 36 L58 36 L67 81 Z" {...c} />
          <Rect x={36} y={28} width={28} height={10} rx={2} {...c} />
          <Rect x={46} y={4} width={8} height={25} {...c} />
          <Rect x={38} y={11} width={24} height={8} {...c} />
          <Shine d="M40 76 L46 42" p={p} />
        </>
      );
  }
}

// =================================================================== MEDIEVAL (ornamentado)

const MedievalBase = ({ p }: { p: Paint }) => (
  <>
    <Path d="M28 73 L72 73 L75 79 L25 79 Z" {...solid(p)} />
    <Rect x={20} y={78} width={60} height={7} rx={2} {...solid(p)} />
    <Path d="M15 91 L19 84 L81 84 L85 91 Z" {...solid(p)} />
    <Lines d="M24 87.5 L76 87.5" p={p} w={1.4} o={0.6} />
    {!p.outline && [30, 40, 50, 60, 70].map((x) => <Circle key={x} cx={x} cy={81.5} r={1.3} fill={p.detail} fillOpacity={0.7} />)}
  </>
);

function medieval(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  switch (type) {
    case 'p':
      return (
        <>
          <MedievalBase p={p} />
          <Path d="M37 74 C37 64 43 62 44 55 L56 55 C57 62 63 64 63 74 Z" {...c} />
          <Rect x={38} y={50} width={24} height={6} rx={3} {...c} />
          {/* cúpula em forma de cebola */}
          <Path d="M39 49 C33 40 40 30 50 22 C60 30 67 40 61 49 Z" {...c} />
          <Circle cx={50} cy={18} r={4} {...c} />
          <Lines d="M50 25 L50 47 M44 32 C42 38 42 44 44 48 M56 32 C58 38 58 44 56 48" p={p} w={1.3} o={0.5} />
          <Shine d="M41 44 C40 38 43 33 47 29" p={p} />
        </>
      );
    case 'r':
      return (
        <>
          <MedievalBase p={p} />
          <Path d="M32 74 L35 36 L65 36 L68 74 Z" {...c} />
          <Path d="M30 37 L30 26 L37 26 L37 31 L46 31 L46 26 L54 26 L54 31 L63 31 L63 26 L70 26 L70 37 Z" {...c} />
          {/* bandeira */}
          <Path d="M50 26 L50 6" fill="none" stroke={p.stroke} strokeWidth={p.width} strokeLinecap="round" />
          <Path d="M51 7 L64 11 L51 16 Z" {...c} />
          {!p.outline && <Path d="M44 74 L44 62 C44 56 56 56 56 62 L56 74 Z" fill={p.detail} fillOpacity={0.6} />}
          {!p.outline && <Path d="M47 46 L53 46 L53 52 L47 52 Z" fill={p.detail} fillOpacity={0.6} />}
          <Lines d="M35 44 L65 44 M34 58 L42 58 M58 58 L66 58" p={p} w={1.4} o={0.5} />
          <Shine d="M38 70 L40 41" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <MedievalBase p={p} />
          <Path d="M36 74 C38 64 43 60 44 54 L56 54 C57 60 62 64 64 74 Z" {...c} />
          <Rect x={37} y={48} width={26} height={7} rx={3} {...c} />
          <Path d="M50 9 C66 20 68 36 60 49 L40 49 C32 36 34 20 50 9 Z" {...c} />
          {/* cruz bordada na mitra */}
          <Lines d="M50 18 L50 42 M42 27 L58 27" p={p} w={3} o={0.85} />
          <Circle cx={50} cy={6} r={3.5} {...c} />
          <Shine d="M40 42 C37 34 39 26 45 19" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <MedievalBase p={p} />
          <Path
            d="M69 74 C71 58 69 44 62 34 C57 27 51 22 44 20 L46 11 L37 18 C29 21 23 29 20 37 C18 43 20 48 25 49 C30 50 33 47 37 46 C41 46 43 49 40 55 C36 62 32 68 32 74 Z"
            {...c}
          />
          {/* elmo e penacho */}
          <Path d="M44 20 C50 12 60 8 68 12 C62 13 58 17 56 22 Z" {...c} />
          <Lines d="M30 26 L45 30 L42 22 M23 38 L36 40" p={p} w={2} o={0.7} />
          <Lines d="M52 30 L66 44 M48 40 L64 56 M44 52 L62 68" p={p} w={2.2} o={0.5} />
          {!p.outline && <Circle cx={34} cy={31} r={2.2} fill={p.accent} />}
          <Shine d="M26 36 C29 29 34 24 39 22" p={p} />
        </>
      );
    case 'q':
      return (
        <>
          <MedievalBase p={p} />
          <Path d="M35 74 C37 60 42 52 43 45 L57 45 C58 52 63 60 65 74 Z" {...c} />
          <Rect x={33} y={39} width={34} height={7} rx={3} {...c} />
          {/* coroa com flor-de-lis */}
          <Path d="M33 40 L31 22 L40 30 L45 16 L50 28 L55 16 L60 30 L69 22 L67 40 Z" {...c} />
          <Path d="M50 4 C46 8 46 13 50 16 C54 13 54 8 50 4 Z" {...c} />
          {!p.outline && [[38, 36], [50, 35], [62, 36]].map(([x, y]) => <Circle key={x} cx={x} cy={y} r={2.2} fill={p.accent} />)}
          <Lines d="M41 58 C46 55 54 55 59 58 M40 66 C46 63 54 63 60 66" p={p} w={1.4} o={0.5} />
          <Shine d="M40 70 C41 60 43 54 45 49" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <MedievalBase p={p} />
          <Path d="M34 74 C36 62 41 54 42 48 L58 48 C59 54 64 62 66 74 Z" {...c} />
          <Rect x={32} y={42} width={36} height={7} rx={3} {...c} />
          {/* coroa fechada com orbe */}
          <Path d="M33 43 L31 25 L41 32 L50 22 L59 32 L69 25 L67 43 Z" {...c} />
          <Circle cx={50} cy={15} r={6} {...c} />
          <Rect x={48} y={2} width={4} height={9} {...c} />
          <Rect x={45} y={4.5} width={10} height={3.5} {...c} />
          {!p.outline && [[39, 38], [50, 37], [61, 38]].map(([x, y]) => <Circle key={x} cx={x} cy={y} r={2.2} fill={p.accent} />)}
          <Lines d="M44 15 L56 15" p={p} w={1.4} o={0.6} />
          <Shine d="M40 70 C41 61 43 55 45 51" p={p} />
        </>
      );
  }
}

// =================================================================== CRISTAL (lapidado)

const CrystalBase = ({ p }: { p: Paint }) => (
  <>
    <Path d="M17 91 L23 81 L77 81 L83 91 Z" {...solid(p)} />
    <Lines d="M23 81 L30 91 M77 81 L70 91 M50 81 L50 91" p={p} w={1.2} o={0.45} />
  </>
);

/** Facetas: linhas claras que imitam a lapidação. */
const Facets = ({ d, p }: { d: string; p: Paint }) =>
  p.outline ? null : <Path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.3} strokeLinejoin="round" />;

function crystal(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  const body = 'M35 82 L43 54 L57 54 L65 82 Z';
  switch (type) {
    case 'p':
      return (
        <>
          <CrystalBase p={p} />
          <Path d={body} {...c} />
          <Path d="M50 20 L61 28 L63 40 L56 51 L44 51 L37 40 L39 28 Z" {...c} />
          <Facets d="M39 28 L50 34 L61 28 M50 34 L50 51 M37 40 L50 34 L63 40 M43 54 L50 82 L57 54" p={p} />
        </>
      );
    case 'r':
      return (
        <>
          <CrystalBase p={p} />
          <Path d="M32 82 L35 32 L65 32 L68 82 Z" {...c} />
          <Path d="M31 34 L30 14 L39 22 L45 12 L50 22 L55 12 L61 22 L70 14 L69 34 Z" {...c} />
          <Facets d="M35 32 L50 50 L65 32 M50 50 L50 82 M35 32 L42 82 M65 32 L58 82 M39 22 L50 30 L61 22" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <CrystalBase p={p} />
          <Path d={body} {...c} />
          <Path d="M50 6 L64 30 L57 52 L43 52 L36 30 Z" {...c} />
          <Facets d="M50 6 L50 52 M36 30 L50 24 L64 30 M43 52 L50 38 L57 52 M43 54 L50 82 L57 54" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <CrystalBase p={p} />
          <Path d="M67 82 L69 52 L63 30 L52 18 L48 8 L42 18 L28 30 L21 45 L30 50 L42 44 L35 64 L33 82 Z" {...c} />
          <Facets d="M42 18 L46 32 L63 30 M28 30 L46 32 L42 44 M46 32 L55 50 L69 52 M55 50 L42 44 M55 50 L50 82 M35 64 L55 50" p={p} />
          {!p.outline && <Path d="M36 28 L41 27 L39 31 Z" fill={p.detail} />}
        </>
      );
    case 'q':
      return (
        <>
          <CrystalBase p={p} />
          <Path d="M34 82 L42 44 L58 44 L66 82 Z" {...c} />
          <Path d="M31 46 L25 14 L38 30 L44 6 L50 28 L56 6 L62 30 L75 14 L69 46 Z" {...c} />
          <Facets d="M38 30 L50 40 L62 30 M44 6 L50 40 L56 6 M31 46 L50 40 L69 46 M42 44 L50 82 L58 44" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <CrystalBase p={p} />
          <Path d="M34 82 L42 42 L58 42 L66 82 Z" {...c} />
          <Path d="M34 44 L38 26 L62 26 L66 44 Z" {...c} />
          <Path d="M50 2 L55 9 L50 24 L45 9 Z" {...c} />
          <Path d="M38 13 L50 9 L62 13 L50 17 Z" {...c} />
          <Facets d="M38 26 L50 36 L62 26 M34 44 L50 36 L66 44 M50 36 L50 44 M42 42 L50 82 L58 42 M50 2 L50 24" p={p} />
        </>
      );
  }
}

// =================================================================== FOFINHO (kawaii)

const CuteBase = ({ p }: { p: Paint }) => <Rect x={18} y={78} width={64} height={14} rx={7} {...solid(p)} />;

/** Rostinho: olhos com brilho, bochechas e sorriso. */
function Face({ x, y, s = 1, p }: { x: number; y: number; s?: number; p: Paint }) {
  if (p.outline) return null;
  const eye = '#2b1d33';
  return (
    <G>
      <Ellipse cx={x - 7 * s} cy={y} rx={3 * s} ry={3.6 * s} fill={eye} />
      <Ellipse cx={x + 7 * s} cy={y} rx={3 * s} ry={3.6 * s} fill={eye} />
      <Circle cx={x - 8 * s} cy={y - 1.3 * s} r={1.1 * s} fill="#ffffff" />
      <Circle cx={x + 6 * s} cy={y - 1.3 * s} r={1.1 * s} fill="#ffffff" />
      <Ellipse cx={x - 11.5 * s} cy={y + 5 * s} rx={3.2 * s} ry={2 * s} fill="#ff6f9f" fillOpacity={0.55} />
      <Ellipse cx={x + 11.5 * s} cy={y + 5 * s} rx={3.2 * s} ry={2 * s} fill="#ff6f9f" fillOpacity={0.55} />
      <Path d={`M${x - 3 * s} ${y + 4 * s} Q${x} ${y + 7.5 * s} ${x + 3 * s} ${y + 4 * s}`} stroke={eye} strokeWidth={1.6 * s} fill="none" strokeLinecap="round" />
    </G>
  );
}

function cute(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  switch (type) {
    case 'p':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M28 80 C26 62 36 50 50 50 C64 50 74 62 72 80 Z" {...c} />
          <Circle cx={50} cy={40} r={17} {...c} />
          <Face x={50} y={41} s={0.9} p={p} />
          <Shine d="M39 32 A12 12 0 0 1 46 26" p={p} />
        </>
      );
    case 'r':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M27 80 L29 34 L71 34 L73 80 Z" {...c} />
          {[34, 50, 66].map((x) => <Circle key={x} cx={x} cy={28} r={8} {...c} />)}
          <Rect x={27} y={30} width={46} height={10} rx={5} {...c} />
          <Face x={50} y={56} p={p} />
          <Shine d="M34 74 L34 46" p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M50 14 C70 30 76 50 72 66 C70 76 62 80 50 80 C38 80 30 76 28 66 C24 50 30 30 50 14 Z" {...c} />
          <Circle cx={50} cy={11} r={5.5} {...c} />
          <Lines d="M58 26 L52 36" p={p} w={3} o={0.7} />
          <Face x={50} y={56} p={p} />
          <Shine d="M36 58 C35 46 39 36 45 28" p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M68 80 C72 64 72 50 66 40 C62 30 54 24 44 24 C32 24 22 32 22 44 C22 54 30 58 40 56 C38 64 34 72 32 80 Z" {...c} />
          {/* orelhas e franja */}
          <Path d="M46 25 L48 12 L56 24 Z" {...c} />
          <Path d="M54 26 C62 22 70 28 70 38 C66 34 60 32 56 34 Z" fill={p.outline ? 'none' : p.detail} stroke={p.stroke} strokeWidth={p.width} strokeLinejoin="round" />
          {!p.outline && (
            <>
              <Ellipse cx={38} cy={38} rx={4} ry={4.8} fill="#2b1d33" />
              <Circle cx={36.6} cy={36.4} r={1.4} fill="#ffffff" />
              <Ellipse cx={31} cy={46} rx={3.2} ry={2} fill="#ff6f9f" fillOpacity={0.55} />
              <Circle cx={25} cy={44} r={1.4} fill="#2b1d33" />
            </>
          )}
          <Shine d="M28 38 C30 32 35 28 40 27" p={p} />
        </>
      );
    case 'q':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M27 80 C25 60 34 44 50 44 C66 44 75 60 73 80 Z" {...c} />
          <Circle cx={50} cy={38} r={16} {...c} />
          <Path d="M37 26 L36 14 L43 21 L50 10 L57 21 L64 14 L63 26 Z" {...c} />
          {!p.outline && <Circle cx={50} cy={20} r={2.6} fill={p.accent} />}
          <Face x={50} y={40} s={0.85} p={p} />
          <Shine d="M38 32 A11 11 0 0 1 44 27" p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <CuteBase p={p} />
          <Path d="M27 80 C25 60 34 46 50 46 C66 46 75 60 73 80 Z" {...c} />
          <Circle cx={50} cy={40} r={16} {...c} />
          <Rect x={36} y={22} width={28} height={8} rx={3} {...c} />
          <Rect x={46} y={5} width={8} height={18} rx={3} {...c} />
          <Rect x={41} y={10} width={18} height={7} rx={3} {...c} />
          <Face x={50} y={42} s={0.85} p={p} />
          <Shine d="M38 34 A11 11 0 0 1 44 29" p={p} />
        </>
      );
  }
}

// =================================================================== ROBÔ

function RobotBase({ p }: { p: Paint }) {
  return (
    <>
      <Rect x={18} y={79} width={64} height={12} rx={4} {...solid(p)} />
      {!p.outline && [26, 38, 50, 62, 74].map((x) => <Circle key={x} cx={x} cy={85} r={2.6} fill={p.dark} stroke={p.stroke} strokeWidth={1} />)}
    </>
  );
}

const Led = ({ x, y, w, h, p }: { x: number; y: number; w: number; h: number; p: Paint }) =>
  p.outline ? null : (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} fill={p.accent} />
      <Rect x={x + 1} y={y + 0.8} width={Math.max(1, w * 0.35)} height={Math.max(1, h * 0.35)} rx={0.8} fill="#ffffff" fillOpacity={0.7} />
    </>
  );

const Bolt = ({ x, y, p }: { x: number; y: number; p: Paint }) =>
  p.outline ? null : <Circle cx={x} cy={y} r={1.5} fill={p.dark} />;

function robot(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  const antenna = (x1: number, y1: number, x2: number, y2: number) => (
    <>
      <Path d={`M${x1} ${y1} L${x2} ${y2}`} stroke={p.stroke} strokeWidth={p.width} strokeLinecap="round" />
      <Circle cx={x2} cy={y2} r={3.2} fill={p.outline ? 'none' : p.accent} stroke={p.stroke} strokeWidth={p.width * 0.8} />
    </>
  );
  switch (type) {
    case 'p':
      return (
        <>
          <RobotBase p={p} />
          <Rect x={37} y={52} width={26} height={28} rx={3} {...c} />
          <Rect x={45} y={46} width={10} height={7} {...c} />
          {antenna(50, 24, 50, 14)}
          <Rect x={36} y={24} width={28} height={23} rx={5} {...c} />
          <Led x={40} y={31} w={20} h={6} p={p} />
          <Bolt x={42} y={60} p={p} />
          <Bolt x={58} y={60} p={p} />
          <Lines d="M42 70 L58 70" p={p} w={2} o={0.5} />
        </>
      );
    case 'r':
      return (
        <>
          <RobotBase p={p} />
          <Rect x={31} y={34} width={38} height={46} rx={3} {...c} />
          <Path d="M28 36 L28 18 L37 18 L37 25 L45 25 L45 18 L55 18 L55 25 L63 25 L63 18 L72 18 L72 36 Z" {...c} />
          <Led x={37} y={42} w={9} h={7} p={p} />
          <Led x={54} y={42} w={9} h={7} p={p} />
          <Lines d="M37 58 L63 58 M37 64 L63 64 M37 70 L63 70" p={p} w={2} o={0.5} />
          <Bolt x={34} y={38} p={p} />
          <Bolt x={66} y={38} p={p} />
        </>
      );
    case 'b':
      return (
        <>
          <RobotBase p={p} />
          <Rect x={36} y={50} width={28} height={30} rx={8} {...c} />
          {antenna(56, 16, 64, 6)}
          <Path d="M36 50 L36 26 C36 16 64 16 64 26 L64 50 Z" {...c} />
          {!p.outline && <Circle cx={50} cy={32} r={7} fill={p.dark} />}
          {!p.outline && <Circle cx={50} cy={32} r={4.5} fill={p.accent} />}
          {!p.outline && <Circle cx={48.5} cy={30.5} r={1.4} fill="#ffffff" />}
          <Lines d="M40 44 L60 44" p={p} w={2} o={0.5} />
          <Bolt x={44} y={66} p={p} />
          <Bolt x={56} y={66} p={p} />
        </>
      );
    case 'n':
      return (
        <>
          <RobotBase p={p} />
          <Path d="M68 80 L68 40 L60 24 L44 18 L46 10 L38 16 L22 30 L20 46 L40 46 L36 80 Z" {...c} />
          <Led x={30} y={28} w={10} h={5} p={p} />
          <Lines d="M52 26 L64 44 M50 40 L66 56 M48 56 L66 70 M22 40 L36 40" p={p} w={2} o={0.5} />
          <Bolt x={60} y={34} p={p} />
          <Bolt x={44} y={66} p={p} />
          {!p.outline && <Rect x={20} y={42} width={5} height={3} fill={p.dark} />}
        </>
      );
    case 'q':
      return (
        <>
          <RobotBase p={p} />
          <Path d="M34 80 L38 48 L62 48 L66 80 Z" {...c} />
          {antenna(38, 26, 32, 12)}
          {antenna(50, 24, 50, 8)}
          {antenna(62, 26, 68, 12)}
          <Rect x={34} y={24} width={32} height={25} rx={6} {...c} />
          <Led x={38} y={31} w={24} h={7} p={p} />
          <Lines d="M44 43 L56 43" p={p} w={2} o={0.6} />
          <Bolt x={42} y={64} p={p} />
          <Bolt x={58} y={64} p={p} />
        </>
      );
    case 'k':
      return (
        <>
          <RobotBase p={p} />
          <Path d="M33 80 L37 48 L63 48 L67 80 Z" {...c} />
          <Rect x={47} y={5} width={6} height={20} {...c} />
          <Rect x={40} y={9} width={20} height={6} {...c} />
          <Rect x={32} y={22} width={36} height={27} rx={4} {...c} />
          <Led x={36} y={29} w={11} h={8} p={p} />
          <Led x={53} y={29} w={11} h={8} p={p} />
          <Lines d="M40 43 L60 43" p={p} w={2.4} o={0.6} />
          <Bolt x={35} y={25} p={p} />
          <Bolt x={65} y={25} p={p} />
          <Lines d="M42 60 L58 60 M42 68 L58 68" p={p} w={2} o={0.5} />
        </>
      );
  }
}

// =================================================================== PIXEL (8 bits)

/** Sprites 12x14: '#' contorno, 'o' corpo (luz e sombra laterais são automáticas). */
const SPRITES: Record<PieceType, string[]> = {
  p: [
    '............',
    '............',
    '....####....',
    '...#oooo#...',
    '...#oooo#...',
    '...#oooo#...',
    '....####....',
    '....#oo#....',
    '...#oooo#...',
    '...#oooo#...',
    '..#oooooo#..',
    '.#oooooooo#.',
    '.#oooooooo#.',
    '.##########.',
  ],
  r: [
    '............',
    '............',
    '.##..##..##.',
    '.#o##oo##o#.',
    '.#oooooooo#.',
    '..#oooooo#..',
    '...#oooo#...',
    '...#oooo#...',
    '...#oooo#...',
    '...#oooo#...',
    '...#oooo#...',
    '..#oooooo#..',
    '.#oooooooo#.',
    '.##########.',
  ],
  n: [
    '.....##.....',
    '....#oo#....',
    '...#oooo##..',
    '..#o#oooo#..',
    '.#oooooooo#.',
    '#ooooooooo#.',
    '#oo##ooooo#.',
    '.##.#oooo#..',
    '...#ooooo#..',
    '..#oooooo#..',
    '..#oooooo#..',
    '.#oooooooo#.',
    '.#oooooooo#.',
    '.##########.',
  ],
  b: [
    '.....##.....',
    '....#oo#....',
    '....#oo#....',
    '...#oooo#...',
    '..#oo#ooo#..',
    '..#o#oooo#..',
    '..#oooooo#..',
    '...#oooo#...',
    '....####....',
    '....#oo#....',
    '...######...',
    '..#oooooo#..',
    '.#oooooooo#.',
    '.##########.',
  ],
  q: [
    '#....##....#',
    '#o..#oo#..o#',
    '#oo#oooo#oo#',
    '#oooooooooo#',
    '.#oooooooo#.',
    '..########..',
    '...#oooo#...',
    '...#oooo#...',
    '...#oooo#...',
    '..#oooooo#..',
    '..########..',
    '.#oooooooo#.',
    '#oooooooooo#',
    '############',
  ],
  k: [
    '....####....',
    '....#oo#....',
    '..###oo###..',
    '..#oooooo#..',
    '..###oo###..',
    '....#oo#....',
    '.##########.',
    '#oooooooooo#',
    '.#oooooooo#.',
    '..#oooooo#..',
    '...#oooo#...',
    '..#oooooo#..',
    '.#oooooooo#.',
    '.##########.',
  ],
};

const PX = 6;
const PX_X = 14;
const PX_Y = 7;
const pixelCache = new Map<PieceType, Record<'outline' | 'body' | 'light' | 'dark', string>>();

/** Junta os quadradinhos de cada cor num único Path (desenho leve). */
function pixelPaths(type: PieceType) {
  let cached = pixelCache.get(type);
  if (cached) return cached;
  const rows = SPRITES[type];
  const out = { outline: '', body: '', light: '', dark: '' };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let key: keyof typeof out = 'outline';
      if (ch === 'o') key = row[x - 1] === '#' ? 'light' : row[x + 1] === '#' ? 'dark' : 'body';
      out[key] += `M${PX_X + x * PX} ${PX_Y + y * PX}h${PX}v${PX}h-${PX}z`;
    }
  });
  pixelCache.set(type, out);
  return out;
}

function pixel(type: PieceType, p: Paint): ReactNode {
  const d = pixelPaths(type);
  if (p.outline) return <Path d={d.outline} fill={p.stroke} />;
  return (
    <>
      <Path d={d.outline} fill={p.stroke} />
      <Path d={d.body} fill={p.base} />
      <Path d={d.light} fill={p.light} />
      <Path d={d.dark} fill={p.dark} />
    </>
  );
}

// =================================================================== CAVALEIROS MEDIEVAIS (figuras de armadura)

const GOLD = '#f2c94c';

const KnightsBase = ({ p }: { p: Paint }) => (
  <>
    <Path d="M16 91 L20 81 L80 81 L84 91 Z" {...solid(p)} />
    {!p.outline && <Path d="M22 86 L78 86" stroke={p.accent} strokeWidth={2.4} strokeLinecap="round" />}
  </>
);

/** Escudo com a cruz do exército (cor de destaque). */
function Shield({ x, y, s = 1, p }: { x: number; y: number; s?: number; p: Paint }) {
  const d = `M${x - 10 * s} ${y} L${x + 10 * s} ${y} L${x + 10 * s} ${y + 10 * s} C${x + 10 * s} ${y + 18 * s} ${x} ${y + 23 * s} ${x} ${y + 23 * s} C${x} ${y + 23 * s} ${x - 10 * s} ${y + 18 * s} ${x - 10 * s} ${y + 10 * s} Z`;
  return (
    <>
      <Path d={d} fill={p.outline ? 'none' : p.accent} stroke={p.stroke} strokeWidth={p.width} strokeLinejoin="round" />
      {!p.outline && <Path d={`M${x} ${y + 3 * s} L${x} ${y + 19 * s} M${x - 6 * s} ${y + 9 * s} L${x + 6 * s} ${y + 9 * s}`} stroke="#ffffff" strokeWidth={2.6 * s} strokeLinecap="round" />}
    </>
  );
}

function knights(type: PieceType, p: Paint): ReactNode {
  const c = solid(p);
  const accentFill = { fill: p.outline ? 'none' : p.accent, stroke: p.stroke, strokeWidth: p.width, strokeLinejoin: 'round' as const };
  const goldFill = { fill: p.outline ? 'none' : GOLD, stroke: p.stroke, strokeWidth: p.width * 0.8, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'p':
      // soldado a pé: elmo de aba (chapéu de ferro), cota e escudo
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M34 82 L39 54 L61 54 L66 82 Z" {...c} />
          <Circle cx={50} cy={44} r={10} {...c} />
          <Path d="M34 39 C36 34 64 34 66 39 C62 41 38 41 34 39 Z" {...c} />
          <Path d="M39 37 C39 24 61 24 61 37 Z" {...c} />
          {!p.outline && <Path d="M43 45 L57 45" stroke={p.stroke} strokeWidth={2} strokeLinecap="round" />}
          <Shield x={44} y={58} s={0.75} p={p} />
          <Shine d="M43 30 C45 27 48 26 51 26" p={p} />
        </>
      );
    case 'r':
      // torre de castelo: pedras, portão em arco, telhado cônico e bandeira
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M31 82 L33 40 L67 40 L69 82 Z" {...c} />
          <Path d="M29 42 L29 32 L36 32 L36 36 L43 36 L43 32 L57 32 L57 36 L64 36 L64 32 L71 32 L71 42 Z" {...c} />
          <Path d="M33 33 L50 8 L67 33 Z" {...accentFill} />
          <Path d="M50 8 L50 1" stroke={p.stroke} strokeWidth={1.8} />
          {!p.outline && <Path d="M50.8 1.5 L60 4 L50.8 6.5 Z" fill={GOLD} />}
          <Lines d="M33 52 L67 52 M33 63 L67 63 M33 73 L67 73 M41 42 L41 52 M58 42 L58 52 M48 52 L48 63 M38 63 L38 73 M62 63 L62 73" p={p} w={1.2} o={0.5} />
          {!p.outline && <Path d="M44 82 L44 72 C44 64 56 64 56 72 L56 82 Z" fill={p.dark} stroke={p.stroke} strokeWidth={1.2} />}
          <Shine d="M36 78 L37 46" p={p} />
        </>
      );
    case 'n':
      // cavalo de guerra: testeira de metal, penacho e manta com a cor do exército
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M32 82 C32 72 36 64 40 57 C43 50 41 47 37 47 C33 48 30 51 25 50 C20 49 18 44 20 38 C23 30 29 22 37 19 L46 12 L45 21 C52 22 59 27 64 34 C71 44 72 60 70 82 Z" {...c} />
          {/* manta (caparazão) */}
          <Path d="M36 82 C38 72 42 66 46 62 L68 62 L69 82 Z" {...accentFill} />
          {!p.outline && <Path d="M40 74 L46 68 L52 74 L58 68 L64 74" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinejoin="round" />}
          {/* testeira */}
          <Path d="M22 41 C24 32 30 25 38 22 L44 24 C40 30 34 36 29 44 Z" fill={p.outline ? 'none' : p.light} stroke={p.stroke} strokeWidth={p.width * 0.8} strokeLinejoin="round" />
          {/* penacho */}
          <Path d="M46 13 C52 4 62 2 70 6 C64 7 59 11 56 17 C53 14 49 13 46 13 Z" {...accentFill} />
          {!p.outline && (
            <>
              <Circle cx={36} cy={30} r={2.4} fill={p.stroke} />
              <Circle cx={23} cy={45} r={1.4} fill={p.stroke} />
            </>
          )}
          <Lines d="M50 26 C58 30 64 40 66 52" p={p} w={2} o={0.45} />
          <Shine d="M27 34 C30 28 34 24 38 22" p={p} />
        </>
      );
    case 'b':
      // monge de capuz com estola e cruz
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M31 82 C33 66 38 56 42 50 L58 50 C62 56 67 66 69 82 Z" {...c} />
          <Path d="M45 52 L44 82 L50 82 L49 52 Z M51 52 L50 82 L56 82 L55 52 Z" {...accentFill} />
          <Path d="M36 52 C32 36 38 18 50 14 C62 18 68 36 64 52 C58 56 42 56 36 52 Z" {...c} />
          <Path d="M50 14 C53 9 56 7 60 8 C57 10 55 12 54 16" {...c} />
          {!p.outline && <Path d="M42 48 C40 38 44 28 50 26 C56 28 60 38 58 48 C54 51 46 51 42 48 Z" fill={p.dark} />}
          {!p.outline && (
            <>
              <Circle cx={46} cy={38} r={1.6} fill={p.light} />
              <Circle cx={54} cy={38} r={1.6} fill={p.light} />
            </>
          )}
          <Path d="M47 60 L53 60 M50 56 L50 67" stroke={p.outline ? p.stroke : GOLD} strokeWidth={2.6} strokeLinecap="round" />
          <Shine d="M39 46 C37 36 40 26 46 20" p={p} />
        </>
      );
    case 'q':
      // rainha: vestido longo, coroa e chapéu cônico (hennin) com véu
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M28 82 C30 64 38 54 43 49 L57 49 C62 54 70 64 72 82 Z" {...c} />
          <Path d="M43 49 L57 49 L55 60 L45 60 Z" {...accentFill} />
          <Lines d="M38 72 C44 68 56 68 62 72 M35 78 C44 74 56 74 65 78" p={p} w={1.4} o={0.5} />
          <Circle cx={50} cy={40} r={9} {...c} />
          {/* véu esvoaçante */}
          <Path d="M62 12 C70 22 72 36 66 50 C64 42 62 34 58 28 Z" fill={p.outline ? 'none' : p.light} stroke={p.stroke} strokeWidth={p.width * 0.7} strokeLinejoin="round" />
          {/* hennin */}
          <Path d="M41 34 L59 32 L64 6 Z" {...accentFill} />
          <Path d="M40 35 L41 29 L45 32 L50 27 L55 31 L59 28 L60 34 Z" {...goldFill} />
          {!p.outline && (
            <>
              <Circle cx={46.5} cy={41} r={1.3} fill={p.stroke} />
              <Circle cx={53.5} cy={41} r={1.3} fill={p.stroke} />
            </>
          )}
          <Shine d="M36 76 C37 66 40 59 44 54" p={p} />
        </>
      );
    case 'k':
      // rei de armadura: elmo fechado com coroa, sobreveste e espada à frente
      return (
        <>
          <KnightsBase p={p} />
          <Path d="M30 82 L36 52 C40 48 60 48 64 52 L70 82 Z" {...c} />
          <Path d="M42 51 L58 51 L60 82 L40 82 Z" {...accentFill} />
          {/* ombreiras */}
          <Circle cx={36} cy={53} r={6} {...c} />
          <Circle cx={64} cy={53} r={6} {...c} />
          {/* espada */}
          <Rect x={47.6} y={50} width={4.8} height={30} rx={1} fill={p.outline ? 'none' : p.light} stroke={p.stroke} strokeWidth={p.width * 0.7} />
          <Rect x={41} y={56} width={18} height={4} rx={1.5} {...goldFill} />
          <Circle cx={50} cy={53} r={2.4} {...goldFill} />
          {/* elmo */}
          <Path d="M39 26 L61 26 L61 44 C57 49 43 49 39 44 Z" {...c} />
          {!p.outline && <Path d="M42 35 L58 35 M50 35 L50 45" stroke={p.stroke} strokeWidth={2.2} strokeLinecap="round" />}
          <Path d="M38 27 L38 16 L44 21 L50 12 L56 21 L62 16 L62 27 Z" {...goldFill} />
          {!p.outline && <Circle cx={50} cy={21} r={1.8} fill={p.accent} />}
          <Shine d="M42 41 C41 36 42 31 44 29" p={p} />
        </>
      );
  }
}

// ===================================================================

const MODELS: Record<PieceModel, (type: PieceType, p: Paint) => ReactNode> = {
  staunton,
  modern,
  medieval,
  crystal,
  cute,
  robot,
  pixel,
  knights,
};

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
  const model = MODELS[style.model ?? 'staunton'] ?? staunton;
  // Detalhes contrastam com o corpo: escuros nas brancas, claros nas pretas.
  const detail = white ? outline : tint(base, 0.55);
  const id = `pc-${color}-${base.replace(/[^0-9a-z]/gi, '')}`;
  const accent =
    style.model === 'robot'
      ? white ? '#29d3ff' : '#ff4d5e'
      : style.model === 'knights'
        ? white ? '#2f6fdb' : '#c62828'
        : white ? '#ff4d6d' : '#46e0ff';
  const paint: Paint = {
    fill: `url(#${id})`,
    stroke: outline,
    width: style.model === 'pixel' ? 0 : 2.6,
    detail,
    shine: style.model !== 'crystal',
    accent,
    base,
    light: tint(base, white ? 0.5 : 0.3),
    dark: tint(base, white ? -0.25 : -0.4),
    outline: false,
  };
  const glowPaint: Paint = { ...paint, fill: 'none', width: 2.6 + style.glow * 1.4, detail: 'none', shine: false, outline: true };

  return (
    // viewBox recortado nas margens: as peças ocupam mais da casa.
    <Svg width={size} height={size} viewBox="6 4 88 88" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.35">
          <Stop offset="0" stopColor={tint(base, white ? 0.35 : 0.3)} />
          <Stop offset="0.45" stopColor={base} />
          <Stop offset="1" stopColor={tint(base, white ? -0.32 : -0.45)} />
        </LinearGradient>
      </Defs>
      {/* sombra no tabuleiro */}
      <Ellipse cx={50} cy={91.5} rx={33} ry={3.2} fill="#000000" fillOpacity={0.28} />
      {style.glow > 0 && <G opacity={0.45}>{model(type, glowPaint)}</G>}
      {model(type, paint)}
    </Svg>
  );
}

export const ChessPiece = memo(ChessPieceBase);

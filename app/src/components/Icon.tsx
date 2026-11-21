import { memo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * Ícones de linha desenhados para o app (traço 1.8, cantos arredondados, grade 24×24).
 * Substituem os emojis da interface: ficam iguais em todo aparelho e combinam com a tipografia.
 */
export type IconName =
  | 'back' | 'bell' | 'gear' | 'bag' | 'trophy' | 'users' | 'cpu' | 'swords' | 'check' | 'lock'
  | 'eye' | 'play' | 'gift' | 'chevron' | 'plus' | 'search' | 'clock' | 'flag' | 'refresh'
  | 'sparkle' | 'user' | 'palette' | 'close' | 'card' | 'wrench' | 'knight' | 'board' | 'crown'
  | 'smile' | 'music' | 'globe' | 'server' | 'logout' | 'fire' | 'dice'
  // Ícones cheios (coloridos), usados nos atalhos e botões grandes:
  | 'robotFill' | 'friendsFill' | 'trophyFill' | 'chestFill' | 'moonFill' | 'starFill' | 'fireFill'
  | 'bulbFill' | 'flagFill' | 'giftFill' | 'targetFill' | 'medalFill' | 'lockFill' | 'boltFill';

const P: Record<IconName, (c: string) => React.ReactNode> = {
  back: () => <Path d="M15 5l-7 7 7 7" />,
  chevron: () => <Path d="M9 5l7 7-7 7" />,
  close: () => <Path d="M6 6l12 12M18 6L6 18" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  bell: () => (
    <>
      <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  gear: () => (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
      <Circle cx={12} cy={12} r={6.5} />
    </>
  ),
  bag: () => (
    <>
      <Path d="M5 8h14l-1 12.5H6z" />
      <Path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  trophy: () => (
    <>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  users: () => (
    <>
      <Circle cx={9} cy={8.5} r={3.2} />
      <Path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <Path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.3a5.5 5.5 0 0 1 3.5 5.2" />
    </>
  ),
  cpu: () => (
    <>
      <Rect x={6} y={6} width={12} height={12} rx={2.5} />
      <Path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3" />
      <Circle cx={12} cy={12} r={2} />
    </>
  ),
  swords: () => (
    <>
      <Path d="M4 4l9.5 9.5M4 4v3.5M4 4h3.5M20 4l-9.5 9.5M20 4v3.5M20 4h-3.5" />
      <Path d="M8 17l-2.5 2.5M6 14l4 4M16 17l2.5 2.5M18 14l-4 4" />
    </>
  ),
  lock: () => (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  eye: () => (
    <>
      <Path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={2.8} />
    </>
  ),
  play: (c) => <Path d="M8 5.5v13l10.5-6.5z" fill={c} />,
  gift: () => (
    <>
      <Rect x={4} y={9} width={16} height={11.5} rx={1.5} />
      <Path d="M3 9h18M12 9v11.5M12 9c-1.5-4-6-4-5.5-1.2C6.8 9 12 9 12 9zM12 9c1.5-4 6-4 5.5-1.2C17.2 9 12 9 12 9z" />
    </>
  ),
  search: () => (
    <>
      <Circle cx={11} cy={11} r={6} />
      <Path d="M15.5 15.5L20 20" />
    </>
  ),
  clock: () => (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  flag: () => <Path d="M6 21V4M6 4.5h11l-2 4 2 4H6" />,
  refresh: () => <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />,
  sparkle: () => <Path d="M12 3l1.8 5.4L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.6zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  user: () => (
    <>
      <Circle cx={12} cy={8.5} r={3.6} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  palette: () => (
    <>
      <Path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.8-1 1.4-2-.5-1.2.2-2.3 1.5-2.3H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9.2-8.5-9.2z" />
      <Circle cx={7.8} cy={11} r={1} />
      <Circle cx={10.5} cy={7.3} r={1} />
      <Circle cx={15} cy={7.8} r={1} />
    </>
  ),
  card: () => (
    <>
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18M7 15h4" />
    </>
  ),
  wrench: () => <Path d="M14.5 4.2a5 5 0 0 0-5.8 6.6L3.8 15.7a2 2 0 0 0 2.8 2.8l4.9-4.9a5 5 0 0 0 6.6-5.8l-3 3-2.6-.6-.6-2.6z" />,
  knight: (c) => (
    <Path transform="translate(-0.6 -0.4) scale(0.26)" d="M70 74 C72 58 70 44 63 34 C58 27 52 22 45 20 L47 11 L38 18 C30 21 24 29 21 37 C19 43 21 48 26 49 C31 50 34 47 38 46 C42 46 44 49 41 55 C37 62 33 68 33 74 Z M27 80 H76 V89 H27 Z" fill={c} stroke="none" />
  ),
  board: () => (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={2} />
      <Path d="M4 12h16M12 4v16M4 4h8v8H4zM12 12h8v8h-8z" />
    </>
  ),
  crown: () => <Path d="M4 17.5L3 7.5l5 4 4-6.5 4 6.5 5-4-1 10zM5 20.5h14" />,
  smile: () => (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M8.5 14a4 4 0 0 0 7 0M9.3 9.5h.01M14.7 9.5h.01" />
    </>
  ),
  music: () => (
    <>
      <Path d="M9 17.5V5.5l10-2v12" />
      <Circle cx={6.5} cy={17.5} r={2.5} />
      <Circle cx={16.5} cy={15.5} r={2.5} />
    </>
  ),
  globe: () => (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z" />
    </>
  ),
  server: () => (
    <>
      <Rect x={4} y={4.5} width={16} height={6.5} rx={1.8} />
      <Rect x={4} y={13} width={16} height={6.5} rx={1.8} />
      <Path d="M7.5 7.75h.01M7.5 16.25h.01" />
    </>
  ),
  logout: () => <Path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7M10.5 12H20M16.5 8.5L20 12l-3.5 3.5" />,
  fire: () => <Path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.5-4-6-4.5-10.5-2.5 1.5-4 4-3.5 6.5-1.2-.5-2-1.7-2.2-3C6.5 9.5 5.5 12 5.5 14.5A6.5 6.5 0 0 0 12 21z" />,
  robotFill: (c) => (
    <G fill={c} stroke="none">
      <Rect x={11} y={2.5} width={2} height={4} rx={1} />
      <Circle cx={12} cy={2.6} r={1.7} />
      <Rect x={1.6} y={11} width={2.4} height={5} rx={1.2} />
      <Rect x={20} y={11} width={2.4} height={5} rx={1.2} />
      <Path fillRule="evenodd" d="M8 6.5h8a4.5 4.5 0 0 1 4.5 4.5v5a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16v-5A4.5 4.5 0 0 1 8 6.5zM9 10.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9.8 16.4a.8.8 0 0 0 0 1.6h4.4a.8.8 0 0 0 0-1.6z" />
    </G>
  ),
  friendsFill: (c) => (
    <G fill={c} stroke="none">
      <Circle cx={9} cy={7.6} r={3.6} />
      <Path d="M2.2 20c0-3.9 3-7 6.8-7s6.8 3.1 6.8 7z" />
      <Circle cx={17.2} cy={8.6} r={2.9} opacity={0.8} />
      <Path d="M15.4 13.3c.6-.2 1.2-.3 1.8-.3 3 0 5.3 2.5 5.3 5.7V20h-5.4c0-2.6-.6-4.9-1.7-6.7z" opacity={0.8} />
    </G>
  ),
  trophyFill: (c) => (
    <G>
      <Path d="M6.5 3h11v6.2a5.5 5.5 0 0 1-11 0z" fill={c} stroke="none" />
      <Path d="M6.6 5.2H3.8c0 2.6 1.4 4.4 3.6 4.8M17.4 5.2h2.8c0 2.6-1.4 4.4-3.6 4.8" stroke={c} strokeWidth={2} fill="none" />
      <Rect x={10.6} y={14} width={2.8} height={3.6} fill={c} stroke="none" />
      <Rect x={6.8} y={17.6} width={10.4} height={3.4} rx={1.4} fill={c} stroke="none" />
    </G>
  ),
  chestFill: (c) => (
    <G fill={c} stroke="none">
      <Path d="M3 10.5A4.5 4.5 0 0 1 7.5 6h9a4.5 4.5 0 0 1 4.5 4.5V11H3z" />
      <Path fillRule="evenodd" d="M5.2 12.2h13.6a2.2 2.2 0 0 1 2.2 2.2v3.9a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 18.3v-3.9a2.2 2.2 0 0 1 2.2-2.2zM11.5 12.6a1.2 1.2 0 0 0-1.2 1.2v1.4a1.2 1.2 0 0 0 1.2 1.2h1a1.2 1.2 0 0 0 1.2-1.2v-1.4a1.2 1.2 0 0 0-1.2-1.2z" />
    </G>
  ),
  moonFill: (c) => <Path d="M19.8 14.8A8.3 8.3 0 1 1 9.2 4.2a6.6 6.6 0 0 0 10.6 10.6z" fill={c} stroke="none" />,
  starFill: (c) => <Path d="M12 2.6l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 16.9l-5.6 2.9 1.1-6.2L3 9.2l6.2-.9z" fill={c} stroke="none" />,
  fireFill: (c) => (
    <Path d="M12 21.5a6.8 6.8 0 0 0 6.8-6.8c0-4.7-4.2-6.3-4.7-11-2.6 1.6-4.2 4.2-3.7 6.8-1.3-.5-2.1-1.8-2.3-3.1-1.6 1.6-2.9 4.3-2.9 7.3a6.8 6.8 0 0 0 6.8 6.8z" fill={c} stroke="none" />
  ),
  bulbFill: (c) => (
    <G fill={c} stroke="none">
      <Path d="M12 2.4a6.6 6.6 0 0 0-3.9 11.9c.6.5.9 1.1.9 1.8V17h6v-.9c0-.7.3-1.3.9-1.8A6.6 6.6 0 0 0 12 2.4z" />
      <Rect x={9} y={18.2} width={6} height={2} rx={1} />
      <Rect x={10} y={20.8} width={4} height={1.6} rx={0.8} />
    </G>
  ),
  flagFill: (c) => (
    <G fill={c} stroke="none">
      <Rect x={4.6} y={2.6} width={2.4} height={19} rx={1.2} />
      <Path d="M7 3.6h12l-2.8 4.8L19 13.2H7z" />
    </G>
  ),
  giftFill: (c) => (
    <G fill={c} stroke="none">
      <Rect x={3.5} y={10.5} width={7.5} height={10} rx={1.5} />
      <Rect x={13} y={10.5} width={7.5} height={10} rx={1.5} />
      <Rect x={2.5} y={7} width={8.5} height={3} rx={1} />
      <Rect x={13} y={7} width={8.5} height={3} rx={1} />
      <Path d="M11.5 6.6c-1.6-3.8-6-3.8-5.4-1C6.5 7 11.5 6.6 11.5 6.6zM12.5 6.6c1.6-3.8 6-3.8 5.4-1-.4 1.4-5.4 1-5.4 1z" />
    </G>
  ),
  targetFill: (c) => (
    <G>
      <Circle cx={12} cy={12} r={9} fill="none" stroke={c} strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={5} fill="none" stroke={c} strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={1.9} fill={c} stroke="none" />
    </G>
  ),
  medalFill: (c) => (
    <G stroke="none">
      <Path d="M7 2.5h3.4l2.2 5.4-3.2 1.6zM17 2.5h-3.4l-2.2 5.4 3.2 1.6z" fill={c} opacity={0.7} />
      <Circle cx={12} cy={14.5} r={6.8} fill={c} />
      <Path d="M12 10.3l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" fill="#00000040" />
    </G>
  ),
  lockFill: (c) => (
    <G>
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={c} strokeWidth={2.2} />
      <Rect x={5} y={10.5} width={14} height={10} rx={2.6} fill={c} stroke="none" />
    </G>
  ),
  boltFill: (c) => <Path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill={c} stroke="none" />,
  dice: () => (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={3.5} />
      <Path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth={2.6} />
    </>
  ),
};

function IconBase({ name, size = 22, color = colors.text, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name](color)}
    </Svg>
  );
}

export const Icon = memo(IconBase);

/** Moeda do jogo: disco de latão com a marca de um cavalo (no lugar do emoji 🪙). */
export const CoinIcon = memo(function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#b8862f" />
      <Circle cx={12} cy={12} r={9.2} fill="#f2be55" />
      <Circle cx={12} cy={12} r={9.2} fill="none" stroke="#f6d48d" strokeWidth={0.8} opacity={0.8} />
      <Path transform="translate(3.4 3.2) scale(0.175)" d="M70 74 C72 58 70 44 63 34 C58 27 52 22 45 20 L47 11 L38 18 C30 21 24 29 21 37 C19 43 21 48 26 49 C31 50 34 47 38 46 C42 46 44 49 41 55 C37 62 33 68 33 74 Z M27 80 H76 V89 H27 Z" fill="#8a5f1c" />
    </Svg>
  );
});

import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ChessPiece } from './ChessPiece';
import { Icon } from './Icon';
import { getBadge } from '../lib/badges';
import type { PieceStyle } from '../lib/types';

/** Peça branca e lisa desenhada no meio do escudo. */
const EMBLEM_PIECE: PieceStyle = { whiteFill: '#ffffff', whiteOutline: '#1b2547', blackFill: '#1b2547', blackOutline: '#ffffff', glow: 0, model: 'staunton' };

/**
 * Emblema de uma IA vencida: escudo na cor do nível com a peça da IA no meio.
 * `locked` desenha o escudo apagado com um cadeado (ainda não conquistado).
 */
export const Emblem = memo(function Emblem({ id, size = 40, locked }: { id: string; size?: number; locked?: boolean }) {
  const b = getBadge(id);
  if (!b) return null;
  const fill = locked ? '#2a3870' : b.color;
  const edge = locked ? '#3d4c80' : b.dark;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={id}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M24 2.5 L43 9 V23.5 C43 35 34.5 42 24 46 C13.5 42 5 35 5 23.5 V9 Z" fill={edge} />
        <Path d="M24 5.5 L40 11 V23.5 C40 33 33 39 24 42.6 C15 39 8 33 8 23.5 V11 Z" fill={fill} />
        <Path d="M24 5.5 L40 11 V16 C33 13 15 13 8 16 V11 Z" fill="#ffffff" opacity={locked ? 0.05 : 0.22} />
      </Svg>
      <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.17, width: size * 0.6, height: size * 0.6, alignItems: 'center', justifyContent: 'center' }}>
        {locked ? (
          <Icon name="lockFill" size={size * 0.42} color="#7380a8" />
        ) : (
          <ChessPiece type={b.piece} color="w" style={EMBLEM_PIECE} size={size * 0.6} />
        )}
      </View>
    </View>
  );
});

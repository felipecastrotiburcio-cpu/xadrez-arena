import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Céu estrelado discreto (fundo das telas): pontinhos fixos, desenhados uma vez só. */
const STARS = Array.from({ length: 46 }, (_, i) => {
  const fr = (v: number) => v - Math.floor(v);
  return {
    x: fr(Math.sin(i * 12.9898 + 4.1) * 43758.5453) * 100,
    y: fr(Math.sin(i * 78.233 + 1.7) * 12543.217) * 100,
    r: i % 7 === 0 ? 1.5 : 0.9,
    o: i % 3 === 0 ? 0.6 : 0.28,
  };
});

export const StarrySky = memo(function StarrySky({ height = 520 }: { height?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width="100%" height="100%">
        {STARS.map((s, i) => (
          <Circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}
      </Svg>
    </View>
  );
});

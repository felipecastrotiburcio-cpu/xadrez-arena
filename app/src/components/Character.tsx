import { View } from 'react-native';
import type { CharacterStyle } from '../lib/types';

const shade = (hex: string, amount: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v * (1 + amount)))).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

/**
 * Miniatura 2D (de frente) do boneco em blocos — leve para listas. As animações
 * usam o modelo 3D com as mesmas proporções e cores.
 */
export function CharacterThumb({ look, size }: { look: CharacterStyle; size: number }) {
  const u = size / 5.6; // 1 "stud"
  const box = (x: number, y: number, w: number, h: number, color: string, r = 0.14) => ({
    position: 'absolute' as const,
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    borderRadius: r * u,
    backgroundColor: color,
  });
  const cx = 2.0; // centro (largura total 4)
  const head = 1.3;
  const headX = cx - head / 2;
  const headY = 0.3;
  const dark = '#1b1b1f';

  return (
    <View style={{ width: 4 * u, height: 5.6 * u }}>
      {/* pernas */}
      <View style={box(cx - 1, 3.6, 0.98, 1.7, look.pants)} />
      <View style={box(cx + 0.02, 3.6, 0.98, 1.7, shade(look.pants, -0.12))} />
      <View style={box(cx - 1, 5.0, 0.98, 0.36, look.shoes, 0.08)} />
      <View style={box(cx + 0.02, 5.0, 0.98, 0.36, look.shoes, 0.08)} />
      {/* braços */}
      <View style={box(cx - 2, 1.62, 0.96, 1.9, look.skin)} />
      <View style={box(cx + 1.04, 1.62, 0.96, 1.9, shade(look.skin, -0.1))} />
      <View style={box(cx - 2, 1.62, 0.96, 0.75, look.shirt)} />
      <View style={box(cx + 1.04, 1.62, 0.96, 0.75, shade(look.shirt, -0.1))} />
      {/* tronco */}
      <View style={box(cx - 1, 1.62, 2, 2.05, look.shirt, 0.18)} />
      <View style={box(cx - 1, 3.5, 2, 0.17, shade(look.pants, -0.3), 0)} />
      {/* cabeça */}
      <View style={box(headX, headY, head, head, look.skin, 0.28)} />
      {look.face === 'visor' ? (
        <View style={box(headX + 0.1, headY + 0.35, 1.1, 0.45, '#101826', 0.08)} />
      ) : look.face === 'shades' ? (
        <View style={box(headX + 0.12, headY + 0.4, 1.06, 0.26, '#0d0d12', 0.06)} />
      ) : (
        <>
          <View style={box(headX + 0.34, headY + 0.38, 0.15, 0.24, dark, 0.04)} />
          <View style={box(headX + 0.81, headY + 0.38, 0.15, 0.24, dark, 0.04)} />
        </>
      )}
      {look.face === 'mask' ? (
        <View style={box(headX - 0.03, headY + 0.72, head + 0.06, 0.6, look.shirt, 0.2)} />
      ) : look.face !== 'visor' ? (
        <View
          style={{
            ...box(headX + 0.4, headY + 0.78, 0.5, look.face === 'grin' ? 0.22 : 0.14, look.face === 'grin' ? '#fff' : 'transparent', 0),
            borderBottomLeftRadius: u * 0.3,
            borderBottomRightRadius: u * 0.3,
            borderWidth: u * 0.05,
            borderTopWidth: 0,
            borderColor: dark,
          }}
        />
      ) : null}
      {/* acessórios */}
      {look.hat === 'cap' && (
        <>
          <View style={box(headX - 0.05, headY - 0.18, head + 0.1, 0.45, look.hatColor, 0.18)} />
          <View style={box(headX + 0.15, headY + 0.18, 1.0, 0.12, shade(look.hatColor, -0.2), 0.04)} />
        </>
      )}
      {look.hat === 'hair' && <View style={box(headX - 0.06, headY - 0.16, head + 0.12, 0.45, look.hatColor, 0.18)} />}
      {look.hat === 'headband' && <View style={box(headX - 0.04, headY + 0.08, head + 0.08, 0.18, look.hatColor, 0)} />}
      {look.hat === 'tophat' && (
        <>
          <View style={box(headX + 0.18, headY - 1.0, 0.94, 0.95, look.hatColor, 0.06)} />
          <View style={box(headX + 0.18, headY - 0.3, 0.94, 0.17, '#ffc83d', 0)} />
          <View style={box(headX - 0.3, headY - 0.1, head + 0.6, 0.12, look.hatColor, 0.06)} />
        </>
      )}
      {look.hat === 'crown' && (
        <>
          <View style={box(headX + 0.05, headY - 0.3, 1.2, 0.35, look.hatColor, 0.04)} />
          {[0.05, 0.5, 0.95].map((x) => (
            <View key={x} style={box(headX + x, headY - 0.62, 0.3, 0.36, look.hatColor, 0.12)} />
          ))}
        </>
      )}
      {look.hat === 'helmet' && (
        <View
          style={{
            ...box(headX - 0.3, headY - 0.3, head + 0.6, head + 0.55, `${look.hatColor}55`, 1),
            borderWidth: u * 0.06,
            borderColor: `${look.hatColor}aa`,
          }}
        />
      )}
    </View>
  );
}

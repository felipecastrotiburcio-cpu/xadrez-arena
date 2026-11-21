import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Chess, type Square } from 'chess.js';
import { ChessPiece, type PieceType } from './ChessPiece';
import { forSide, type EntranceStyle, type PieceStyle, type Side, type SidedStyle } from '../lib/types';
import { playEntranceSound, stopEntranceSound } from '../lib/sound';

/**
 * Surgimento das peças no começo da partida (categoria da loja). As peças aparecem uma a uma,
 * em ondas a partir das fileiras de trás, cada uma com o efeito escolhido: pop, brotar do chão,
 * chuva, glitch, pixel, teletransporte, buraco negro, aterrissagem de herói ou raio.
 *
 * Tudo roda numa camada por cima do tabuleiro (os efeitos passam dos limites das casas) e com
 * o driver nativo de animação (transformações e opacidade), sem pesar no JavaScript.
 */

const FILES = 'abcdefgh';
const native = Platform.OS !== 'web';

/** Duração do efeito de cada peça (ms). */
const PIECE_MS: Record<EntranceStyle['effect'], number> = {
  pop: 520,
  ground: 900,
  rain: 850,
  glitch: 800,
  pixel: 950,
  teleport: 1000,
  blackhole: 1100,
  hero: 950,
  lightning: 1000,
};
/** Duração máxima do surgimento inteiro (usada para a IA esperar antes do 1º lance). */
export const ENTRANCE_MAX_MS = 2300;

// Pseudo-aleatório estável por casa (mesmo desenho a cada repetição).
const rand = (n: number) => {
  const x = Math.sin(n * 91.345) * 47453.5453;
  return x - Math.floor(x);
};

interface PieceSpot {
  square: Square;
  type: PieceType;
  color: Side;
  x: number;
  y: number;
  delay: number;
}

function spots(fen: string, orientation: Side, sq: number): PieceSpot[] {
  const chess = new Chess(fen);
  const out: PieceSpot[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p) continue;
      const f = FILES.indexOf(p.square[0]);
      const r = Number(p.square[1]);
      const col = orientation === 'w' ? f : 7 - f;
      const rowIdx = orientation === 'w' ? 8 - r : r - 1;
      // Ondas: fileira de trás das brancas, peões, fileira de trás das pretas, peões... (como no vídeo)
      const wave = r === 1 ? 0 : r === 2 ? 1 : r === 8 ? 0.5 : r === 7 ? 1.5 : 2;
      const delay = wave * 260 + f * 45 + rand(f * 8 + r) * 110;
      out.push({ square: p.square, type: p.type as PieceType, color: p.color, x: col * sq, y: rowIdx * sq, delay });
    }
  }
  return out;
}

interface Props {
  fen: string;
  orientation: Side;
  sq: number;
  pieceStyle: SidedStyle<PieceStyle>;
  /** Um efeito para todas as peças, ou um por lado (cada jogador com o seu surgimento). */
  entrance: SidedStyle<EntranceStyle>;
  /** Muda a cada vez que o surgimento deve tocar. */
  playKey: number;
  onDone: () => void;
}

function EntranceLayerBase({ fen, orientation, sq, pieceStyle, entrance, playKey, onDone }: Props) {
  const list = useMemo(() => spots(fen, orientation, sq), [fen, orientation, sq]);
  const values = useMemo(() => list.map(() => new Animated.Value(0)), [list, playKey]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const white = forSide(entrance, 'w');
  const black = forSide(entrance, 'b');
  const fx = (c: Side) => (c === 'w' ? white : black);

  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: PIECE_MS[fx(list[i].color).effect] ?? 700,
        delay: list[i].delay,
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    const all = Animated.parallel(anims);
    let ended = false;
    playEntranceSound([white.effect, black.effect]);
    all.start(({ finished }) => {
      if (!finished) return;
      ended = true; // a cauda do som (reverberação) continua tocando até o fim
      doneRef.current();
    });
    return () => {
      all.stop();
      if (!ended) stopEntranceSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, list, white.effect, black.effect]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {list.map((s, i) => (
        <View key={`${s.square}-${playKey}`} style={{ position: 'absolute', left: s.x, top: s.y, width: sq, height: sq }}>
          <EffectPiece effect={fx(s.color).effect} color={fx(s.color).color} p={values[i]} sq={sq} seed={i}>
            <ChessPiece type={s.type} color={s.color} style={pieceStyle} size={sq} />
          </EffectPiece>
        </View>
      ))}
    </View>
  );
}

export const EntranceLayer = memo(EntranceLayerBase);

// ------------------------------------------------------------------ efeitos

type V = Animated.Value;
const lerp = (p: V, input: number[], output: number[] | string[]) =>
  p.interpolate({ inputRange: input, outputRange: output as number[], extrapolate: 'clamp' });

const fill = StyleSheet.absoluteFill;

function EffectPiece({ effect, color, p, sq, seed, children }: { effect: EntranceStyle['effect']; color: string; p: V; sq: number; seed: number; children: React.ReactNode }) {
  switch (effect) {
    case 'ground':
      return <Ground p={p} sq={sq} seed={seed} color={color}>{children}</Ground>;
    case 'rain':
      return <Rain p={p} sq={sq}>{children}</Rain>;
    case 'glitch':
      return <Glitch p={p} sq={sq} seed={seed} color={color}>{children}</Glitch>;
    case 'pixel':
      return <Pixel p={p} sq={sq} seed={seed} color={color}>{children}</Pixel>;
    case 'teleport':
      return <Teleport p={p} sq={sq} color={color}>{children}</Teleport>;
    case 'blackhole':
      return <BlackHole p={p} sq={sq} color={color}>{children}</BlackHole>;
    case 'hero':
      return <Hero p={p} sq={sq} color={color} seed={seed}>{children}</Hero>;
    case 'lightning':
      return <Lightning p={p} sq={sq} color={color} seed={seed}>{children}</Lightning>;
    default:
      return <Pop p={p}>{children}</Pop>;
  }
}

/** Pop: cresce quicando. */
function Pop({ p, children }: { p: V; children: React.ReactNode }) {
  return (
    <Animated.View style={[fill, styles.center, { opacity: lerp(p, [0, 0.15], [0, 1]), transform: [{ scale: lerp(p, [0, 0.55, 0.78, 1], [0, 1.22, 0.92, 1]) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Brota do chão: abre um buraco, a peça sobe de dentro do tabuleiro e espalha terra (como no vídeo). */
function Ground({ p, sq, seed, color, children }: { p: V; sq: number; seed: number; color: string; children: React.ReactNode }) {
  const holeW = sq * 0.78;
  const dirt = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <Animated.View
        style={{
          position: 'absolute', left: (sq - holeW) / 2, top: sq * 0.74, width: holeW, height: sq * 0.2, borderRadius: sq,
          backgroundColor: '#1c120a',
          opacity: lerp(p, [0, 0.12, 0.7, 1], [0, 0.9, 0.9, 0]),
          transform: [{ scaleX: lerp(p, [0, 0.2, 0.75, 1], [0.1, 1, 1, 0.4]) }],
        }}
      />
      {/* rachaduras em volta do buraco */}
      <Animated.View style={[fill, { opacity: lerp(p, [0.1, 0.2, 0.8, 1], [0, 1, 1, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Path
            d={`M${sq * 0.12} ${sq * 0.83} L${sq * 0.04} ${sq * 0.92} M${sq * 0.88} ${sq * 0.8} L${sq * 0.97} ${sq * 0.74} M${sq * 0.3} ${sq * 0.9} L${sq * 0.24} ${sq * 0.99} M${sq * 0.7} ${sq * 0.91} L${sq * 0.78} ${sq * 0.99}`}
            stroke="#1c120a"
            strokeWidth={Math.max(1, sq * 0.025)}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      {/* a peça sobe de dentro do chão: a parte abaixo da "linha do chão" fica escondida */}
      <View style={{ position: 'absolute', left: 0, top: -sq * 0.3, width: sq, height: sq * 1.12, overflow: 'hidden' }}>
        <Animated.View
          style={{
            position: 'absolute', left: 0, top: sq * 0.3, width: sq, height: sq, alignItems: 'center', justifyContent: 'center',
            transform: [
              { translateY: lerp(p, [0.15, 0.62, 0.74, 0.86], [sq * 0.95, -sq * 0.1, sq * 0.03, 0]) },
              { scaleY: lerp(p, [0.62, 0.7, 0.8], [1.08, 0.94, 1]) },
            ],
          }}
        >
          {children}
        </Animated.View>
      </View>
      {dirt.map((k) => {
        const dir = (k - 2.5) / 2.5;
        const d = sq * (0.06 + rand(seed * 7 + k) * 0.05);
        return (
          <Animated.View
            key={k}
            style={{
              position: 'absolute', left: sq / 2 - d / 2, top: sq * 0.78, width: d, height: d, borderRadius: d * 0.3,
              backgroundColor: k % 2 ? color : '#3b2614',
              opacity: lerp(p, [0.25, 0.3, 0.75, 0.85], [0, 1, 1, 0]),
              transform: [
                { translateX: lerp(p, [0.25, 0.8], [0, dir * sq * (0.5 + rand(seed + k) * 0.3)]) },
                { translateY: lerp(p, [0.25, 0.5, 0.8], [0, -sq * (0.35 + rand(seed * 3 + k) * 0.25), sq * 0.05]) },
                { rotate: lerp(p, [0.25, 0.8], ['0deg', `${dir * 260}deg`]) },
              ],
            }}
          />
        );
      })}
    </>
  );
}

/** Chuva: despenca do céu, achata no impacto e levanta poeira. */
function Rain({ p, sq, children }: { p: V; sq: number; children: React.ReactNode }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <Animated.View
          key={side}
          style={{
            position: 'absolute', left: sq / 2 - sq * 0.22 + side * sq * 0.22, top: sq * 0.78, width: sq * 0.44, height: sq * 0.2,
            borderRadius: sq, backgroundColor: '#e8e2d6',
            opacity: lerp(p, [0.55, 0.6, 0.95], [0, 0.85, 0]),
            transform: [{ translateX: lerp(p, [0.55, 0.95], [0, side * sq * 0.25]) }, { scale: lerp(p, [0.55, 0.95], [0.3, 1.3]) }],
          }}
        />
      ))}
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0, 0.08], [0, 1]),
            transform: [
              { translateY: lerp(p, [0, 0.55, 0.68, 0.8], [-sq * 4.5, 0, -sq * 0.14, 0]) },
              { scaleY: lerp(p, [0.53, 0.58, 0.68], [1.12, 0.78, 1]) },
              { scaleX: lerp(p, [0.53, 0.58, 0.68], [0.92, 1.12, 1]) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}

/** Glitch: pisca e treme, com faixas coloridas atravessando a casa. */
function Glitch({ p, sq, seed, color, children }: { p: V; sq: number; seed: number; color: string; children: React.ReactNode }) {
  const j = sq / 14;
  const steps = [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 1];
  return (
    <>
      {[0, 1, 2].map((k) => (
        <Animated.View
          key={k}
          style={{
            position: 'absolute', left: 0, width: sq, top: sq * (0.15 + rand(seed * 5 + k) * 0.6), height: sq * (0.08 + rand(seed + k) * 0.1),
            backgroundColor: k === 1 ? '#00f0ff' : color,
            opacity: lerp(p, [0, 0.1 + k * 0.12, 0.2 + k * 0.12, 0.72], [0, 0.85, 0.2, 0]),
            transform: [{ translateX: lerp(p, [0, 0.72], [(k % 2 ? -1 : 1) * sq * 0.6, 0]) }],
          }}
        />
      ))}
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, steps, [0, 1, 0, 1, 0.1, 1, 0.3, 1, 0.6, 1, 1]),
            transform: [
              { translateX: lerp(p, steps, [0, j * 2, -j * 2, j, -j * 3, j * 2, -j, j, 0, 0, 0]) },
              { skewX: lerp(p, steps, ['0deg', '12deg', '-10deg', '6deg', '0deg', '-8deg', '4deg', '0deg', '0deg', '0deg', '0deg']) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}

/** Pixel: bloquinhos se juntam e viram a peça. */
function Pixel({ p, sq, seed, color, children }: { p: V; sq: number; seed: number; color: string; children: React.ReactNode }) {
  const n = 4;
  const cell = (sq * 0.7) / n;
  const blocks = Array.from({ length: n * n }, (_, k) => k);
  return (
    <>
      {blocks.map((k) => {
        const cx = k % n;
        const cy = Math.floor(k / n);
        const start = 0.05 + rand(seed * 13 + k) * 0.4;
        return (
          <Animated.View
            key={k}
            style={{
              position: 'absolute', left: sq * 0.15 + cx * cell, top: sq * 0.12 + cy * cell, width: cell - 1, height: cell - 1,
              backgroundColor: (cx + cy) % 2 ? color : '#ffffff',
              opacity: lerp(p, [start, start + 0.08, 0.75, 0.9], [0, 1, 1, 0]),
              transform: [
                { translateY: lerp(p, [start, start + 0.15], [-sq * (0.6 + rand(k + seed) * 0.6), 0]) },
                { scale: lerp(p, [start, start + 0.15], [0.3, 1]) },
              ],
            }}
          />
        );
      })}
      <Animated.View style={[fill, styles.center, { opacity: lerp(p, [0.68, 0.85], [0, 1]), transform: [{ scale: lerp(p, [0.68, 0.85, 1], [0.85, 1.08, 1]) }] }]}>
        {children}
      </Animated.View>
    </>
  );
}

/** Teletransporte: um feixe de luz desce e a peça se materializa. */
function Teleport({ p, sq, color, children }: { p: V; sq: number; color: string; children: React.ReactNode }) {
  return (
    <>
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.2, width: sq * 0.6, top: -sq * 2.2, height: sq * 3.1, borderRadius: sq * 0.3,
          backgroundColor: color,
          opacity: lerp(p, [0, 0.15, 0.6, 0.85], [0, 0.55, 0.45, 0]),
          transform: [{ scaleX: lerp(p, [0, 0.15, 0.6, 0.85], [0.05, 1, 0.7, 0.05]) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.38, width: sq * 0.24, top: -sq * 2.2, height: sq * 3.1, borderRadius: sq,
          backgroundColor: '#ffffff',
          opacity: lerp(p, [0.05, 0.2, 0.6, 0.8], [0, 0.9, 0.6, 0]),
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.1, top: sq * 0.72, width: sq * 0.8, height: sq * 0.22, borderRadius: sq,
          borderWidth: Math.max(1.5, sq * 0.04), borderColor: color,
          opacity: lerp(p, [0.1, 0.25, 0.85, 1], [0, 1, 1, 0]),
          transform: [{ scale: lerp(p, [0.1, 0.5, 1], [0.3, 1, 1.25]) }],
        }}
      />
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0.3, 0.38, 0.44, 0.5, 0.56, 0.64], [0, 0.8, 0.2, 0.9, 0.4, 1]),
            transform: [{ scaleX: lerp(p, [0.3, 0.6, 0.7], [0.15, 1.08, 1]) }, { scaleY: lerp(p, [0.3, 0.6], [1.3, 1]) }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}

/** Buraco negro: um vórtice gira na casa e cospe a peça girando. */
function BlackHole({ p, sq, color, children }: { p: V; sq: number; color: string; children: React.ReactNode }) {
  const d = sq * 0.9;
  return (
    <>
      <Animated.View
        style={{
          position: 'absolute', left: (sq - d) / 2, top: (sq - d) / 2, width: d, height: d, borderRadius: d,
          backgroundColor: '#05010d', borderWidth: Math.max(2, sq * 0.07), borderColor: color,
          opacity: lerp(p, [0, 0.12, 0.7, 0.9], [0, 1, 1, 0]),
          transform: [{ scale: lerp(p, [0, 0.2, 0.7, 0.9], [0, 1, 1, 0]) }, { rotate: lerp(p, [0, 1], ['0deg', '900deg']) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: (sq - d * 1.25) / 2, top: (sq - d * 1.25) / 2, width: d * 1.25, height: d * 1.25, borderRadius: d,
          borderWidth: Math.max(1.5, sq * 0.035), borderColor: '#ffffff', borderStyle: 'dashed',
          opacity: lerp(p, [0.05, 0.2, 0.6, 0.85], [0, 0.7, 0.7, 0]),
          transform: [{ scale: lerp(p, [0.05, 0.3, 0.85], [1.6, 1, 0.2]) }, { rotate: lerp(p, [0, 1], ['0deg', '-720deg']) }],
        }}
      />
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0.3, 0.4], [0, 1]),
            transform: [{ scale: lerp(p, [0.3, 0.75, 0.88, 1], [0, 1.15, 0.95, 1]) }, { rotate: lerp(p, [0.3, 0.8], ['-720deg', '0deg']) }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}

/** Aterrissagem de herói: cai do alto (vindo na direção da tela), impacto, onda de choque e rachaduras. */
function Hero({ p, sq, color, seed, children }: { p: V; sq: number; color: string; seed: number; children: React.ReactNode }) {
  const cracks = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2 + rand(seed + k) * 0.8;
    const r = sq * (0.32 + rand(seed * 5 + k) * 0.18);
    const cx = sq / 2;
    const cy = sq * 0.82;
    return `M${cx} ${cy} L${cx + Math.cos(a) * r * 0.5} ${cy + Math.sin(a) * r * 0.25} L${cx + Math.cos(a + 0.2) * r} ${cy + Math.sin(a + 0.2) * r * 0.45}`;
  });
  return (
    <Animated.View style={[fill, { transform: [{ translateX: lerp(p, [0.5, 0.55, 0.6, 0.65, 0.7], [0, -sq * 0.05, sq * 0.05, -sq * 0.03, 0]) }] }]}>
      <Animated.View style={[fill, { opacity: lerp(p, [0.48, 0.52, 0.95, 1], [0, 1, 1, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Path d={cracks.join(' ')} stroke="#1a1208" strokeWidth={Math.max(1, sq * 0.03)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.05, top: sq * 0.6, width: sq * 0.9, height: sq * 0.42, borderRadius: sq,
          borderWidth: Math.max(2, sq * 0.06), borderColor: color,
          opacity: lerp(p, [0.48, 0.52, 0.9], [0, 1, 0]),
          transform: [{ scale: lerp(p, [0.48, 0.9], [0.2, 2.1]) }],
        }}
      />
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0, 0.1], [0, 1]),
            transform: [
              { translateY: lerp(p, [0, 0.5], [-sq * 2.2, 0]) },
              { scale: lerp(p, [0, 0.5, 0.58, 0.7], [2.6, 1, 0.86, 1]) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Raio: um raio cai na casa, clarão, e a peça surge soltando faíscas. */
function Lightning({ p, sq, color, seed, children }: { p: V; sq: number; color: string; seed: number; children: React.ReactNode }) {
  const w = sq;
  const h = sq * 2.6;
  const x = (k: number) => w * (0.5 + (rand(seed * 11 + k) - 0.5) * 0.45);
  const bolt = `M${x(0)} 0 L${x(1)} ${h * 0.25} L${x(2) + w * 0.12} ${h * 0.27} L${x(3)} ${h * 0.55} L${x(4) + w * 0.1} ${h * 0.57} L${w / 2} ${h}`;
  const flick = [0, 0.04, 0.1, 0.14, 0.2, 0.3, 0.45];
  return (
    <>
      <Animated.View style={[fill, { backgroundColor: '#fffbe0', opacity: lerp(p, [0.06, 0.12, 0.4], [0, 0.95, 0]) }]} />
      <Animated.View
        style={{
          position: 'absolute', left: -sq * 0.1, top: -sq * 0.25, width: sq * 1.2, height: sq * 0.55, borderRadius: sq,
          backgroundColor: '#2a2350',
          opacity: lerp(p, [0, 0.06, 0.4, 0.55], [0, 0.85, 0.85, 0]),
        }}
      />
      <Animated.View style={{ position: 'absolute', left: 0, top: sq - h + sq * 0.1, opacity: lerp(p, flick, [0, 1, 0.15, 1, 0.3, 0.9, 0]) }}>
        <Svg width={w} height={h}>
          {/* contorno escuro: o raio aparece até em tabuleiros claros */}
          <Path d={bolt} stroke="#1b1446" strokeWidth={Math.max(5, sq * 0.2)} strokeLinejoin="round" strokeLinecap="round" fill="none" opacity={0.55} />
          <Path d={bolt} stroke={color} strokeWidth={Math.max(3.5, sq * 0.13)} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          <Path d={bolt} stroke="#ffffff" strokeWidth={Math.max(1.5, sq * 0.05)} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2 + rand(seed + k);
        const d = Math.max(2, sq * 0.06);
        return (
          <Animated.View
            key={k}
            style={{
              position: 'absolute', left: sq / 2 - d / 2, top: sq * 0.7, width: d, height: d * 2.2, borderRadius: d,
              backgroundColor: color,
              opacity: lerp(p, [0.12, 0.18, 0.55], [0, 1, 0]),
              transform: [
                { translateX: lerp(p, [0.12, 0.55], [0, Math.cos(a) * sq * 0.5]) },
                { translateY: lerp(p, [0.12, 0.55], [0, Math.sin(a) * sq * 0.35 - sq * 0.1]) },
                { rotate: `${(a * 180) / Math.PI + 90}deg` },
              ],
            }}
          />
        );
      })}
      <Animated.View
        style={[
          fill,
          styles.center,
          { opacity: lerp(p, [0.1, 0.16], [0, 1]), transform: [{ scale: lerp(p, [0.1, 0.3, 0.45], [1.35, 0.9, 1]) }] },
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

/** Vitrine da loja: um cavalo surgindo em loop com o efeito, numa casa do tabuleiro equipado. */
export function EntranceDemo({ entrance, pieceStyle, light, dark, size = 84 }: { entrance: EntranceStyle; pieceStyle: PieceStyle; light: string; dark: string; size?: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: PIECE_MS[entrance.effect] ?? 700, easing: Easing.linear, useNativeDriver: native }),
        Animated.delay(900),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: native }),
        Animated.delay(250),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p, entrance.effect]);
  const sq = size * 0.62;
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', backgroundColor: dark, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', left: (size - sq) / 2, bottom: size * 0.08, width: sq, height: sq, backgroundColor: light, borderRadius: 4 }} />
      <View style={{ width: sq, height: sq, marginBottom: size * 0.08 }}>
        <EffectPiece effect={entrance.effect} color={entrance.color} p={p} sq={sq} seed={3}>
          <ChessPiece type="n" color="w" style={pieceStyle} size={sq} />
        </EffectPiece>
      </View>
    </View>
  );
}

import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
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
  hero: 1050,
  lightning: 1100,
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

  // Efeitos do tabuleiro inteiro (só nos lendários Herói e Raio): tremor, clarões e céu de tempestade.
  const board = useMemo(() => boardFx(list, fx), [list, white.effect, black.effect, white.color, black.color]); // eslint-disable-line react-hooks/exhaustive-deps
  const clock = useMemo(() => new Animated.Value(0), [playKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!board) return;
    const a = Animated.timing(clock, { toValue: 1, duration: board.total, easing: Easing.linear, useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [board, clock]);

  const pieces = list.map((s, i) => (
    <View key={`${s.square}-${playKey}`} style={{ position: 'absolute', left: s.x, top: s.y, width: sq, height: sq }}>
      <EffectPiece effect={fx(s.color).effect} color={fx(s.color).color} p={values[i]} sq={sq} seed={i}>
        <ChessPiece type={s.type} color={s.color} style={pieceStyle} size={sq} />
      </EffectPiece>
    </View>
  ));

  if (!board) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pieces}
      </View>
    );
  }
  const curve = (values: number[]) => clock.interpolate({ inputRange: board.input, outputRange: values, extrapolate: 'clamp' });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {board.storm && <Animated.View style={[fill, { backgroundColor: '#070b22', opacity: curve(board.storm) }]} />}
      <Animated.View style={[fill, { transform: [{ translateX: curve(board.shakeX) }, { translateY: curve(board.shakeY) }] }]}>
        {pieces}
      </Animated.View>
      {board.flash && <Animated.View style={[fill, { backgroundColor: board.flashColor, opacity: curve(board.flash) }]} />}
    </View>
  );
}

/**
 * Curvas (amostradas a cada 16 ms) dos efeitos que pegam o tabuleiro todo: cada peça que aterrissa
 * (Herói) dá um tranco e um clarão colorido; cada raio (Raio) escurece o céu e pisca a tela de branco.
 */
function boardFx(list: PieceSpot[], fx: (c: Side) => EntranceStyle) {
  const heroes = list.filter((s) => fx(s.color).effect === 'hero');
  const bolts = list.filter((s) => fx(s.color).effect === 'lightning');
  if (!heroes.length && !bolts.length) return null;
  const total = Math.max(...list.map((s) => s.delay + (PIECE_MS[fx(s.color).effect] ?? 700))) + 200;
  const step = 16;
  const n = Math.ceil(total / step) + 1;
  const input: number[] = [];
  const shakeX: number[] = [];
  const shakeY: number[] = [];
  const flash: number[] = [];
  const storm: number[] = [];
  const hits = heroes.map((s) => s.delay + PIECE_MS.hero * 0.5);
  // Clarões: um por fileira (no 1º impacto/raio dela), para a tela piscar e não ficar branca o tempo todo.
  const firstOfWave = (arr: PieceSpot[], frac: number, ms: number) => {
    const by = new Map<number, number>();
    for (const s of arr) {
      const w = Math.round(s.y);
      by.set(w, Math.min(by.get(w) ?? Infinity, s.delay + ms * frac));
    }
    return [...by.values()];
  };
  const heroFlash = firstOfWave(heroes, 0.5, PIECE_MS.hero).map((t) => t + 60);
  const boltFlash = firstOfWave(bolts, 0.045, PIECE_MS.lightning);
  const strikes = bolts.map((s) => s.delay + PIECE_MS.lightning * 0.045);
  const lastBolt = bolts.length ? Math.max(...bolts.map((s) => s.delay)) + PIECE_MS.lightning * 0.5 : 0;
  const firstBolt = bolts.length ? Math.min(...bolts.map((s) => s.delay)) : 0;
  for (let k = 0; k < n; k++) {
    const t = Math.min(total, k * step);
    input.push(t / total);
    let shake = 0;
    let fl = 0;
    for (const h of hits) {
      const d = t - h;
      if (d >= 0 && d < 260) shake += 0.45 * Math.exp(-d / 70);
    }
    for (const h of heroFlash) {
      const d = t - h;
      if (d >= 0 && d < 300) fl += 0.3 * Math.exp(-d / 70);
    }
    for (const h of strikes) {
      const d = t - h;
      if (d >= 0 && d < 160) shake += 0.1 * Math.exp(-d / 40);
    }
    for (const h of boltFlash) {
      const d = t - h;
      // clarão duplo: o raio pisca duas vezes
      if (d >= 0 && d < 220) fl += 0.38 * (d < 40 ? 1 - d / 40 : 0) + 0.26 * Math.max(0, 1 - Math.abs(d - 85) / 35);
    }
    const amp = Math.min(1, shake);
    shakeX.push(k === n - 1 ? 0 : amp * 5 * Math.sin(k * 2.3) * Math.cos(k * 0.7));
    shakeY.push(k === n - 1 ? 0 : amp * 6 * Math.sin(k * 3.1 + 1));
    flash.push(Math.min(0.38, fl));
    // céu de tempestade: escurece antes do 1º raio e clareia depois do último
    const st = bolts.length
      ? Math.min(1, Math.max(0, (t - firstBolt + 220) / 220)) * Math.min(1, Math.max(0, 1 - (t - lastBolt) / 450))
      : 0;
    storm.push(st * 0.5);
  }
  const heroColor = heroes.length ? fx(heroes[0].color).color : '#ffffff';
  return {
    total,
    input,
    shakeX,
    shakeY,
    flash,
    flashColor: bolts.length ? '#f4f6ff' : heroColor,
    storm: bolts.length ? storm : null,
  };
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

/**
 * Aterrissagem de herói: a sombra cresce no chão, a peça despenca do alto com um rastro de cometa,
 * achata no impacto (clarão em estrela, duas ondas de choque, cratera com rachaduras em brasa,
 * pedras e poeira voando) e se levanta com uma aura de poder.
 */
function Hero({ p, sq, color, seed, children }: { p: V; sq: number; color: string; seed: number; children: React.ReactNode }) {
  const cx = sq / 2;
  const cy = sq * 0.8;
  const cracks = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (k / 6) * Math.PI * 2 + rand(seed + k) * 0.7;
    const r = sq * (0.36 + rand(seed * 5 + k) * 0.2);
    const bend = a + (rand(seed * 3 + k) - 0.5) * 0.6;
    return `M${cx} ${cy} L${cx + Math.cos(a) * r * 0.5} ${cy + Math.sin(a) * r * 0.28} L${cx + Math.cos(bend) * r} ${cy + Math.sin(bend) * r * 0.42}`;
  }).join(' ');
  // estrela do impacto (8 pontas)
  const B = sq * 1.6;
  const star = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2 - Math.PI / 2;
    const r = (k % 2 ? 0.2 : 0.5 - rand(seed * 9 + k) * 0.12) * B;
    return `${B / 2 + Math.cos(a) * r},${B / 2 + Math.sin(a) * r * 0.7}`;
  }).join(' ');
  const L = 0.5; // instante do impacto
  return (
    <>
      {/* sombra que cresce enquanto a peça cai */}
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.14, top: sq * 0.72, width: sq * 0.72, height: sq * 0.2, borderRadius: sq,
          backgroundColor: '#000',
          opacity: lerp(p, [0, L, L + 0.04, 0.75], [0.05, 0.5, 0.55, 0]),
          transform: [{ scale: lerp(p, [0, L], [0.15, 1.05]) }],
        }}
      />
      {/* cratera com rachaduras em brasa */}
      <Animated.View style={[fill, { opacity: lerp(p, [L - 0.01, L + 0.03, 0.85, 1], [0, 1, 0.85, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Ellipse cx={cx} cy={cy} rx={sq * 0.3} ry={sq * 0.1} fill="#120a04" opacity={0.6} />
          <Path d={cracks} stroke="#120a04" strokeWidth={Math.max(2, sq * 0.07)} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
          <Path d={cracks} stroke={color} strokeWidth={Math.max(1.5, sq * 0.04)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d={cracks} stroke="#fff4c4" strokeWidth={Math.max(0.8, sq * 0.014)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
      {/* ondas de choque (achatadas, no chão) */}
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.05, top: sq * 0.6, width: sq * 0.9, height: sq * 0.4, borderRadius: sq,
          borderWidth: Math.max(2.5, sq * 0.08), borderColor: color,
          opacity: lerp(p, [L - 0.01, L + 0.02, 0.92], [0, 1, 0]),
          transform: [{ scale: lerp(p, [L, 0.92], [0.2, 2.6]) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.05, top: sq * 0.6, width: sq * 0.9, height: sq * 0.4, borderRadius: sq,
          borderWidth: Math.max(1.5, sq * 0.035), borderColor: '#ffffff',
          opacity: lerp(p, [L + 0.02, L + 0.05, 0.8], [0, 0.9, 0]),
          transform: [{ scale: lerp(p, [L + 0.02, 0.8], [0.2, 1.9]) }],
        }}
      />
      {/* poeira */}
      {[-1, 0, 1].map((k) => (
        <Animated.View
          key={`d${k}`}
          style={{
            position: 'absolute', left: cx - sq * 0.2 + k * sq * 0.18, top: sq * 0.62, width: sq * 0.4, height: sq * 0.32, borderRadius: sq,
            backgroundColor: '#d9cbb5',
            opacity: lerp(p, [L, L + 0.04, 0.95], [0, 0.55, 0]),
            transform: [
              { translateX: lerp(p, [L, 0.95], [0, k * sq * 0.45]) },
              { translateY: lerp(p, [L, 0.95], [0, -sq * 0.12]) },
              { scale: lerp(p, [L, 0.95], [0.3, 1.5]) },
            ],
          }}
        />
      ))}
      {/* pedras voando em arco */}
      {[0, 1, 2, 3, 4, 5, 6].map((k) => {
        const dir = (k - 3) / 3 + (rand(seed * 7 + k) - 0.5) * 0.3;
        const d = sq * (0.07 + rand(seed * 11 + k) * 0.06);
        const up = sq * (0.45 + rand(seed * 13 + k) * 0.5);
        return (
          <Animated.View
            key={`r${k}`}
            style={{
              position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: d * 0.25,
              backgroundColor: k % 3 === 0 ? color : k % 3 === 1 ? '#6b5038' : '#3a2a1a',
              opacity: lerp(p, [L, L + 0.02, 0.85, 0.95], [0, 1, 1, 0]),
              transform: [
                { translateX: lerp(p, [L, 0.95], [0, dir * sq * 0.9]) },
                { translateY: lerp(p, [L, L + 0.14, 0.95], [0, -up, sq * 0.15]) },
                { rotate: lerp(p, [L, 0.95], ['0deg', `${dir * 540}deg`]) },
              ],
            }}
          />
        );
      })}
      {/* aura de poder depois de aterrissar */}
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.08, top: sq * 0.08, width: sq * 0.84, height: sq * 0.84, borderRadius: sq,
          borderWidth: Math.max(2, sq * 0.05), borderColor: color,
          opacity: lerp(p, [0.62, 0.72, 1], [0, 0.85, 0]),
          transform: [{ scale: lerp(p, [0.62, 1], [0.7, 1.35]) }],
        }}
      />
      {/* a peça caindo, com rastro de cometa */}
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0, 0.06], [0, 1]),
            transform: [
              { translateY: lerp(p, [0, 0.2, 0.35, L], [-sq * 2.8, -sq * 2.35, -sq * 1.43, 0]) },
              { scale: lerp(p, [0, L], [2.5, 1]) },
              { scaleY: lerp(p, [L, L + 0.04, 0.62, 0.72], [1, 0.7, 1.12, 1]) },
              { scaleX: lerp(p, [L, L + 0.04, 0.62, 0.72], [1, 1.28, 0.94, 1]) },
            ],
          },
        ]}
      >
        <Animated.View
          style={{ position: 'absolute', left: sq * 0.22, top: -sq * 1.5, opacity: lerp(p, [0, 0.08, L - 0.04, L], [0, 0.95, 0.95, 0]) }}
        >
          <Svg width={sq * 0.56} height={sq * 1.75}>
            <Defs>
              <LinearGradient id={`trail${seed}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0" />
                <Stop offset="0.7" stopColor={color} stopOpacity="0.55" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
              </LinearGradient>
            </Defs>
            <Path d={`M${sq * 0.2} 0 L${sq * 0.36} 0 L${sq * 0.56} ${sq * 1.5} Q${sq * 0.28} ${sq * 1.85} 0 ${sq * 1.5} Z`} fill={`url(#trail${seed})`} />
          </Svg>
        </Animated.View>
        {children}
      </Animated.View>
      {/* clarão em estrela no impacto */}
      <Animated.View
        style={{
          position: 'absolute', left: cx - B / 2, top: cy - B / 2,
          opacity: lerp(p, [L - 0.01, L + 0.01, L + 0.16], [0, 1, 0]),
          transform: [{ scale: lerp(p, [L - 0.01, L + 0.16], [0.25, 1.25]) }],
        }}
      >
        <Svg width={B} height={B}>
          <Polygon points={star} fill="#fffbe6" stroke={color} strokeWidth={Math.max(2, sq * 0.05)} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </>
  );
}

/** Zigue-zague de um raio de `x0,y0` até `x1,y1`. */
function zigzag(seed: number, x0: number, y0: number, x1: number, y1: number, steps: number, jitter: number) {
  let d = `M${x0} ${y0}`;
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    const j = (rand(seed * 17 + k) - 0.5) * 2 * jitter;
    d += ` L${x0 + (x1 - x0) * f + j} ${y0 + (y1 - y0) * f}`;
  }
  return `${d} L${x1} ${y1}`;
}

/**
 * Raio: a casa escurece sob uma nuvem, um raio guia pisca, cai o raio principal com galhos e brilho
 * (e uma segunda descarga), clarão branco, marca queimada, faíscas com gravidade e a peça surge
 * eletrizada, com arcos elétricos correndo em volta dela.
 */
function Lightning({ p, sq, color, seed, children }: { p: V; sq: number; color: string; seed: number; children: React.ReactNode }) {
  const w = sq;
  const h = sq * 3;
  const top = sq - h + sq * 0.12;
  const main = zigzag(seed, w * (0.3 + rand(seed) * 0.4), 0, w / 2, h, 7, w * 0.2);
  const fork1 = zigzag(seed + 3, w * 0.5 + (rand(seed + 1) - 0.5) * w * 0.3, h * 0.35, w * (rand(seed + 2) < 0.5 ? 0.05 : 0.95), h * 0.68, 4, w * 0.1);
  const fork2 = zigzag(seed + 5, w * 0.5, h * 0.6, w * (rand(seed + 4) < 0.5 ? 0.15 : 0.85), h * 0.86, 3, w * 0.08);
  const leader = zigzag(seed + 9, w * 0.5, 0, w * 0.45, h * 0.55, 6, w * 0.25);
  const bolt = (d: string, k: number) => (
    <>
      <Path d={d} stroke={color} strokeWidth={Math.max(6, sq * 0.3) * k} strokeLinejoin="round" strokeLinecap="round" fill="none" opacity={0.28} />
      <Path d={d} stroke="#140f3a" strokeWidth={Math.max(4, sq * 0.15) * k} strokeLinejoin="round" strokeLinecap="round" fill="none" opacity={0.5} />
      <Path d={d} stroke={color} strokeWidth={Math.max(3, sq * 0.1) * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <Path d={d} stroke="#ffffff" strokeWidth={Math.max(1.2, sq * 0.04) * k} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </>
  );
  // pisca: descarga principal (0.04) e re-descarga (0.3)
  const flick = [0.03, 0.045, 0.08, 0.1, 0.14, 0.2, 0.28, 0.3, 0.33, 0.37, 0.45];
  const flickV = [0, 1, 0.25, 1, 0.4, 0, 0, 1, 0.3, 0.8, 0];
  const arc1 = zigzag(seed + 21, sq * 0.18, sq * 0.75, sq * 0.3, sq * 0.15, 5, sq * 0.07);
  const arc2 = zigzag(seed + 23, sq * 0.82, sq * 0.78, sq * 0.7, sq * 0.2, 5, sq * 0.07);
  const arcSteps = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8];
  return (
    <>
      {/* a casa escurece sob a tempestade */}
      <Animated.View style={[fill, { backgroundColor: '#0a0f2e', opacity: lerp(p, [0, 0.04, 0.5, 0.75], [0, 0.55, 0.35, 0]) }]} />
      {/* marca queimada e brilho no ponto do raio */}
      <Animated.View style={[fill, { opacity: lerp(p, [0.04, 0.07, 0.75, 1], [0, 1, 0.7, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Defs>
            <RadialGradient id={`glow${seed}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <Stop offset="0.35" stopColor={color} stopOpacity="0.6" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={sq / 2} cy={sq * 0.82} rx={sq * 0.34} ry={sq * 0.11} fill="#0b0806" opacity={0.55} />
          <Circle cx={sq / 2} cy={sq * 0.8} r={sq * 0.32} fill={`url(#glow${seed})`} />
        </Svg>
      </Animated.View>
      {/* clarão branco na casa */}
      <Animated.View style={[fill, { backgroundColor: '#ffffff', opacity: lerp(p, [0.035, 0.05, 0.16, 0.29, 0.31, 0.4], [0, 1, 0, 0, 0.7, 0]) }]} />
      {/* raio guia (fraquinho, antes do principal) */}
      <Animated.View style={{ position: 'absolute', left: 0, top, opacity: lerp(p, [0, 0.01, 0.02, 0.03, 0.04], [0, 0.6, 0.15, 0.7, 0]) }}>
        <Svg width={w} height={h}>
          <Path d={leader} stroke="#dfe6ff" strokeWidth={Math.max(1, sq * 0.025)} strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
      {/* raio principal com galhos */}
      <Animated.View style={{ position: 'absolute', left: 0, top, opacity: lerp(p, flick, flickV) }}>
        <Svg width={w} height={h}>
          {bolt(fork1, 0.55)}
          {bolt(fork2, 0.45)}
          {bolt(main, 1)}
        </Svg>
      </Animated.View>
      {/* faíscas com gravidade */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
        const a = Math.PI + (k / 7) * Math.PI + (rand(seed + k) - 0.5) * 0.4; // para cima, em leque
        const d = Math.max(2, sq * 0.05);
        const dist = sq * (0.45 + rand(seed * 3 + k) * 0.35);
        return (
          <Animated.View
            key={k}
            style={{
              position: 'absolute', left: sq / 2 - d / 2, top: sq * 0.78, width: d, height: d * 2.4, borderRadius: d,
              backgroundColor: k % 2 ? '#ffffff' : color,
              opacity: lerp(p, [0.05, 0.07, 0.45, 0.55], [0, 1, 0.8, 0]),
              transform: [
                { translateX: lerp(p, [0.05, 0.55], [0, Math.cos(a) * dist]) },
                { translateY: lerp(p, [0.05, 0.2, 0.55], [0, Math.sin(a) * dist * 0.8, sq * 0.15]) },
                { rotate: `${(a * 180) / Math.PI + 90}deg` },
              ],
            }}
          />
        );
      })}
      {/* anel de energia em volta da peça */}
      <Animated.View
        style={{
          position: 'absolute', left: sq * 0.1, top: sq * 0.1, width: sq * 0.8, height: sq * 0.8, borderRadius: sq,
          borderWidth: Math.max(1.5, sq * 0.04), borderColor: color,
          opacity: lerp(p, [0.12, 0.2, 0.5, 0.62, 0.9], [0, 0.9, 0.5, 0.8, 0]),
          transform: [{ scale: lerp(p, [0.12, 0.9], [0.55, 1.3]) }],
        }}
      />
      {/* a peça surge eletrizada */}
      <Animated.View
        style={[
          fill,
          styles.center,
          {
            opacity: lerp(p, [0.045, 0.06, 0.1, 0.12, 0.14], [0, 1, 0.55, 1, 1]),
            transform: [
              { scale: lerp(p, [0.045, 0.14, 0.26, 0.36], [1.45, 0.86, 1.07, 1]) },
              { translateX: lerp(p, [0.3, 0.31, 0.32, 0.33, 0.34], [0, sq * 0.03, -sq * 0.03, sq * 0.02, 0]) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
      {/* arcos elétricos correndo em volta da peça */}
      <Animated.View style={[fill, { opacity: lerp(p, arcSteps, [0, 1, 0, 0.9, 0.2, 1, 0, 0.8, 0.1, 0.7, 0, 0.5, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Path d={arc1} stroke={color} strokeWidth={Math.max(2, sq * 0.05)} strokeLinejoin="round" fill="none" opacity={0.6} />
          <Path d={arc1} stroke="#ffffff" strokeWidth={Math.max(1, sq * 0.02)} strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[fill, { opacity: lerp(p, arcSteps, [0, 0, 1, 0.1, 1, 0, 0.9, 0.2, 0.8, 0, 0.6, 0, 0]) }]}>
        <Svg width={sq} height={sq}>
          <Path d={arc2} stroke={color} strokeWidth={Math.max(2, sq * 0.05)} strokeLinejoin="round" fill="none" opacity={0.6} />
          <Path d={arc2} stroke="#ffffff" strokeWidth={Math.max(1, sq * 0.02)} strokeLinejoin="round" fill="none" />
        </Svg>
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

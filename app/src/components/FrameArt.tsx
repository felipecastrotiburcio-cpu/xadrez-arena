import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { BoardStyle } from '../lib/types';
import { tint } from './ChessPiece';

/**
 * Bordas temáticas do tabuleiro (desenho vetorial). Cada tabuleiro tem a moldura
 * no estilo dele: madeira com veios, ondas do mar, gelo com neve, listras de doce,
 * rocha com lava, céu estrelado, neon, ornamentos de ouro, rebites ou a muralha de
 * castelo com torres. O tabuleiro é desenhado por cima do miolo.
 */
export type FrameStyle = NonNullable<BoardStyle['frameStyle']>;

const rand = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Faixa da moldura: quadrado externo menos o interno. */
const bandPath = (S: number, f: number, o = 0) =>
  `M${o} ${o}H${S - o}V${S - o}H${o}Z M${f} ${f}V${S - f}H${S - f}V${f}Z`;

/** Linha que acompanha os 4 lados a uma distância `d` da borda externa (ondulada se amp > 0). */
function loopLine(S: number, d: number, amp = 0, freq = 0.08, phase = 0) {
  const pts: string[] = [];
  const step = 4;
  const L = S - 2 * d;
  const push = (x: number, y: number) => pts.push(`${pts.length ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  for (let t = 0; t <= L; t += step) push(d + t, d + Math.sin(t * freq + phase) * amp);
  for (let t = 0; t <= L; t += step) push(S - d - Math.sin(t * freq + phase + 1) * amp, d + t);
  for (let t = 0; t <= L; t += step) push(S - d - t, S - d - Math.sin(t * freq + phase + 2) * amp);
  for (let t = 0; t <= L; t += step) push(d + Math.sin(t * freq + phase + 3) * amp, S - d - t);
  return pts.join('') + 'Z';
}

/** Pontos ao longo do centro da faixa (n por lado, sem os cantos). */
function alongBand(S: number, f: number, n: number) {
  const out: [number, number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const t = f + ((S - 2 * f) * i) / (n + 1);
    out.push([t, f / 2, 0], [t, S - f / 2, 2], [f / 2, t, 3], [S - f / 2, t, 1]);
  }
  return out;
}

const corners = (S: number, f: number): [number, number][] => [
  [f / 2, f / 2],
  [S - f / 2, f / 2],
  [f / 2, S - f / 2],
  [S - f / 2, S - f / 2],
];

function art(kind: FrameStyle, s: BoardStyle, S: number, f: number): ReactNode {
  const b = s.border;
  const band = (fill = b) => <Path d={bandPath(S, f)} fill={fill} fillRule="evenodd" />;
  const inner = (color: string, w = 1, inset = f - 0.8) => (
    <Rect x={inset} y={inset} width={S - 2 * inset} height={S - 2 * inset} fill="none" stroke={color} strokeWidth={w} />
  );
  switch (kind) {
    case 'wood': {
      return (
        <>
          {band()}
          {[0.22, 0.45, 0.7].map((k, i) => (
            <Path key={i} d={loopLine(S, f * k, 0.7, 0.05 + i * 0.02, i * 2)} fill="none" stroke={tint(b, -0.35)} strokeOpacity={0.55} strokeWidth={0.8} />
          ))}
          {/* cantos em meia-esquadria */}
          <Path d={`M0 0L${f} ${f}M${S} 0L${S - f} ${f}M0 ${S}L${f} ${S - f}M${S} ${S}L${S - f} ${S - f}`} stroke={tint(b, -0.5)} strokeWidth={1.2} />
          <Rect x={0.6} y={0.6} width={S - 1.2} height={S - 1.2} fill="none" stroke={tint(b, 0.3)} strokeWidth={1.2} rx={4} />
          {inner(tint(b, -0.55), 1.4)}
        </>
      );
    }
    case 'line':
      return (
        <>
          {band()}
          {inner(tint(b, 0.45), 1, f * 0.38)}
        </>
      );
    case 'ornate': {
      const gold = '#f5d27a';
      const d = f * 0.75;
      return (
        <>
          {band()}
          {inner(gold, 1.5, f * 0.36)}
          {inner(tint(gold, -0.3), 1, f - 1)}
          {[...corners(S, f), ...alongBand(S, f, 1).map(([x, y]) => [x, y] as [number, number])].map(([x, y], i) => {
            const k = i < 4 ? d : d * 0.65;
            return <Path key={i} d={`M${x} ${y - k}L${x + k} ${y}L${x} ${y + k}L${x - k} ${y}Z`} fill={gold} stroke="#8a6508" strokeWidth={0.8} />;
          })}
          {alongBand(S, f, 6).map(([x, y], i) => (
            <Circle key={`d${i}`} cx={x} cy={y} r={Math.max(0.8, f * 0.09)} fill={gold} />
          ))}
        </>
      );
    }
    case 'rivets':
      return (
        <>
          {band()}
          {[...alongBand(S, f, 7), ...corners(S, f).map(([x, y]) => [x, y, 0] as [number, number, number])].map(([x, y], i) => (
            <G key={i}>
              <Circle cx={x} cy={y} r={f * 0.22} fill={tint(b, 0.45)} stroke={tint(b, -0.5)} strokeWidth={0.8} />
              <Circle cx={x - f * 0.06} cy={y - f * 0.06} r={f * 0.07} fill="#ffffff" fillOpacity={0.6} />
            </G>
          ))}
          {inner(tint(b, -0.5), 1.2)}
        </>
      );
    case 'neon':
      return (
        <>
          {band()}
          <Rect x={1.5} y={1.5} width={S - 3} height={S - 3} rx={6} fill="none" stroke={s.coord.dark} strokeOpacity={0.35} strokeWidth={4} />
          <Rect x={1.5} y={1.5} width={S - 3} height={S - 3} rx={6} fill="none" stroke={s.coord.dark} strokeWidth={1.4} />
          {inner(s.coord.light, 5, f - 2.5)}
          <Rect x={f - 2.5} y={f - 2.5} width={S - 2 * (f - 2.5)} height={S - 2 * (f - 2.5)} fill="none" stroke={s.coord.light} strokeOpacity={0.4} strokeWidth={5} />
          {inner(s.coord.light, 1.6, f - 2.5)}
        </>
      );
    case 'waves':
      return (
        <>
          {band()}
          <Path d={loopLine(S, f * 0.3, f * 0.12, 0.18)} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.2} />
          <Path d={loopLine(S, f * 0.65, f * 0.1, 0.18, 1.6)} fill="none" stroke="#9fe3ff" strokeOpacity={0.4} strokeWidth={1} />
          {alongBand(S, f, 5).map(([x, y], i) => (
            <Circle key={i} cx={x + (rand(i) - 0.5) * f} cy={y + (rand(i + 9) - 0.5) * f * 0.4} r={Math.max(0.8, f * (0.06 + rand(i * 3) * 0.06))} fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.7} />
          ))}
          {inner('#ffffff', 0.8)}
        </>
      );
    case 'frost': {
      // neve acumulada na borda externa e flocos de neve na faixa
      const blobs: ReactNode[] = [];
      let k = 0;
      for (let t = 0; t < S; t += f * 0.7) {
        const r = f * (0.22 + rand(k++) * 0.16);
        blobs.push(<Circle key={`t${k}`} cx={t} cy={0} r={r} fill="#ffffff" />, <Circle key={`l${k}`} cx={0} cy={t} r={r * 0.8} fill="#ffffff" />);
        blobs.push(<Circle key={`r${k}`} cx={S} cy={t} r={r * 0.8} fill="#ffffff" />, <Circle key={`b${k}`} cx={t} cy={S} r={r * 0.6} fill="#ffffff" />);
      }
      const flake = (x: number, y: number, r: number, key: string) => (
        <Path
          key={key}
          d={[0, 1, 2].map((a) => {
            const ang = (a * Math.PI) / 3;
            return `M${x - Math.cos(ang) * r} ${y - Math.sin(ang) * r}L${x + Math.cos(ang) * r} ${y + Math.sin(ang) * r}`;
          }).join('')}
          stroke="#ffffff"
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      );
      return (
        <>
          {band()}
          {blobs}
          {alongBand(S, f, 4).map(([x, y], i) => flake(x, y, f * 0.26, `f${i}`))}
          {corners(S, f).map(([x, y], i) => flake(x, y, f * 0.3, `c${i}`))}
          {inner('#ffffff', 1.2)}
        </>
      );
    }
    case 'candy': {
      const w = Math.max(5, f * 0.9);
      const stripes: string[] = [];
      for (let t = -S; t < S * 2; t += w * 2) stripes.push(`M${t} 0L${t + w} 0L${t + w - S} ${S}L${t - S} ${S}Z`);
      return (
        <>
          {band()}
          <Path d={stripes.join('')} fill="#ffffff" fillOpacity={0.85} />
          <Rect x={0.8} y={0.8} width={S - 1.6} height={S - 1.6} rx={8} fill="none" stroke={tint(b, -0.3)} strokeWidth={1.6} />
          {inner(tint(b, -0.3), 1.6)}
        </>
      );
    }
    case 'lava': {
      const rock = '#24130f';
      const cracks = [0, 1, 2].map((k) => loopLine(S, f * (0.3 + k * 0.2), f * 0.14, 0.31 + k * 0.07, k * 2.1));
      return (
        <>
          {band(rock)}
          {cracks.map((d, i) => (
            <G key={i}>
              <Path d={d} fill="none" stroke={b} strokeOpacity={0.3} strokeWidth={3.5} strokeDasharray={`${12 + i * 5} ${9 + i * 4}`} />
              <Path d={d} fill="none" stroke="#ffb347" strokeWidth={1.1} strokeDasharray={`${12 + i * 5} ${9 + i * 4}`} />
            </G>
          ))}
          {alongBand(S, f, 6).map(([x, y], i) => (
            <Circle key={i} cx={x + (rand(i) - 0.5) * f} cy={y + (rand(i + 3) - 0.5) * f * 0.5} r={Math.max(0.7, f * 0.07)} fill="#ffd27a" />
          ))}
          {inner(b, 1.6)}
        </>
      );
    }
    case 'stars': {
      const sky = '#0d0a26';
      return (
        <>
          {band(sky)}
          {alongBand(S, f, 9).map(([x, y], i) => (
            <Circle key={i} cx={x + (rand(i) - 0.5) * f * 1.2} cy={y + (rand(i + 7) - 0.5) * f * 0.7} r={Math.max(0.5, f * (0.03 + rand(i * 5) * 0.06))} fill="#ffffff" fillOpacity={0.5 + rand(i * 2) * 0.5} />
          ))}
          {corners(S, f).map(([x, y], i) =>
            i === 1 ? (
              // planeta com anel
              <G key={i}>
                <Circle cx={x} cy={y} r={f * 0.3} fill="#ffb86b" />
                <Path d={`M${x - f * 0.5} ${y + f * 0.1}Q${x} ${y - f * 0.25} ${x + f * 0.5} ${y - f * 0.1}`} stroke="#ffe0b8" strokeWidth={1} fill="none" />
              </G>
            ) : (
              <Path key={i} d={`M${x} ${y - f * 0.35}L${x + f * 0.08} ${y - f * 0.08}L${x + f * 0.35} ${y}L${x + f * 0.08} ${y + f * 0.08}L${x} ${y + f * 0.35}L${x - f * 0.08} ${y + f * 0.08}L${x - f * 0.35} ${y}L${x - f * 0.08} ${y - f * 0.08}Z`} fill="#fff6c9" />
            ),
          )}
          <Rect x={1} y={1} width={S - 2} height={S - 2} rx={6} fill="none" stroke={b} strokeWidth={1.4} />
          {inner(b, 1.4)}
        </>
      );
    }
    case 'castle':
      return castle(s, S, f);
    default:
      return band();
  }
}

/**
 * Muralha de castelo vista de cima: ameias na borda externa, pedras em fiadas,
 * torres redondas com telhado cônico e bandeiras nos cantos e uma ponte levadiça.
 */
function castle(s: BoardStyle, S: number, f: number): ReactNode {
  const stone = s.border;
  const m = f * 0.3; // altura das ameias
  const u = f * 0.55; // largura de cada ameia
  // Ameias: blocos alternados na faixa externa (de 0 a m).
  const merlons: string[] = [];
  for (let t = f; t < S - f - u * 0.5; t += u * 2) {
    const w = Math.min(u, S - f - t);
    merlons.push(`M${t} 0h${w}v${m}h${-w}Z`, `M${t} ${S - m}h${w}v${m}h${-w}Z`, `M0 ${t}h${m}v${w}h${-m}Z`, `M${S - m} ${t}h${m}v${w}h${-m}Z`);
  }
  // Pedras: fiadas paralelas ao lado e juntas desencontradas.
  const joints: string[] = [];
  const rows = 2;
  for (let r = 0; r < rows; r++) {
    const d = m + ((f - m) * (r + 1)) / (rows + 1);
    joints.push(`M${m} ${d}H${S - m}`, `M${m} ${S - d}H${S - m}`, `M${d} ${m}V${S - m}`, `M${S - d} ${m}V${S - m}`);
  }
  const brick = f * 0.9;
  for (let t = f, k = 0; t < S - f; t += brick, k++) {
    const off = (k % 2) * brick * 0.5;
    for (let r = 0; r <= rows; r++) {
      const a = m + ((f - m) * r) / (rows + 1);
      const c = m + ((f - m) * (r + 1)) / (rows + 1);
      const x = t + (r % 2 ? off : 0);
      if (x > S - f) continue;
      joints.push(`M${x} ${a}V${c}`, `M${x} ${S - c}V${S - a}`, `M${a} ${x}H${c}`, `M${S - c} ${x}H${S - a}`);
    }
  }
  const dark = tint(stone, -0.45);
  const R = f * 0.5;
  const roof = '#a8322d';
  const flags = ['#2f6fdb', '#c62828', '#c62828', '#2f6fdb'];
  const gw = f * 1.6;
  return (
    <>
      <Path d={bandPath(S, f, m)} fill={stone} fillRule="evenodd" />
      <Path d={merlons.join('')} fill={tint(stone, 0.12)} stroke={dark} strokeWidth={0.7} />
      <Path d={joints.join('')} stroke={dark} strokeOpacity={0.55} strokeWidth={0.6} />
      {/* caminho de ronda junto ao tabuleiro */}
      <Rect x={f - 1.2} y={f - 1.2} width={S - 2 * (f - 1.2)} height={S - 2 * (f - 1.2)} fill="none" stroke={dark} strokeWidth={1.6} />
      <Rect x={m} y={m} width={S - 2 * m} height={S - 2 * m} fill="none" stroke={tint(stone, 0.25)} strokeWidth={0.8} />
      {/* ponte levadiça (embaixo) e portão (em cima) */}
      {[S - f, 0].map((y, i) => (
        <G key={i}>
          <Rect x={S / 2 - gw / 2} y={y} width={gw} height={f} fill={i ? '#3b2a1c' : '#7a5230'} stroke={dark} strokeWidth={0.8} />
          <Path
            d={[0.25, 0.5, 0.75].map((k) => `M${S / 2 - gw / 2 + gw * k} ${y}V${y + f}`).join('')}
            stroke={i ? '#1c120a' : '#4a3018'}
            strokeWidth={0.8}
          />
        </G>
      ))}
      {/* torres nos cantos */}
      {corners(S, f).map(([x, y], i) => (
        <G key={`t${i}`}>
          <Circle cx={x} cy={y} r={R} fill={tint(stone, 0.08)} stroke={dark} strokeWidth={1} />
          <Circle cx={x} cy={y} r={R * 0.82} fill="none" stroke={tint(stone, 0.3)} strokeWidth={R * 0.28} strokeDasharray={`${R * 0.42} ${R * 0.3}`} />
          <Circle cx={x} cy={y} r={R * 0.58} fill={roof} stroke={tint(roof, -0.4)} strokeWidth={0.8} />
          <Path
            d={[0, 1, 2, 3].map((a) => `M${x} ${y}L${x + Math.cos((a * Math.PI) / 2 + 0.78) * R * 0.58} ${y + Math.sin((a * Math.PI) / 2 + 0.78) * R * 0.58}`).join('')}
            stroke={tint(roof, -0.45)}
            strokeWidth={0.7}
          />
          <Path d={`M${x} ${y}L${x} ${y - R * 0.95}`} stroke="#3a2a1a" strokeWidth={0.9} />
          <Path d={`M${x} ${y - R * 0.95}L${x + R * 0.6} ${y - R * 0.78}L${x} ${y - R * 0.6}Z`} fill={flags[i]} />
        </G>
      ))}
    </>
  );
}

function FrameArtBase({ style, size }: { style: BoardStyle; size: number }) {
  const f = style.frame;
  const kind: FrameStyle = style.frameStyle ?? 'plain';
  if (f < 3 || kind === 'plain') return null;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      {art(kind, style, size, f)}
    </Svg>
  );
}

export const FrameArt = memo(FrameArtBase);

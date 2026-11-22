// Gera os sons dos SURGIMENTOS das peças (loja → Surgimento), um por efeito.
// Síntese 100% original, em estéreo 44,1 kHz, exportada em MP3 de 192 kbps (precisa do ffmpeg).
//
// Cada som acompanha a animação de verdade: o script recalcula quando cada uma das 32 peças da
// posição inicial aparece (mesma conta de `spots()` em src/components/PieceEntrance.tsx) e põe o
// evento sonoro daquela peça no instante certo, do lado certo (coluna a = esquerda, h = direita).
//
// Uso: node scripts/gen-entrance-sounds.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 44100;
const TAU = Math.PI * 2;
let seed = 20261121;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1; // -1..1
const rnd01 = () => (rnd() + 1) / 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ------------------------------------------------------------------ tempo de cada peça (igual ao app)

/** Mesmos números de PieceEntrance.tsx. */
const PIECE_MS = { pop: 520, ground: 900, rain: 850, glitch: 800, pixel: 950, teleport: 1000, blackhole: 1100, hero: 1050, lightning: 1100 };
const appRand = (n) => {
  const x = Math.sin(n * 91.345) * 47453.5453;
  return x - Math.floor(x);
};
/** As 32 peças da posição inicial: { f (coluna 0-7), r (fileira), wave, delay (s), pan }. */
const PIECES = [];
for (const r of [1, 2, 7, 8]) {
  for (let f = 0; f < 8; f++) {
    const wave = r === 1 ? 0 : r === 2 ? 1 : r === 8 ? 0.5 : 1.5;
    const delay = (wave * 260 + f * 45 + appRand(f * 8 + r) * 110) / 1000;
    PIECES.push({ f, r, wave, delay, pan: ((f - 3.5) / 3.5) * 0.75 });
  }
}
PIECES.sort((a, b) => a.delay - b.delay);
const WAVES = [0, 0.5, 1, 1.5].map((w) => {
  const ps = PIECES.filter((p) => p.wave === w);
  return { wave: w, start: Math.min(...ps.map((p) => p.delay)), mid: ps.reduce((a, p) => a + p.delay, 0) / ps.length };
});

// ------------------------------------------------------------------ DSP

function track(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n) };
}

/** Escreve uma voz mono com pan (potência constante). fn(t, i) → amostra. */
function voice(tr, at, dur, fn, { pan = 0, gain = 1 } = {}) {
  const s = Math.max(0, Math.floor(at * SR));
  const n = Math.floor(dur * SR);
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2;
  const gr = Math.sin(a) * gain * Math.SQRT2;
  for (let i = 0; i < n && s + i < tr.L.length; i++) {
    const v = fn(i / SR, i);
    tr.L[s + i] += v * gl;
    tr.R[s + i] += v * gr;
  }
}

/** Voz com pan que muda no tempo: fn(t) → [amostra, pan]. */
function voicePan(tr, at, dur, fn, gain = 1) {
  const s = Math.max(0, Math.floor(at * SR));
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n && s + i < tr.L.length; i++) {
    const [v, pan] = fn(i / SR, i);
    const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
    tr.L[s + i] += v * Math.cos(a) * gain * Math.SQRT2;
    tr.R[s + i] += v * Math.sin(a) * gain * Math.SQRT2;
  }
}

/** Filtro de estado variável (TPT), com corte que pode mudar a cada amostra. */
function svf() {
  let ic1 = 0, ic2 = 0;
  return (x, fc, q = 0.707) => {
    const g = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
  };
}

/** Ruído rosa (Paul Kellet) e marrom. */
function pink() {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = rnd();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    return o * 0.11;
  };
}
function brown() {
  let y = 0;
  return () => (y = (y + rnd() * 0.02) * 0.998) * 3.5;
}

/** Oscilador com fase acumulada (frequência pode variar). */
function osc(shape = 'sin') {
  let ph = 0;
  return (f, duty = 0.5) => {
    ph = (ph + f / SR) % 1;
    if (shape === 'sin') return Math.sin(TAU * ph);
    if (shape === 'saw') return ph * 2 - 1;
    if (shape === 'sq') return ph < duty ? 1 : -1;
    return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph; // triângulo
  };
}

const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);

/** Reverb estéreo estilo Freeverb (8 pentes + 4 passa-tudo por canal). */
function reverb(tr, { mix = 0.2, size = 0.8, damp = 0.4, pre = 0.012 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const fb = size * 0.28 + 0.7;
  const mk = (spread) => {
    const cs = combs.map((n) => ({ buf: new Float32Array(n + spread), p: 0, lp: 0 }));
    const as = alls.map((n) => ({ buf: new Float32Array(n + spread), p: 0 }));
    return (x) => {
      let out = 0;
      for (const c of cs) {
        const y = c.buf[c.p];
        c.lp = y * (1 - damp) + c.lp * damp;
        c.buf[c.p] = x + c.lp * fb;
        c.p = (c.p + 1) % c.buf.length;
        out += y;
      }
      for (const a of as) {
        const b = a.buf[a.p];
        const y = -out + b;
        a.buf[a.p] = out + b * 0.5;
        a.p = (a.p + 1) % a.buf.length;
        out = y;
      }
      return out;
    };
  };
  const rl = mk(0), rr = mk(23);
  const d = Math.floor(pre * SR);
  const n = tr.L.length;
  const wl = new Float32Array(n), wr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i >= d ? tr.L[i - d] + tr.R[i - d] : 0) * 0.5) * 0.015;
    wl[i] = rl(x);
    wr[i] = rr(x);
  }
  for (let i = 0; i < n; i++) {
    tr.L[i] += wl[i] * mix * 3;
    tr.R[i] += wr[i] * mix * 3;
  }
}

/** Master: corta subgrave inútil, compressor suave, limitador e normalização a -1 dBFS. */
function master(tr, { drive = 1.2, hp = 28 } = {}) {
  const fl = svf(), fr = svf();
  let envl = 0;
  const att = Math.exp(-1 / (0.003 * SR)), rel = Math.exp(-1 / (0.12 * SR));
  const n = tr.L.length;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(tr.L[i]), Math.abs(tr.R[i]));
  const pre = 1 / (peak || 1);
  for (let i = 0; i < n; i++) {
    let l = fl(tr.L[i] * pre, hp).hp;
    let r = fr(tr.R[i] * pre, hp).hp;
    const lvl = Math.max(Math.abs(l), Math.abs(r));
    envl = lvl > envl ? att * envl + (1 - att) * lvl : rel * envl + (1 - rel) * lvl;
    // compressão 3:1 acima de -12 dB
    const th = 0.25;
    const gr = envl > th ? (th + (envl - th) / 3) / envl : 1;
    l = Math.tanh(l * gr * drive * 1.6);
    r = Math.tanh(r * gr * drive * 1.6);
    tr.L[i] = l;
    tr.R[i] = r;
  }
}

function writeMp3(name, tr, { peak = 0.89 } = {}) {
  let max = 0;
  for (let i = 0; i < tr.L.length; i++) max = Math.max(max, Math.abs(tr.L[i]), Math.abs(tr.R[i]));
  const k = peak / (max || 1);
  // corta o silêncio do fim (abaixo de -66 dB) e faz um fade curto
  let end = tr.L.length;
  while (end > 1 && Math.abs(tr.L[end - 1] * k) < 0.0005 && Math.abs(tr.R[end - 1] * k) < 0.0005) end--;
  // fade longo (até 0,6 s) para nenhuma cauda ser cortada de repente
  const fade = Math.min(Math.floor(SR * 0.6), Math.floor(end * 0.25));
  const buf = Buffer.alloc(44 + end * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + end * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(end * 4, 40);
  for (let i = 0; i < end; i++) {
    const g = i > end - fade ? ((end - i) / fade) ** 2 : 1;
    // dither triangular para não ter chiado de quantização na cauda
    const dl = (rnd01() - rnd01()) / 32768, dr = (rnd01() - rnd01()) / 32768;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tr.L[i] * k * g + dl)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tr.R[i] * k * g + dr)) * 32767), 46 + i * 4);
  }
  const dir = mkdtempSync(join(tmpdir(), 'entr-'));
  const wav = join(dir, `${name}.wav`);
  writeFileSync(wav, buf);
  const out = new URL(`../assets/sounds/${name}.mp3`, import.meta.url).pathname;
  // Volume igual em todos: mede a sonoridade (EBU R128) e ajusta para -14 LUFS.
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString();
  const lufs = Number([...meas.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1] ?? -14);
  const gainDb = Math.min(0, -14 - lufs).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', `volume=${gainDb}dB`, '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', out]);
  rmSync(dir, { recursive: true, force: true });
  console.log(name.padEnd(20), (end / SR).toFixed(2) + 's');
}

/** Instante (s) em que a peça chega na fração `frac` do próprio efeito. */
const at = (p, effect, frac) => p.delay + (PIECE_MS[effect] / 1000) * frac;

// ------------------------------------------------------------------ peças de som reutilizáveis

/** Batida de madeira (peça tocando o tabuleiro). */
function knock(tr, t0, { pan = 0, gain = 1, pitch = 1, bright = 1 } = {}) {
  const modes = [[182, 0.07, 0.6], [297, 0.045, 0.4], [468, 0.035, 0.8], [731, 0.025, 0.55], [1123, 0.016, 0.4 * bright], [1688, 0.01, 0.3 * bright]];
  const f = svf();
  voice(tr, t0, 0.28, (t) => {
    let v = f(rnd(), 3200 * pitch, 1.1).bp * Math.exp(-t / 0.0025) * 1.6 * bright;
    modes.forEach(([fr, d, a], k) => {
      const ff = fr * pitch * (k === 0 ? 1 + 0.06 * Math.exp(-t / 0.01) : 1);
      v += a * Math.sin(TAU * ff * t) * Math.exp(-t / d);
    });
    return v * Math.min(1, t / 0.0006);
  }, { pan, gain });
}

/** Sino/vidro: parciais com decaimento próprio. */
function bell(tr, t0, f, { pan = 0, gain = 1, decay = 0.4, partials = [[1, 1], [2.01, 0.4], [3.03, 0.18], [4.2, 0.08], [5.43, 0.05]] } = {}) {
  voice(tr, t0, decay * 5, (t) => {
    let v = 0;
    for (const [m, a] of partials) v += a * Math.sin(TAU * f * m * t) * Math.exp((-t * m ** 0.7) / decay);
    return v * Math.min(1, t / 0.002);
  }, { pan, gain });
}

/** Grave com queda de afinação (bumbo/impacto). */
function thump(tr, t0, { pan = 0, gain = 1, f0 = 140, f1 = 45, fall = 0.04, decay = 0.25, dist = 1.5 } = {}) {
  const o = osc();
  voice(tr, t0, decay * 5, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / fall);
    return Math.tanh(o(f) * dist) * env(t, 0.001, decay);
  }, { pan, gain });
}

/** Ruído filtrado com envelope e corte que podem variar no tempo. */
function noiseSweep(tr, t0, dur, { pan = 0, gain = 1, from = 500, to = 3000, q = 1.2, mode = 'bp', shape = (x) => Math.sin(Math.PI * x), src = null, curve = 'exp' } = {}) {
  const f = svf();
  const n = src ?? rnd;
  voice(tr, t0, dur, (t) => {
    const x = t / dur;
    const fc = curve === 'exp' ? from * (to / from) ** x : from + (to - from) * x;
    return f(n(), fc, q)[mode] * shape(x);
  }, { pan, gain });
}

/** Grãos de cascalho/terra: muitos estalinhos curtos. */
function gravel(tr, t0, dur, { pan = 0, gain = 1, count = 14, lo = 1800, hi = 5500 } = {}) {
  for (let k = 0; k < count; k++) {
    const st = t0 + rnd01() ** 1.6 * dur;
    const f = svf();
    const fc = lo + rnd01() * (hi - lo);
    const g = (0.3 + rnd01() * 0.7) * (1 - (st - t0) / dur) ** 0.5;
    voice(tr, st, 0.03, (t) => f(rnd(), fc, 2.5).bp * Math.exp(-t / 0.004), { pan: pan + rnd() * 0.2, gain: gain * g });
  }
}

// ================================================================== 1. POP (grátis)
// Bolhas que estouram afinadas: cada fileira sobe numa escala pentatônica, como um glissando alegre.
{
  const tr = track(2.6);
  const penta = [0, 2, 4, 7, 9, 12, 14, 16];
  const base = { 0: 72, 0.5: 76, 1: 79, 1.5: 84 };
  for (const p of PIECES) {
    const t0 = at(p, 'pop', 0.03);
    const f0 = hz(base[p.wave] + penta[p.f]);
    const o = osc();
    voice(tr, t0, 0.16, (t) => {
      // bolha: frequência sobe rápido (o "plop" de bolha estourando)
      const f = f0 * (0.55 + 0.55 * (1 - Math.exp(-t / 0.018)));
      return o(f) * env(t, 0.0015, 0.045);
    }, { pan: p.pan, gain: 0.42 });
    // estalinho do estouro
    noiseSweep(tr, t0 + 0.002, 0.012, { pan: p.pan, gain: 0.12, from: 5000, to: 7000, mode: 'hp', shape: (x) => Math.exp(-x * 6) });
    // quiquinho (escala 1.22 → 0.92 → 1): um "bip" macio uma oitava acima
    bell(tr, at(p, 'pop', 0.55), f0 * 2, { pan: p.pan, gain: 0.05, decay: 0.08, partials: [[1, 1], [2, 0.2]] });
  }
  // brilho final
  [96, 100, 103, 108].forEach((m, i) => bell(tr, 1.18 + i * 0.045, hz(m), { pan: -0.4 + i * 0.27, gain: 0.07, decay: 0.25 }));
  reverb(tr, { mix: 0.16, size: 0.6, damp: 0.5 });
  master(tr, { drive: 1 });
  writeMp3('entrance_pop', tr);
}

// ================================================================== 2. BROTA DO CHÃO
// Tremor grave contínuo, rachaduras secas, pedra raspando enquanto a peça sobe, terra espirrando e
// a batida de madeira quando ela assenta.
{
  const tr = track(3);
  const br = brown();
  const lp = svf();
  const sub = osc();
  voice(tr, 0, 2.3, (t) => {
    const e = Math.min(1, t / 0.18) * (t > 1.6 ? Math.exp(-(t - 1.6) / 0.25) : 1);
    const trem = 0.65 + 0.35 * Math.sin(TAU * 9 * t + Math.sin(TAU * 1.3 * t) * 2);
    return (lp(br(), 110, 0.9).lp * 1.4 + sub(38 + 4 * Math.sin(TAU * 0.7 * t)) * 0.35) * e * trem;
  }, { gain: 0.55 });
  for (const p of PIECES) {
    // rachadura: estalos curtos e secos
    for (let k = 0; k < 5; k++) {
      const f = svf();
      const fc = 1200 + rnd01() * 2600;
      voice(tr, at(p, 'ground', 0.04) + k * (0.006 + rnd01() * 0.01), 0.04, (t) => f(rnd(), fc, 1.8).bp * Math.exp(-t / 0.006), { pan: p.pan, gain: 0.32 });
    }
    thump(tr, at(p, 'ground', 0.05), { pan: p.pan, gain: 0.18, f0: 110, f1: 55, decay: 0.07 });
    // pedra raspando enquanto sobe
    noiseSweep(tr, at(p, 'ground', 0.15), 0.42, { pan: p.pan, gain: 0.09, from: 300, to: 900, q: 2, src: brown(), shape: (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 60)) });
    // terra espirrando
    gravel(tr, at(p, 'ground', 0.27), 0.32, { pan: p.pan, gain: 0.16, count: 9 });
    // assenta no tabuleiro
    knock(tr, at(p, 'ground', 0.74), { pan: p.pan, gain: 0.34, pitch: 0.85 + rnd01() * 0.2 });
  }
  reverb(tr, { mix: 0.18, size: 0.7, damp: 0.6 });
  master(tr, { drive: 1.15 });
  writeMp3('entrance_ground', tr);
}

// ================================================================== 3. CHUVA DE PEÇAS
// Cada peça cai assobiando (efeito Doppler), bate de madeira, levanta poeira e dá um quique.
{
  const tr = track(2.8);
  // chuva fininha de fundo
  const hiss = svf();
  const pk = pink();
  voice(tr, 0, 2.0, (t) => hiss(pk(), 5200, 0.6).hp * Math.min(1, t / 0.25) * (t > 1.5 ? Math.exp(-(t - 1.5) / 0.2) : 1), { gain: 0.16 });
  for (let k = 0; k < 90; k++) {
    const st = rnd01() * 1.8;
    const f = svf();
    const fc = 2500 + rnd01() * 4000;
    voice(tr, st, 0.02, (t) => f(rnd(), fc, 4).bp * Math.exp(-t / 0.003), { pan: rnd() * 0.9, gain: 0.08 });
  }
  for (const p of PIECES) {
    const fall = (PIECE_MS.rain / 1000) * 0.55;
    const o = osc();
    const top = 1700 + rnd01() * 500;
    voice(tr, p.delay, fall, (t) => {
      const x = t / fall;
      return o(top * (1 - 0.45 * x * x)) * x ** 2.2;
    }, { pan: p.pan, gain: 0.05 });
    noiseSweep(tr, p.delay, fall, { pan: p.pan, gain: 0.1, from: 600, to: 3500, q: 1.5, shape: (x) => x ** 2.5 });
    const hit = at(p, 'rain', 0.55);
    knock(tr, hit, { pan: p.pan, gain: 0.5, pitch: 0.9 + rnd01() * 0.25, bright: 1.2 });
    // poeira
    noiseSweep(tr, hit + 0.004, 0.18, { pan: p.pan, gain: 0.12, from: 2500, to: 600, q: 0.7, mode: 'lp', shape: (x) => Math.exp(-x * 5) });
    // quique
    knock(tr, at(p, 'rain', 0.78), { pan: p.pan, gain: 0.16, pitch: 1.1, bright: 0.8 });
  }
  reverb(tr, { mix: 0.2, size: 0.75, damp: 0.45 });
  master(tr, { drive: 1.1 });
  writeMp3('entrance_rain', tr);
}

// ================================================================== 4. GLITCH
// Falhas digitais: rajadas bit-crush, ruído "sample & hold", zumbido elétrico cortando, e um
// clique limpo quando a peça trava no lugar.
{
  const tr = track(2.6);
  // zumbido de fundo, picotado
  const buzz = osc('saw');
  const blp = svf();
  let gate = 1;
  voice(tr, 0, 1.9, (t, i) => {
    if (i % 1400 === 0) gate = rnd01() < 0.7 ? 1 : 0.1;
    const e = Math.min(1, t / 0.05) * (t > 1.55 ? Math.exp(-(t - 1.55) / 0.1) : 1);
    return blp(buzz(60) + buzz(120) * 0.3, 420, 1.5).lp * gate * e;
  }, { gain: 0.09 });
  const steps = [0.04, 0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6];
  for (const p of PIECES) {
    for (const s of steps) {
      if (rnd01() < 0.35) continue;
      const dur = 0.012 + rnd01() * 0.03;
      const kind = rnd01();
      const pan = Math.max(-1, Math.min(1, p.pan + rnd() * 0.5));
      if (kind < 0.4) {
        // onda quadrada esmagada (bit-crush)
        const f = 200 + rnd01() * 2400;
        const o = osc('sq');
        const bits = 3 + Math.floor(rnd01() * 3);
        voice(tr, at(p, 'glitch', s), dur, (t) => Math.round(o(f) * 0.8 * bits) / bits * (t < dur - 0.002 ? 1 : 0), { pan, gain: 0.07 });
      } else if (kind < 0.75) {
        // ruído com retenção de amostra (som de dado corrompido)
        const hold = Math.floor(4 + rnd01() * 40);
        let v = 0;
        voice(tr, at(p, 'glitch', s), dur, (t, i) => {
          if (i % hold === 0) v = rnd();
          return v * (t < dur - 0.002 ? 1 : 0);
        }, { pan, gain: 0.06 });
      } else {
        // "gaguejo": tom curto repetido
        const f = hz(84 + Math.floor(rnd01() * 12));
        for (let r = 0; r < 3; r++) bell(tr, at(p, 'glitch', s) + r * 0.018, f, { pan, gain: 0.05, decay: 0.01, partials: [[1, 1]] });
      }
    }
    // trava no lugar: clique digital limpo + blip
    const lock = at(p, 'glitch', 0.72);
    noiseSweep(tr, lock, 0.006, { pan: p.pan, gain: 0.14, from: 6000, to: 6000, mode: 'hp', shape: () => 1 });
    bell(tr, lock, hz(93 + (p.f % 3) * 2), { pan: p.pan, gain: 0.05, decay: 0.03, partials: [[1, 1], [3, 0.3]] });
  }
  // desliga com um "zap" descendente
  const z = osc('sq');
  voice(tr, 1.72, 0.22, (t) => Math.round(z(1800 * Math.exp(-t / 0.05) + 60) * 3) / 3 * env(t, 0.002, 0.07), { gain: 0.1 });
  reverb(tr, { mix: 0.08, size: 0.5, damp: 0.3 });
  master(tr, { drive: 1.1 });
  writeMp3('entrance_glitch', tr);
}

// ================================================================== 5. PIXEL 8-BITS
// Chip de videogame: blocos caem com "blips" de onda quadrada, a peça monta com o clássico
// "power-up" e, no fim, uma mini-fanfarra.
{
  const tr = track(3);
  const SCALE = [0, 2, 4, 7, 9]; // pentatônica de Dó
  /** Nota "chip": onda quadrada com volume em 16 degraus, como nos consoles antigos. */
  const chip = (t0, midi, dur, { pan = 0, gain = 0.1, duty = 0.25, slide = 0 } = {}) => {
    const o = osc('sq');
    voice(tr, t0, dur, (t) => {
      const e = Math.round(15 * Math.min(1, (dur - t) / 0.01) * (0.6 + 0.4 * Math.exp(-t / 0.05))) / 15;
      return o(hz(midi + slide * (t / dur))) * e * 0.5;
    }, { pan, gain });
  };
  for (const p of PIECES) {
    const row = { 0: 60, 0.5: 64, 1: 67, 1.5: 72 }[p.wave];
    // 3 blocos caindo (dos 16 de cada peça)
    for (let k = 0; k < 3; k++) {
      const s = 0.08 + k * 0.17 + rnd01() * 0.06;
      chip(at(p, 'pixel', s + 0.15), row + 12 + SCALE[(p.f + k) % 5], 0.035, { pan: p.pan, gain: 0.05, duty: 0.125 });
    }
    // monta: power-up subindo uma quinta
    const n = row + 12 + SCALE[p.f % 5];
    chip(at(p, 'pixel', 0.7), n, 0.05, { pan: p.pan, gain: 0.08 });
    chip(at(p, 'pixel', 0.7) + 0.05, n + 7, 0.08, { pan: p.pan, gain: 0.08, slide: 0.3 });
  }
  // baixo de triângulo marcando o ritmo das ondas
  const tri = (t0, midi, dur) => {
    const o = osc('tri');
    voice(tr, t0, dur, (t) => Math.round(o(hz(midi)) * 8) / 8 * Math.min(1, (dur - t) / 0.01), { gain: 0.1 });
  };
  [[0, 36], [0.27, 43], [0.54, 45], [0.81, 41], [1.08, 43]].forEach(([t, m]) => tri(t, m, 0.22));
  // fanfarra final (Dó - Mi - Sol - Dó)
  const fin = 1.62;
  [72, 76, 79].forEach((m, i) => chip(fin + i * 0.07, m + 12, 0.065, { gain: 0.11, duty: 0.5 }));
  chip(fin + 0.21, 96, 0.3, { gain: 0.12, duty: 0.5 });
  tri(fin + 0.21, 48, 0.3);
  reverb(tr, { mix: 0.05, size: 0.4, damp: 0.5 });
  master(tr, { drive: 0.9 });
  writeMp3('entrance_pixel', tr);
}

// ================================================================== 6. TELETRANSPORTE QUÂNTICO (lendário)
// Ficção científica: um "riser" de sintetizador que vai abrindo, feixes descendo com "piu",
// materialização em grãos cristalinos que piscam, e um acorde de vidro quando tudo se completa.
{
  const tr = track(4.4);
  // riser: 3 serras desafinadas num filtro que abre, com tremolo rápido
  const saws = [48, 55, 60, 67].map((m) => [osc('saw'), osc('saw'), hz(m)]);
  const fl = svf(), fr = svf();
  for (let i = 0; i < Math.floor(1.95 * SR); i++) {
    const t = i / SR;
    const x = Math.min(1, t / 1.55);
    let s = 0;
    for (const [a, b, f] of saws) s += a(f * 1.004) + b(f * 0.996);
    const e = (x ** 1.5) * (t > 1.55 ? Math.exp(-(t - 1.55) / 0.12) : 1) * (0.75 + 0.25 * Math.sin(TAU * (6 + 14 * x) * t));
    const fc = 250 * (7000 / 250) ** x;
    tr.L[i] += fl(s, fc, 2.2).lp * e * 0.07;
    tr.R[i] += fr(s, fc * 1.07, 2.2).lp * e * 0.07;
  }
  for (const p of PIECES) {
    // feixe descendo: "piu" curto
    const o = osc();
    voice(tr, p.delay, 0.09, (t) => o(4200 * Math.exp(-t / 0.03) + 700) * env(t, 0.002, 0.03), { pan: p.pan, gain: 0.07 });
    // materializa: grãos cristalinos que piscam junto com a peça
    for (const s of [0.3, 0.38, 0.44, 0.5, 0.56]) {
      bell(tr, at(p, 'teleport', s), 2200 + rnd01() * 3800, { pan: p.pan + rnd() * 0.3, gain: 0.035, decay: 0.03, partials: [[1, 1], [2.76, 0.4]] });
    }
    // trava: "ziing" com modulação
    const m = osc();
    const c = osc();
    const f0 = hz(88 + [0, 4, 7, 11][Math.floor(p.wave * 2)]);
    voice(tr, at(p, 'teleport', 0.6), 0.25, (t) => c(f0 + m(f0 * 1.5) * f0 * 0.6 * Math.exp(-t / 0.05)) * env(t, 0.003, 0.07), { pan: p.pan, gain: 0.06 });
  }
  // acorde de vidro final + "whoomp"
  const fin = 1.72;
  [72, 76, 79, 83, 88].forEach((m, i) => bell(tr, fin + i * 0.012, hz(m + 12), { pan: -0.6 + i * 0.3, gain: 0.12, decay: 0.55 }));
  thump(tr, fin, { gain: 0.35, f0: 90, f1: 40, decay: 0.3, dist: 1 });
  noiseSweep(tr, fin - 0.25, 0.32, { gain: 0.12, from: 1500, to: 9000, q: 0.8, shape: (x) => x ** 3 });
  reverb(tr, { mix: 0.3, size: 0.8, damp: 0.3, pre: 0.02 });
  master(tr, { drive: 1.05 });
  writeMp3('entrance_teleport', tr);
}

// ================================================================== 7. BURACO NEGRO (lendário)
// Um grave que afunda girando de um lado para o outro cada vez mais rápido, vento sendo sugado,
// cada peça cuspida com um "fwoop" reverso, e uma implosão no fim.
{
  const tr = track(4.4);
  const sub = osc();
  const wind = svf();
  const pk = pink();
  let rot = 0;
  voicePan(tr, 0, 2.1, (t) => {
    const x = Math.min(1, t / 1.75);
    rot += (TAU * (0.4 + 5.5 * x * x)) / SR;
    const e = Math.min(1, t / 0.2) * (t > 1.75 ? Math.exp(-(t - 1.75) / 0.06) : 1);
    const drone = sub(58 - 24 * x + 2 * Math.sin(rot * 2)) * 0.7;
    const w = wind(pk(), 350 + 1400 * (0.5 + 0.5 * Math.sin(rot)) * (0.3 + x), 3).bp * 1.6;
    return [(drone + w) * e, Math.sin(rot) * 0.85];
  }, 0.5);
  for (const p of PIECES) {
    // sugada reversa até a peça ser cuspida
    const t0 = at(p, 'blackhole', 0.28);
    const t1 = at(p, 'blackhole', 0.72);
    noiseSweep(tr, t0, t1 - t0, { pan: p.pan, gain: 0.11, from: 250, to: 2600, q: 3, shape: (x) => x ** 3 });
    // cuspida: "fwoop" grave com vibrato de giro
    const o = osc();
    voice(tr, t1, 0.16, (t) => o((200 + 30 * Math.sin(TAU * 28 * t)) * Math.exp(-t / 0.05) + 60) * env(t, 0.002, 0.05), { pan: p.pan, gain: 0.22 });
    noiseSweep(tr, t1, 0.006, { pan: p.pan, gain: 0.08, from: 3000, to: 3000, mode: 'hp', shape: () => 1 });
  }
  // implosão: sobe ao contrário e explode para dentro
  const fin = 1.82;
  noiseSweep(tr, fin - 0.45, 0.45, { gain: 0.3, from: 120, to: 5000, q: 1.2, shape: (x) => x ** 4 });
  thump(tr, fin, { gain: 0.9, f0: 120, f1: 28, fall: 0.08, decay: 0.45, dist: 2.2 });
  const tail = svf();
  voice(tr, fin, 1.0, (t) => tail(rnd(), 900 * Math.exp(-t / 0.25) + 80, 0.8).lp * env(t, 0.002, 0.18), { gain: 0.35 });
  reverb(tr, { mix: 0.28, size: 0.8, damp: 0.55, pre: 0.03 });
  master(tr, { drive: 1.25 });
  writeMp3('entrance_blackhole', tr);
}

// ================================================================== 8. ATERRISSAGEM DE HERÓI (lendário)
// Trilha de filme de super-herói: um "braam" de metais cresce enquanto as peças despencam assobiando;
// cada peça bate com impacto seco (grave, estalo, pedras); cada fileira cai com um IMPACTO enorme e um
// acorde de metais (Dó – Lá♭ – Si♭ – Dó, a progressão épica), e no fim tímpanos rufam até a fanfarra.
{
  const tr = track(5.2);
  /** Metal sintético: serras desafinadas num filtro que abre e fecha (como trompas/trombones). */
  const brass = (t0, notes, dur, { gain = 0.1, open = 2400, attack = 0.04, pan = 0 } = {}) => {
    const oscs = notes.flatMap((m) => [[osc('saw'), hz(m) * 1.003], [osc('saw'), hz(m) * 0.997], [osc('sq'), hz(m) * 0.5]]);
    const f = svf();
    const vib = osc();
    voice(tr, t0, dur + 1.0, (t) => {
      let v = 0;
      const wob = 1 + 0.004 * vib(5.2) * Math.min(1, t / 0.3);
      for (const [o, fr] of oscs) v += o(fr * wob) * (fr < 100 ? 0.4 : 1);
      const e = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / 0.18) : 1);
      const fc = 300 + open * Math.min(1, t / (attack * 2)) * (0.65 + 0.35 * Math.exp(-t / 0.4));
      return f(v / oscs.length, fc, 1.1).lp * e;
    }, { gain, pan });
  };
  /** Tímpano: tom grave afinado com batida de pele. */
  const timp = (t0, midi, { gain = 0.5, pan = 0 } = {}) => {
    const o = osc();
    const o2 = osc();
    voice(tr, t0, 1.4, (t) => {
      const f = hz(midi) * (1 + 0.04 * Math.exp(-t / 0.03));
      return (o(f) + 0.45 * o2(f * 1.5)) * env(t, 0.002, 0.35);
    }, { gain, pan });
    noiseSweep(tr, t0, 0.05, { gain: gain * 0.4, pan, from: 900, to: 300, q: 0.8, mode: 'lp', shape: (x) => Math.exp(-x * 6) });
  };

  // abertura: vento cortando + "braam" crescendo enquanto as peças caem
  noiseSweep(tr, 0, 0.7, { gain: 0.3, from: 300, to: 4200, q: 0.8, shape: (x) => Math.sin(Math.PI * x) ** 1.5 });
  {
    const notes = [36, 43, 48];
    const oscs = notes.flatMap((m) => [[osc('saw'), hz(m) * 1.004], [osc('saw'), hz(m) * 0.996]]);
    const f = svf();
    voice(tr, 0, 0.62, (t) => {
      let v = 0;
      for (const [o, fr] of oscs) v += o(fr);
      const x = t / 0.62;
      return f(v / oscs.length, 120 + 1600 * x * x, 1.6).lp * x ** 1.4;
    }, { gain: 0.42 });
  }

  for (const p of PIECES) {
    const land = at(p, 'hero', 0.5);
    // assobio da queda (como uma bomba de desenho animado)
    const o = osc();
    const f0 = 1700 + rnd01() * 500;
    voice(tr, p.delay, land - p.delay, (t) => {
      const x = t / (land - p.delay);
      return o(f0 * (1 - 0.55 * x)) * x ** 1.6;
    }, { pan: p.pan, gain: 0.03 });
    noiseSweep(tr, p.delay, land - p.delay, { pan: p.pan, gain: 0.06, from: 800, to: 4000, q: 1.2, shape: (x) => x ** 3 });
    // impacto de cada peça: grave + estalo + pedras
    thump(tr, land, { pan: p.pan, gain: 0.26, f0: 170, f1: 50, decay: 0.1, dist: 3 });
    noiseSweep(tr, land, 0.008, { pan: p.pan, gain: 0.3, from: 5000, to: 5000, mode: 'hp', shape: () => 1 });
    noiseSweep(tr, land, 0.07, { pan: p.pan, gain: 0.22, from: 4200, to: 700, q: 0.7, mode: 'lp', shape: (x) => Math.exp(-x * 5) });
    gravel(tr, land + 0.012, 0.4, { pan: p.pan, gain: 0.13, count: 8, lo: 1400, hi: 5200 });
  }

  // impacto enorme + acorde de metais por fileira
  const chords = [[48, 55, 60, 64], [44, 51, 56, 60], [46, 53, 58, 62], [48, 55, 60, 67]];
  for (const [k, w] of WAVES.entries()) {
    const t = w.mid + (PIECE_MS.hero / 1000) * 0.5;
    thump(tr, t, { gain: 1, f0: 120, f1: 30, fall: 0.07, decay: 0.45, dist: 3.2 });
    noiseSweep(tr, t, 0.6, { gain: 0.32, from: 3200, to: 140, q: 0.8, shape: (x) => Math.exp(-x * 4) });
    const rb = svf();
    const bn = brown();
    voice(tr, t, 1.0, (x) => rb(bn(), 150, 0.8).lp * env(x, 0.01, 0.32), { gain: 0.6 });
    brass(t, chords[k], 0.22, { gain: 0.2, open: 2600, attack: 0.015 });
  }

  // final: rufar dos tímpanos e fanfarra (Dó maior, cheia) com pratos
  const end = Math.max(...WAVES.map((w) => w.mid)) + (PIECE_MS.hero / 1000) * 0.5 + 0.32;
  for (let k = 0; k < 9; k++) timp(end - 0.36 + k * 0.04, 36 + (k % 2) * 7, { gain: 0.12 + k * 0.03, pan: k % 2 ? 0.3 : -0.3 });
  timp(end, 36, { gain: 0.75 });
  thump(tr, end, { gain: 0.6, f0: 90, f1: 34, decay: 0.5, dist: 2 });
  brass(end, [48, 55, 60, 64, 67, 72], 1.0, { gain: 0.26, open: 3400, attack: 0.03 });
  brass(end + 0.02, [60, 64, 67], 1.0, { gain: 0.09, open: 4200, attack: 0.05, pan: 0.4 });
  // prato
  noiseSweep(tr, end, 1.8, { gain: 0.16, from: 9000, to: 5000, q: 0.5, mode: 'hp', shape: (x) => Math.exp(-x * 3.2) });
  // brilho de vitória
  [84, 88, 91, 96].forEach((m, i) => bell(tr, end + 0.08 + i * 0.05, hz(m), { pan: -0.45 + i * 0.3, gain: 0.05, decay: 0.45 }));
  reverb(tr, { mix: 0.26, size: 0.88, damp: 0.5, pre: 0.025 });
  master(tr, { drive: 1.35 });
  writeMp3('entrance_hero', tr);
}

// ================================================================== 9. TEMPESTADE DE RAIOS (lendário)
// Tempestade de verdade: chuva e vento, a eletricidade carregando, um estalo SECO e brilhante em cada
// raio (com "zap" elétrico, chiado de faíscas e a re-descarga), trovões que rolam de um lado para o
// outro a cada fileira e, no fim, um trovão gigante com um acorde grave e a energia "desligando".
{
  const tr = track(5.8);
  // chuva + vento
  const wf = svf();
  const pk = pink();
  const rf = svf();
  const pk2 = pink();
  voice(tr, 0, 3.6, (t) => {
    const e = Math.min(1, t / 0.25) * (t > 2.8 ? Math.exp(-(t - 2.8) / 0.35) : 1);
    const wind = wf(pk(), 420 + 260 * Math.sin(TAU * 0.6 * t) + 120 * Math.sin(TAU * 1.7 * t), 1.6).bp * 2.4;
    const rain = rf(pk2(), 6500, 0.5).hp * 0.45;
    return (wind + rain) * e;
  }, { gain: 0.26 });
  for (let k = 0; k < 140; k++) {
    const st = rnd01() * 3.2;
    const f = svf();
    const fc = 2800 + rnd01() * 4500;
    voice(tr, st, 0.02, (t) => f(rnd(), fc, 4).bp * Math.exp(-t / 0.0025), { pan: rnd() * 0.95, gain: 0.07 });
  }
  // eletricidade carregando (zumbido que sobe)
  {
    const o = osc('saw');
    const f = svf();
    voice(tr, 0, 0.5, (t) => {
      const x = t / 0.5;
      const crackle = rnd01() < 0.01 ? rnd() * 4 : 0;
      return f(o(55 + 200 * x) + crackle, 600 + 3000 * x, 2).bp * x ** 1.2 * (t > 0.42 ? Math.exp(-(t - 0.42) / 0.03) : 1);
    }, { gain: 0.3 });
  }
  for (const p of PIECES) {
    const hit = at(p, 'lightning', 0.045);
    const re = at(p, 'lightning', 0.3);
    // estalo do raio: clique + ruído branco muito curto e brilhante
    noiseSweep(tr, hit, 0.004, { pan: p.pan, gain: 0.5, from: 7000, to: 7000, mode: 'hp', shape: () => 1 });
    noiseSweep(tr, hit, 0.07, { pan: p.pan, gain: 0.45, from: 10000, to: 1000, q: 0.6, mode: 'hp', shape: (x) => Math.exp(-x * 6) });
    thump(tr, hit, { pan: p.pan, gain: 0.16, f0: 240, f1: 70, decay: 0.05, dist: 3.5 });
    // "zap" elétrico (FM descendo)
    const c = osc();
    const m = osc();
    voice(tr, hit, 0.14, (t) => c(2600 * Math.exp(-t / 0.04) + 180 + m(90) * 600 * Math.exp(-t / 0.05)) * env(t, 0.001, 0.04), { pan: p.pan, gain: 0.07 });
    // re-descarga mais fraca
    noiseSweep(tr, re, 0.04, { pan: p.pan, gain: 0.2, from: 8000, to: 1500, q: 0.6, mode: 'hp', shape: (x) => Math.exp(-x * 7) });
    // chiado elétrico com faíscas até a peça assentar
    const buzz = osc('saw');
    const bf = svf();
    const end = at(p, 'lightning', 0.7) - hit;
    voice(tr, hit + 0.01, end, (t) => {
      const crack = rnd01() < 0.006 ? rnd() * 7 : 0;
      const gate = Math.sin(TAU * 31 * t) > -0.3 ? 1 : 0.3;
      return bf(buzz(100 + rnd() * 25) + crack, 2600, 1.3).bp * env(t, 0.002, end * 0.4) * gate;
    }, { pan: p.pan, gain: 0.09 });
  }
  // trovão por fileira: estalo perto + ronco rolando de um lado para o outro
  for (const [k, w] of WAVES.entries()) {
    const t0 = w.start + 0.06;
    const side = k % 2 ? 0.65 : -0.65;
    noiseSweep(tr, t0, 0.35, { gain: 0.35, from: 3000, to: 200, q: 0.7, mode: 'lp', src: brown(), shape: (x) => Math.exp(-x * 5) });
    const rb = svf();
    const bn = brown();
    let bump = 0;
    voicePan(tr, t0 + 0.05, 1.9, (t) => {
      if (rnd01() < 0.0011) bump = 1 + rnd01() * 1.2;
      bump *= 0.9995;
      const v = rb(bn(), 170 + 260 * Math.exp(-t / 0.2), 0.9).lp * (env(t, 0.02, 0.6) * 1.5 + bump * env(t, 0.1, 0.55));
      return [v, side * (1 - t / 1.9) - side * 0.6 * (t / 1.9)];
    }, 0.75);
  }
  // trovão gigante final + acorde grave e energia "desligando"
  const fin = Math.max(...PIECES.map((p) => at(p, 'lightning', 0.3))) + 0.12;
  noiseSweep(tr, fin, 0.006, { gain: 0.6, from: 6000, to: 6000, mode: 'hp', shape: () => 1 });
  noiseSweep(tr, fin, 0.5, { gain: 0.5, from: 9000, to: 400, q: 0.6, mode: 'hp', shape: (x) => Math.exp(-x * 5) });
  thump(tr, fin, { gain: 1, f0: 110, f1: 26, fall: 0.08, decay: 0.6, dist: 3 });
  {
    const rb = svf();
    const bn = brown();
    voicePan(tr, fin + 0.02, 3.4, (t) => [rb(bn(), 140 + 300 * Math.exp(-t / 0.25), 0.9).lp * env(t, 0.015, 0.75) * 1.6, Math.sin(t * 2.2) * 0.6], 0.9);
  }
  {
    const notes = [33, 40, 45, 48];
    const oscs = notes.flatMap((mm) => [[osc('saw'), hz(mm) * 1.005], [osc('saw'), hz(mm) * 0.995]]);
    const f = svf();
    voice(tr, fin, 3.4, (t) => {
      let v = 0;
      for (const [o, fr] of oscs) v += o(fr);
      return f(v / oscs.length, 200 + 1800 * Math.exp(-t / 0.35), 1.3).lp * env(t, 0.01, 0.8);
    }, { gain: 0.3 });
  }
  {
    // energia desligando: zumbido que despenca
    const o = osc('sq');
    const f = svf();
    voice(tr, fin + 0.35, 0.8, (t) => f(o(420 * Math.exp(-t / 0.22) + 40), 1800, 1.5).lp * env(t, 0.005, 0.25), { gain: 0.08 });
  }
  reverb(tr, { mix: 0.3, size: 0.86, damp: 0.5, pre: 0.025 });
  master(tr, { drive: 1.3 });
  writeMp3('entrance_lightning', tr);
}

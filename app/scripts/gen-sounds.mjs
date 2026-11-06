// Gera os sons do tabuleiro e as músicas das finalizações (WAV mono 16 bits) por síntese.
// Tudo é composição original: nenhum trecho de música ou gravação de terceiros.
// Uso: node scripts/gen-sounds.mjs
import { writeFileSync } from 'node:fs';

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ utilidades

/** Filtro biquad (RBJ). type: 'lp' | 'hp' | 'bp'. */
function biquad(type, f, q, sr) {
  const w = (TAU * f) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'hp') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function track(seconds, sr) {
  return { sr, data: new Float32Array(Math.ceil(seconds * sr)) };
}

/** Escreve uma voz: fn(t, i) devolve a amostra; dura `dur` segundos a partir de `at`. */
function voice(tr, at, dur, fn) {
  const s = Math.floor(at * tr.sr);
  const n = Math.floor(dur * tr.sr);
  for (let i = 0; i < n && s + i < tr.data.length; i++) tr.data[s + i] += fn(i / tr.sr, i);
}

/** Reverberação curta (sala pequena): pentes em paralelo. */
function room(tr, mix = 0.12, size = 1) {
  const d = tr.data;
  const out = new Float32Array(d.length);
  const delays = [0.0113, 0.0149, 0.0187, 0.0231].map((x) => Math.floor(x * size * tr.sr));
  for (const dl of delays) {
    const buf = new Float32Array(dl);
    let p = 0;
    for (let i = 0; i < d.length; i++) {
      const y = buf[p];
      buf[p] = d[i] + y * 0.62;
      out[i] += y;
      p = (p + 1) % dl;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] += (out[i] / delays.length) * mix;
}

function write(name, tr, peak, { trim = true, clip = 0, loop = 0 } = {}) {
  let { data } = tr;
  const { sr } = tr;
  if (loop > 0) {
    // Música em loop: a cauda (eco) passa do fim e é somada ao começo, para emendar sem estalo.
    const L = Math.round(loop * sr);
    const folded = data.slice(0, L);
    for (let i = L; i < data.length; i++) folded[i - L] += data[i];
    data = folded;
  }
  if (clip > 0) for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i] * clip) / Math.tanh(clip);
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const k = peak / (max || 1);
  let end = data.length;
  if (trim) while (end > 1 && Math.abs(data[end - 1] * k) < 0.0005) end--;
  const n = end;
  const fade = Math.floor(sr * 0.005);
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + n * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(sr, 24);
  pcm.writeUInt32LE(sr * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const f = trim && i > n - fade ? (n - i) / fade : 1;
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * k * f)) * 32767), 44 + i * 2);
  }
  writeFileSync(new URL(`../assets/sounds/${name}.wav`, import.meta.url), pcm);
  console.log(name.padEnd(14), (n / sr).toFixed(2) + 's', Math.round(pcm.length / 1024) + ' KB');
}

// ------------------------------------------------------------------ sons do tabuleiro (44,1 kHz)

/**
 * Peça de madeira batendo no tabuleiro de madeira:
 * - estalo do contato (ruído curtíssimo filtrado na faixa de 2–5 kHz);
 * - "corpo" oco do tabuleiro: modos de vibração graves e médios, inarmônicos,
 *   que somem em dezenas de milissegundos;
 * - o feltro da base abafa os agudos (passa-baixa no fim).
 */
function woodKnock(tr, at, { gain = 1, pitch = 1, bright = 1, body = 1 } = {}) {
  const click = biquad('bp', 3200 * pitch, 1.1, tr.sr);
  const modes = [
    [182, 0.075, 0.55 * body],
    [297, 0.05, 0.4 * body],
    [468, 0.04, 0.85],
    [731, 0.028, 0.6],
    [1123, 0.018, 0.45 * bright],
    [1688, 0.011, 0.3 * bright],
  ];
  const phase = modes.map(() => Math.random() * 0.3);
  voice(tr, at, 0.3, (t) => {
    let v = click(rnd()) * Math.exp(-t / 0.0025) * 1.6 * bright;
    modes.forEach(([f, d, a], k) => {
      // o modo mais grave cai levemente de afinação (madeira "afundando")
      const ff = f * pitch * (k === 0 ? 1 + 0.06 * Math.exp(-t / 0.01) : 1);
      v += a * Math.sin(TAU * ff * t + phase[k]) * Math.exp(-t / d);
    });
    return v * gain * Math.min(1, t / 0.0006);
  });
}

function felt(tr, f = 5200) {
  const lp = biquad('lp', f, 0.7, tr.sr);
  for (let i = 0; i < tr.data.length; i++) tr.data[i] = lp(tr.data[i]);
}

function bell(tr, at, f, { gain = 1, decay = 0.35 } = {}) {
  const partials = [[1, 1], [2.0, 0.35], [3.01, 0.15], [4.2, 0.06]];
  voice(tr, at, decay * 5, (t) => {
    let v = 0;
    for (const [m, a] of partials) v += a * Math.sin(TAU * f * m * t) * Math.exp((-t * m) / decay);
    return v * gain * Math.min(1, t / 0.003);
  });
}

function boom(tr, at, { gain = 1 } = {}) {
  let ph = 0;
  voice(tr, at, 0.8, (t) => {
    const f = 45 + 90 * Math.exp(-t / 0.06);
    ph += (TAU * f) / tr.sr;
    return Math.sin(ph) * Math.exp(-t / 0.22) * gain * Math.min(1, t / 0.002);
  });
}

{
  // Lance: um "toc" de madeira com corpo.
  const t = track(0.3, 44100);
  woodKnock(t, 0.002);
  felt(t);
  room(t, 0.18, 0.8);
  write('move', t, 0.75);
}
{
  // Captura: peça contra peça (estalo mais agudo) e logo depois a batida no tabuleiro, mais forte.
  const t = track(0.35, 44100);
  woodKnock(t, 0.002, { gain: 0.6, pitch: 1.9, bright: 1.6, body: 0.2 });
  woodKnock(t, 0.032, { gain: 1, pitch: 0.92, bright: 1.1, body: 1.3 });
  felt(t, 6500);
  room(t, 0.2, 0.8);
  write('capture', t, 0.85);
}
{
  // Xeque: toc + dois toques de alerta subindo.
  const t = track(0.8, 44100);
  woodKnock(t, 0.002, { gain: 0.9 });
  bell(t, 0.06, 1318.5, { gain: 0.5, decay: 0.12 });
  bell(t, 0.17, 1760, { gain: 0.55, decay: 0.16 });
  write('check', t, 0.8);
}
{
  // Xeque-mate: batida grave + acorde vitorioso em arpejo (bem diferente do xeque).
  const t = track(2.2, 44100);
  woodKnock(t, 0.002, { gain: 1 });
  boom(t, 0.02, { gain: 1.2 });
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => bell(t, 0.12 + i * 0.11, f, { gain: 0.5, decay: 0.5 }));
  notes.forEach((f) => bell(t, 0.62, f / 2, { gain: 0.35, decay: 0.7 }));
  boom(t, 0.62, { gain: 0.8 });
  write('mate', t, 0.85);
}

// ------------------------------------------------------------------ instrumentos (músicas, 22 kHz)

const SR = 22050;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function kick(tr, at, gain = 1) {
  let ph = 0;
  voice(tr, at, 0.45, (t) => {
    const f = 48 + 120 * Math.exp(-t / 0.035);
    ph += (TAU * f) / tr.sr;
    return (Math.sin(ph) * Math.exp(-t / 0.22) + (t < 0.004 ? rnd() * 0.4 : 0)) * gain;
  });
}

/** 808: grave longo com leve distorção e deslize de afinação. */
function bass808(tr, at, midi, dur, { gain = 1, from = null } = {}) {
  let ph = 0;
  const f1 = hz(midi);
  const f0 = from === null ? f1 : hz(from);
  voice(tr, at, dur, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.06);
    ph += (TAU * f) / tr.sr;
    const env = Math.min(1, t / 0.005) * Math.exp(-t / (dur * 0.9)) * Math.min(1, (dur - t) / 0.02);
    return Math.tanh(Math.sin(ph) * 2.2) * env * gain;
  });
}

function clap(tr, at, gain = 1) {
  const bp = biquad('bp', 1500, 0.9, tr.sr);
  voice(tr, at, 0.3, (t) => {
    // três rajadas rápidas + cauda
    const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / 0.006) : 0), 0);
    return bp(rnd()) * (bursts * 0.7 + Math.exp(-t / 0.09)) * gain;
  });
}

function hat(tr, at, { open = false, gain = 1 } = {}) {
  const hp = biquad('hp', 7000, 0.7, tr.sr);
  voice(tr, at, open ? 0.25 : 0.06, (t) => hp(rnd()) * Math.exp(-t / (open ? 0.08 : 0.018)) * gain);
}

/** Cowbell metálico (timbre clássico do phonk). */
function cowbell(tr, at, midi, gain = 1) {
  const f = hz(midi);
  const bp = biquad('bp', f * 1.6, 2.2, tr.sr);
  let p1 = 0, p2 = 0;
  voice(tr, at, 0.4, (t) => {
    p1 += f / tr.sr;
    p2 += (f * 1.504) / tr.sr;
    const sq = (p1 % 1 < 0.5 ? 1 : -1) + (p2 % 1 < 0.5 ? 1 : -1);
    const env = Math.exp(-t / 0.012) * 0.6 + Math.exp(-t / 0.14) * 0.4;
    return Math.tanh(bp(sq) * 3) * env * gain;
  });
}

function tom(tr, at, midi, gain = 1) {
  let ph = 0;
  const f1 = hz(midi);
  voice(tr, at, 0.3, (t) => {
    const f = f1 * (1 + 0.5 * Math.exp(-t / 0.02));
    ph += (TAU * f) / tr.sr;
    return Math.sin(ph) * Math.exp(-t / 0.11) * gain;
  });
}

/** Sintetizador "dente de serra" com filtro (acordes e melodias). */
function saw(tr, at, midi, dur, { gain = 1, cutoff = 2400, detune = 0.006 } = {}) {
  const lp = biquad('lp', cutoff, 1.2, tr.sr);
  const f = hz(midi);
  let a = 0, b = 0;
  voice(tr, at, dur + 0.08, (t) => {
    a += (f * (1 + detune)) / tr.sr;
    b += (f * (1 - detune)) / tr.sr;
    const s = (a % 1) * 2 - 1 + ((b % 1) * 2 - 1);
    const env = Math.min(1, t / 0.006) * (t < dur ? 1 - 0.4 * (t / dur) : Math.exp(-(t - dur) / 0.02));
    return lp(s) * env * gain * 0.5;
  });
}

/** Onda quadrada (estilo videogame). */
function square(tr, at, midi, dur, { gain = 1, duty = 0.5 } = {}) {
  const f = hz(midi);
  let p = 0;
  voice(tr, at, dur, (t) => {
    p += f / tr.sr;
    const env = Math.min(1, t / 0.004) * Math.min(1, (dur - t) / 0.01) * (0.75 + 0.25 * Math.exp(-t / 0.08));
    return (p % 1 < duty ? 1 : -1) * env * gain;
  });
}

function triangle(tr, at, midi, dur, gain = 1) {
  const f = hz(midi);
  let p = 0;
  voice(tr, at, dur, (t) => {
    p += f / tr.sr;
    const x = p % 1;
    return (x < 0.5 ? 4 * x - 1 : 3 - 4 * x) * Math.min(1, (dur - t) / 0.01) * gain;
  });
}

// ------------------------------------------------------------------ "Aura" — phonk para o Movimento do 67

{
  const bpm = 140;
  const s16 = 60 / bpm / 4;
  const bars = 4;
  const tr = track(bars * 16 * s16 + 0.5, SR);
  // Melodia do cowbell (Ré menor), 16 semicolcheias por compasso; null = pausa.
  const D5 = 74, F5 = 77, A5 = 81, G5 = 79, E5 = 76, C5 = 72, A4 = 69, Bb4 = 70, C6 = 84;
  const bell1 = [D5, null, F5, null, A5, null, G5, F5, null, E5, null, D5, null, A4, C5, null];
  const bell2 = [D5, null, F5, null, A5, null, C6, A5, null, G5, null, F5, E5, null, D5, Bb4];
  const bassNotes = [38, 38, 34, 36]; // Ré, Ré, Sib, Dó (oitava grave)
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * 16 * s16;
    const mel = bar % 2 ? bell2 : bell1;
    mel.forEach((m, i) => m && cowbell(tr, b0 + i * s16, m, i % 4 === 0 ? 0.55 : 0.42));
    [0, 6, 10].forEach((i) => kick(tr, b0 + i * s16, 0.9));
    [4, 12].forEach((i) => clap(tr, b0 + i * s16, 0.55));
    for (let i = 0; i < 16; i += 2) hat(tr, b0 + i * s16, { gain: i % 4 === 2 ? 0.28 : 0.18 });
    if (bar % 2) [13, 14, 15].forEach((i) => hat(tr, b0 + (i + 0.5) * s16, { gain: 0.16 }));
    const n = bassNotes[bar];
    bass808(tr, b0, n, 6 * s16, { gain: 0.8, from: n + 5 });
    bass808(tr, b0 + 6 * s16, n, 4 * s16, { gain: 0.7 });
    bass808(tr, b0 + 10 * s16, n + 12, 6 * s16, { gain: 0.6, from: n });
  }
  room(tr, 0.15, 1.6);
  write('music_67', tr, 0.9, { trim: false, clip: 1.4, loop: bars * 16 * s16 });
}

// ------------------------------------------------------------------ "Passinho" — funk (tamborzão) para o Passinho do Jamal

{
  const bpm = 130;
  const s16 = 60 / bpm / 4;
  const bars = 4;
  const tr = track(bars * 16 * s16 + 0.5, SR);
  // Batida tamborzão: bumbos, tambores grave/agudo e palmas.
  const kicks = [0, 3, 7, 10];
  const low = [6, 14];
  const high = [11, 15];
  const claps = [4, 12];
  // Teclado "plim" em Mi menor.
  const E5 = 76, G5 = 79, B5 = 83, A5 = 81, D6 = 86, Fs5 = 78;
  const lead = [
    [E5, null, null, G5, null, null, B5, null, A5, null, G5, null, Fs5, null, E5, null],
    [E5, null, null, G5, null, null, B5, null, D6, null, B5, null, A5, G5, A5, null],
  ];
  const bassNotes = [40, 40, 43, 38];
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * 16 * s16;
    kicks.forEach((i) => kick(tr, b0 + i * s16, 1));
    low.forEach((i) => tom(tr, b0 + i * s16, 50, 0.55));
    high.forEach((i) => tom(tr, b0 + i * s16, 57, 0.45));
    claps.forEach((i) => clap(tr, b0 + i * s16, 0.6));
    for (let i = 2; i < 16; i += 4) hat(tr, b0 + i * s16, { gain: 0.2 });
    lead[bar % 2].forEach((m, i) => m && saw(tr, b0 + i * s16, m, s16 * 1.6, { gain: 0.32, cutoff: 3200 }));
    kicks.forEach((i) => bass808(tr, b0 + i * s16, bassNotes[bar], 2.5 * s16, { gain: 0.5 }));
  }
  room(tr, 0.12, 1.3);
  write('music_jamal', tr, 0.9, { trim: false, clip: 1.3, loop: bars * 16 * s16 });
}

// ------------------------------------------------------------------ "Vitória" — fanfarra 8 bits para os outros movimentos

{
  const bpm = 150;
  const s8 = 60 / bpm / 2;
  const tr = track(16 * s8 * 2 + 0.5, SR);
  const C5 = 72, E5 = 76, G5 = 79, C6 = 84, A5 = 81, F5 = 77, D5 = 74, B5 = 83;
  const melody = [C5, E5, G5, C6, null, G5, C6, null, A5, F5, A5, C6, B5, G5, D5, G5];
  const melody2 = [C5, E5, G5, C6, null, G5, C6, null, A5, C6, B5, A5, G5, null, C6, null];
  const bass = [48, 48, 53, 55];
  [melody, melody2].forEach((mel, half) => {
    const h0 = half * 16 * s8;
    mel.forEach((m, i) => m && square(tr, h0 + i * s8, m, s8 * 0.9, { gain: 0.22, duty: 0.25 }));
    for (let i = 0; i < 16; i++) {
      triangle(tr, h0 + i * s8, bass[Math.floor(i / 4)], s8 * 0.8, 0.45);
      if (i % 2 === 0) kick(tr, h0 + i * s8, 0.5);
      else hat(tr, h0 + i * s8, { gain: 0.15 });
    }
  });
  write('music_victory', tr, 0.85, { trim: false, clip: 1.1, loop: 32 * s8 });
}

// Gera os sons do tabuleiro (WAV mono 16 bits) por síntese — sem arquivos de terceiros.
// Uso: node scripts/gen-sounds.mjs
import { writeFileSync } from 'node:fs';

const SR = 44100;
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;

function buf(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}

/** "Toc" de madeira: estalo de ruído + modos ressonantes que somem rápido. */
function tock(out, at, { gain = 1, modes = [[420, 0.045, 0.5], [1150, 0.03, 0.9], [1900, 0.018, 0.45]], noise = 0.6 } = {}) {
  const start = Math.floor(at * SR);
  let lp = 0;
  for (let i = 0; i < SR * 0.25 && start + i < out.length; i++) {
    const t = i / SR;
    lp += 0.35 * (rnd() - lp);
    let v = lp * noise * Math.exp(-t / 0.004);
    for (const [f, d, a] of modes) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
    const attack = Math.min(1, t / 0.0008);
    out[start + i] += v * gain * attack;
  }
}

/** Sino suave (parciais inarmônicos). */
function bell(out, at, f, { gain = 1, decay = 0.35 } = {}) {
  const start = Math.floor(at * SR);
  const partials = [[1, 1], [2.0, 0.35], [3.01, 0.15], [4.2, 0.06]];
  for (let i = 0; i < SR * decay * 5 && start + i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [m, a] of partials) v += a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t * m / decay);
    out[start + i] += v * gain * Math.min(1, t / 0.003);
  }
}

/** Batida grave com queda de afinação (tambor). */
function boom(out, at, { gain = 1 } = {}) {
  const start = Math.floor(at * SR);
  let phase = 0;
  for (let i = 0; i < SR * 0.8 && start + i < out.length; i++) {
    const t = i / SR;
    const f = 45 + 90 * Math.exp(-t / 0.06);
    phase += (2 * Math.PI * f) / SR;
    out[start + i] += Math.sin(phase) * Math.exp(-t / 0.22) * gain * Math.min(1, t / 0.002);
  }
}

function write(name, data, peak) {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const k = peak / (max || 1);
  // Corta o silêncio do fim e faz fade-out de 5 ms.
  let end = data.length;
  while (end > 1 && Math.abs(data[end - 1] * k) < 0.0005) end--;
  const n = end;
  const fade = Math.floor(SR * 0.005);
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + n * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const f = i > n - fade ? (n - i) / fade : 1;
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * k * f)) * 32767), 44 + i * 2);
  }
  writeFileSync(new URL(`../assets/sounds/${name}.wav`, import.meta.url), pcm);
  console.log(name, (n / SR).toFixed(2) + 's', pcm.length, 'bytes');
}

// Lance comum: um toc de madeira.
{
  const b = buf(0.2);
  tock(b, 0);
  write('move', b, 0.7);
}
// Captura: toc mais seco e forte, com um segundo choque (peça batendo na peça).
{
  const b = buf(0.25);
  tock(b, 0, { modes: [[520, 0.035, 0.5], [1500, 0.025, 0.9], [2600, 0.012, 0.5]], noise: 1 });
  tock(b, 0.028, { gain: 0.55, modes: [[900, 0.03, 0.6], [2100, 0.015, 0.5]], noise: 0.8 });
  write('capture', b, 0.85);
}
// Xeque: toc + dois toques de alerta subindo.
{
  const b = buf(0.8);
  tock(b, 0, { gain: 0.8 });
  bell(b, 0.05, 1318.5, { gain: 0.55, decay: 0.12 });
  bell(b, 0.16, 1760, { gain: 0.6, decay: 0.16 });
  write('check', b, 0.8);
}
// Xeque-mate: batida grave + acorde vitorioso em arpejo (bem diferente do xeque).
{
  const b = buf(2.2);
  tock(b, 0, { gain: 0.9 });
  boom(b, 0.02, { gain: 1.2 });
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => bell(b, 0.12 + i * 0.11, f, { gain: 0.5, decay: 0.5 }));
  // acorde final sustentado
  notes.forEach((f) => bell(b, 0.62, f / 2, { gain: 0.35, decay: 0.7 }));
  boom(b, 0.62, { gain: 0.8 });
  write('mate', b, 0.85);
}

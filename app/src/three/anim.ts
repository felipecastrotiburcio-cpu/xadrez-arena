import type { Avatar } from './avatar';

/**
 * Animação por poses-chave (keyframes), como nos jogos:
 * - uma Pose define rotações das articulações (e deslocamentos do corpo/pelve);
 * - um Clip é uma sequência de poses no tempo, interpolada por spline
 *   Catmull-Rom (movimento contínuo, sem "paradas" em cada pose);
 * - o Animator troca de clip com transição suave (crossfade).
 */

export const JOINTS = [
  'body',
  'pelvis',
  'spine',
  'neck',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const;
export type Joint = (typeof JOINTS)[number];
export type Vec3 = readonly [number, number, number];
export type Pose = Partial<Record<Joint, Vec3>> & { bodyPos?: Vec3; pelvisPos?: Vec3 };

const NJ = JOINTS.length;
const BODY_POS = NJ * 3;
const PELVIS_POS = (NJ + 1) * 3;
export const POSE_SIZE = (NJ + 2) * 3;

/** Converte uma Pose (parcial) em array; o que não for informado fica em repouso (0). */
export function poseArray(p: Pose): Float32Array {
  const a = new Float32Array(POSE_SIZE);
  JOINTS.forEach((j, i) => {
    const v = p[j];
    if (v) a.set(v, i * 3);
  });
  if (p.bodyPos) a.set(p.bodyPos, BODY_POS);
  if (p.pelvisPos) a.set(p.pelvisPos, PELVIS_POS);
  return a;
}

/** Junta poses (as da direita sobrescrevem as da esquerda). */
export const merge = (...poses: Pose[]): Pose => Object.assign({}, ...poses);

/** Espelha uma pose (lado esquerdo ↔ direito). */
export function mirror(p: Pose): Pose {
  const out: Record<string, Vec3> = {};
  const flip = (v: Vec3): Vec3 => [v[0], -v[1], -v[2]];
  for (const [k, v] of Object.entries(p) as [string, Vec3][]) {
    if (k === 'bodyPos' || k === 'pelvisPos') out[k] = [-v[0], v[1], v[2]];
    else if (k.endsWith('L')) out[k.slice(0, -1) + 'R'] = flip(v);
    else if (k.endsWith('R')) out[k.slice(0, -1) + 'L'] = flip(v);
    else out[k] = flip(v);
  }
  return out as Pose;
}

export interface Clip {
  duration: number;
  /** loop: repete emendando o fim no começo; cycle: recomeça do zero (fim e início equivalentes, ex. giro de 360°). */
  mode: 'once' | 'loop' | 'cycle';
  /** snap: movimentos "travados" (dança do robô) — muda rápido e segura a pose. */
  snap?: boolean;
  times: number[];
  poses: Float32Array[];
}

export function makeClip(
  duration: number,
  keys: [number, Pose][],
  mode: Clip['mode'] = 'once',
  opts: { snap?: boolean } = {},
): Clip {
  const k = [...keys];
  if (mode === 'loop' && k[k.length - 1][0] < duration) k.push([duration, k[0][1]]);
  return { duration, mode, snap: opts.snap, times: k.map(([t]) => t), poses: k.map(([, p]) => poseArray(p)) };
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function sample(c: Clip, time: number, out: Float32Array) {
  const n = c.times.length;
  let t = time;
  if (c.mode === 'once') t = Math.min(Math.max(t, 0), c.duration);
  else t = ((t % c.duration) + c.duration) % c.duration;
  if (n === 1 || t <= c.times[0]) {
    out.set(c.poses[0]);
    return;
  }
  if (t >= c.times[n - 1]) {
    out.set(c.poses[n - 1]);
    return;
  }
  let i = 0;
  while (i < n - 2 && t >= c.times[i + 1]) i++;
  const u = (t - c.times[i]) / (c.times[i + 1] - c.times[i]);
  const p1 = c.poses[i];
  const p2 = c.poses[i + 1];
  if (c.snap) {
    // Muda nos primeiros 30% do intervalo e segura a pose no resto.
    const s = smooth(Math.min(1, u / 0.3));
    for (let j = 0; j < POSE_SIZE; j++) out[j] = p1[j] + (p2[j] - p1[j]) * s;
    return;
  }
  // Vizinhos para a spline (em loop, contornando o fim; senão, repetindo as pontas).
  const wrap = c.mode === 'loop';
  const p0 = i > 0 ? c.poses[i - 1] : wrap ? c.poses[n - 2] : p1;
  const p3 = i + 2 < n ? c.poses[i + 2] : wrap ? c.poses[1] : p2;
  const u2 = u * u;
  const u3 = u2 * u;
  for (let j = 0; j < POSE_SIZE; j++) {
    const a = p0[j];
    const b = p1[j];
    const cc = p2[j];
    const d = p3[j];
    out[j] = 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3);
  }
}

/** Toca clips com transição suave entre eles. */
export class Animator {
  private clip: Clip;
  private start: number;
  private prev: Clip | null = null;
  private prevStart = 0;
  private fadeStart = 0;
  private fadeDur = 0;
  private tmp = new Float32Array(POSE_SIZE);
  readonly pose = new Float32Array(POSE_SIZE);

  constructor(clip: Clip, t = 0) {
    this.clip = clip;
    this.start = t;
  }

  play(clip: Clip, t: number, fade = 0.25) {
    if (clip === this.clip) return;
    this.prev = this.clip;
    this.prevStart = this.start;
    this.clip = clip;
    this.start = t;
    this.fadeStart = t;
    this.fadeDur = fade;
  }

  /** Tempo decorrido no clip atual. */
  elapsed(t: number) {
    return t - this.start;
  }

  finished(t: number) {
    return this.clip.mode === 'once' && t - this.start >= this.clip.duration;
  }

  current() {
    return this.clip;
  }

  evaluate(t: number) {
    sample(this.clip, t - this.start, this.pose);
    if (this.prev && this.fadeDur > 0 && t < this.fadeStart + this.fadeDur) {
      sample(this.prev, t - this.prevStart, this.tmp);
      const w = smooth((t - this.fadeStart) / this.fadeDur);
      for (let i = 0; i < POSE_SIZE; i++) this.pose[i] = this.tmp[i] + (this.pose[i] - this.tmp[i]) * w;
    } else {
      this.prev = null;
    }
    return this.pose;
  }
}

/** Aplica a pose ao esqueleto do boneco. */
export function applyPose(a: Avatar, p: Float32Array) {
  const groups = [
    a.body,
    a.pelvis,
    a.spine,
    a.neck,
    a.shoulderL,
    a.elbowL,
    a.shoulderR,
    a.elbowR,
    a.hipL,
    a.kneeL,
    a.hipR,
    a.kneeR,
  ];
  for (let i = 0; i < NJ; i++) groups[i].rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  a.body.position.set(p[BODY_POS], p[BODY_POS + 1], p[BODY_POS + 2]);
  a.pelvis.position.set(p[PELVIS_POS], a.pelvisHeight + p[PELVIS_POS + 1], p[PELVIS_POS + 2]);
}

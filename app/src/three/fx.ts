import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeTree } from './avatar';

/**
 * Efeitos leves para os itens dos bonecos (pensados para celular):
 * - Particles: um único InstancedMesh por sistema (1 desenho por sistema);
 * - Trail: rastro de luz em fita, atualizado a cada quadro;
 * - formas prontas (estrela de brilho, nota musical, cavalo do xadrez).
 * Partículas e rastros ficam numa camada presa à cena (não ao boneco), para
 * ficarem "para trás" quando o boneco se move.
 */

const tmpV = new THREE.Vector3();

export class FxLayer {
  readonly group = new THREE.Group();
  private attached = false;
  constructor(private anchor: THREE.Object3D) {}
  /** Prende a camada à cena (ou ao próprio boneco, se ele ainda não estiver numa cena). */
  ensure() {
    if (this.attached) return;
    (this.anchor.parent ?? this.anchor).add(this.group);
    this.attached = true;
  }
  /** Converte uma posição do mundo para o espaço da camada. */
  toLocal(world: THREE.Vector3, out = new THREE.Vector3()) {
    out.copy(world);
    return this.group.parent ? this.group.parent.worldToLocal(out) : out;
  }
  dispose() {
    this.group.removeFromParent();
    disposeTree(this.group);
  }
}

export interface ParticleOpts {
  additive?: boolean;
  opacity?: number;
  gravity?: number;
  drag?: number;
  /** Quanto cresce até o fim da vida (fumaça); negativo encolhe. */
  grow?: number;
  spin?: number;
}

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private rot: Float32Array;
  private col: THREE.Color[];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private layer: FxLayer, readonly max: number, geo: THREE.BufferGeometry, private o: ParticleOpts = {}) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: o.opacity ?? 1,
      blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.col = Array.from({ length: max }, () => new THREE.Color());
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set(0, 0, 0));
    }
    layer.group.add(this.mesh);
  }

  /** Cria uma partícula numa posição do MUNDO. */
  spawn(world: THREE.Vector3, vel: THREE.Vector3, life: number, size: number, color: THREE.ColorRepresentation) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.layer.toLocal(world, tmpV);
    this.pos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
    this.vel.set([vel.x, vel.y, vel.z], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.col[i].set(color);
  }

  update(dt: number) {
    const { gravity = 0, drag = 0, grow = -0.6, spin = 3, additive } = this.o;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        if (this.size[i] !== 0) {
          this.size[i] = 0;
          this.m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(i, this.m);
        }
        continue;
      }
      this.age[i] += dt;
      const j = i * 3;
      this.vel[j + 1] += gravity * dt;
      const d = Math.max(0, 1 - drag * dt);
      this.vel[j] *= d;
      this.vel[j + 1] *= d;
      this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = Math.min(1, this.age[i] / this.life[i]);
      const sc = Math.max(0.0001, this.size[i] * (1 + grow * k));
      this.e.set(this.rot[i] + spin * this.age[i], this.rot[i] * 0.7 + spin * 0.6 * this.age[i], 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]), this.q, this.s.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, this.m);
      // Aditivo: some escurecendo. Normal (fumaça): a cor se mantém e a escala faz o resto.
      const fade = additive === false ? 1 : (1 - k) * Math.min(1, k * 8 + 0.2);
      this.mesh.setColorAt(i, this.c.copy(this.col[i]).multiplyScalar(fade));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Rastro de luz (fita entre dois pontos que se movem: base e ponta da lâmina). */
export class Trail {
  private geo = new THREE.BufferGeometry();
  private positions: Float32Array;
  private colors: Float32Array;
  private hist: { a: THREE.Vector3; b: THREE.Vector3; t: number }[] = [];
  private base: THREE.Color;

  constructor(private layer: FxLayer, private segments: number, color: THREE.ColorRepresentation, private life = 0.22) {
    const n = (segments + 1) * 2;
    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    const idx: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.base = new THREE.Color(color);
    const mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    mesh.frustumCulled = false;
    layer.group.add(mesh);
  }

  push(aWorld: THREE.Vector3, bWorld: THREE.Vector3, t: number) {
    this.hist.unshift({ a: this.layer.toLocal(aWorld), b: this.layer.toLocal(bWorld), t });
    while (this.hist.length > this.segments + 1 || (this.hist.length > 1 && t - this.hist[this.hist.length - 1].t > this.life)) this.hist.pop();
    const n = this.segments + 1;
    for (let i = 0; i < n; i++) {
      const h = this.hist[Math.min(i, this.hist.length - 1)];
      const k = i < this.hist.length ? Math.max(0, 1 - (t - h.t) / this.life) : 0;
      const f = k * k;
      this.positions.set([h.a.x, h.a.y, h.a.z, h.b.x, h.b.y, h.b.z], i * 6);
      // A borda de fora (ponta) brilha mais que a de dentro.
      this.colors.set([this.base.r * f * 0.25, this.base.g * f * 0.25, this.base.b * f * 0.25, this.base.r * f, this.base.g * f, this.base.b * f], i * 6);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ------------------------------------------------------------------ formas

/** Estrela de 4 pontas (brilho), em dois planos cruzados para aparecer de qualquer ângulo. */
export function starGeo(r = 1, inner = 0.18) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? inner * r : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  const a = new THREE.ShapeGeometry(s);
  const b = a.clone().rotateY(Math.PI / 2);
  return mergeGeometries([a, b])!;
}

/** Nota musical (colcheia). */
export function noteGeo() {
  const head = new THREE.CircleGeometry(0.22, 14);
  head.scale(1.25, 0.9, 1);
  head.rotateZ(0.35);
  const stem = new THREE.PlaneGeometry(0.06, 0.75);
  stem.translate(0.22, 0.38, 0);
  const flag = new THREE.PlaneGeometry(0.28, 0.08);
  flag.rotateZ(-0.5);
  flag.translate(0.33, 0.66, 0);
  const g = mergeGeometries([head, stem, flag])!;
  const b = g.clone().rotateY(Math.PI / 2);
  return mergeGeometries([g, b])!;
}

/** Silhueta do cavalo do xadrez (centrada, ~1 de altura). */
export function knightShape() {
  const s = new THREE.Shape();
  s.moveTo(0.12, 0);
  s.lineTo(0.88, 0);
  s.lineTo(0.84, 0.13);
  s.lineTo(0.72, 0.17);
  s.quadraticCurveTo(0.8, 0.5, 0.76, 0.72);
  s.quadraticCurveTo(0.7, 0.95, 0.52, 1.02);
  s.lineTo(0.5, 1.12);
  s.lineTo(0.4, 1.0);
  s.quadraticCurveTo(0.22, 0.92, 0.08, 0.66);
  s.quadraticCurveTo(0.06, 0.56, 0.16, 0.54);
  s.lineTo(0.34, 0.6);
  s.quadraticCurveTo(0.42, 0.58, 0.44, 0.52);
  s.quadraticCurveTo(0.24, 0.38, 0.3, 0.17);
  s.lineTo(0.16, 0.13);
  s.closePath();
  return s;
}

export function knightGeo(depth = 0) {
  const g = depth > 0
    ? new THREE.ExtrudeGeometry(knightShape(), { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 })
    : new THREE.ShapeGeometry(knightShape(), 8);
  g.translate(-0.5, -0.55, 0);
  return g;
}

/** Brilhos que piscam em pontos fixos de um objeto (ex.: corrente, lâmina). */
export function twinkles(parent: THREE.Object3D, points: THREE.Vector3[], color: string, size: number, speed = 1) {
  const geo = starGeo(1);
  const stars = points.map((p, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p);
    m.userData.phase = i * 2.39;
    parent.add(m);
    return m;
  });
  return (t: number) => {
    for (const s of stars) {
      const k = Math.max(0, Math.sin(t * 2.2 * speed + s.userData.phase)) ** 10;
      s.scale.setScalar(Math.max(0.0001, k * size));
      s.rotation.z = t * 1.5;
    }
  };
}

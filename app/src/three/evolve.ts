import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { knightGeo, starGeo } from './fx';

/**
 * "Evolução" de cada boneco: roupa nova, mais detalhada, liberada junto com o item especial.
 * As peças são presas às mesmas articulações do boneco (tronco, braços, pernas, cabeça),
 * então acompanham todas as animações. Peças soltas (tabardo, cachecol, capa) seguem as
 * pernas e o movimento para não atravessar o corpo.
 */
export type EvoId =
  | 'outfit_varsity'
  | 'outfit_dj'
  | 'outfit_luxury'
  | 'outfit_fire_master'
  | 'outfit_shadow'
  | 'outfit_archmage'
  | 'outfit_emperor'
  | 'outfit_mk2'
  | 'outfit_commander'
  | 'outfit_paladin';

export interface EvoRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  skirt: THREE.Group | null;
  cape: THREE.Group | null;
  chestW: number;
  waistW: number;
  armT: number;
  pantsW: number;
  front: number;
  HW: number;
  HH: number;
  HD: number;
}

type Fx = (t: number, dt: number) => void;

const PI = Math.PI;
const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0, ...o });
const emis = (color: string, intensity = 1) => mat(color, { emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.25 });
const glowMat = (color: string, opacity = 0.85) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const gold = () => mat('#ffc83d', { metalness: 0.55, roughness: 0.26, emissive: new THREE.Color('#ffb300'), emissiveIntensity: 0.12 });
const silver = () => mat('#dfe6ea', { metalness: 0.6, roughness: 0.22 });
const block = (w: number, h: number, d: number, r: number) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Chama estilizada (decalque) para estampar roupa. */
function flameDecal(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  const n = 4;
  for (let i = n; i >= 0; i--) {
    const x = -w / 2 + (w * i) / n;
    const peak = h * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.3)));
    s.lineTo(x + w / (2 * n), peak);
    s.lineTo(x, h * 0.3);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export function addEvolution(r: EvoRig, id: EvoId): Fx | null {
  const { chestW, waistW, armT, pantsW, front, HW, HH, HD } = r;
  const fx: Fx[] = [];
  // Geometria do tronco (afina na cintura): largura e frente numa altura y do tronco.
  const tw = (y: number) => waistW + (chestW - waistW) * THREE.MathUtils.clamp((y - 0.1) / 1.95, 0, 1);
  const fz = (y: number) => ((1.02 * (0.92 + 0.08 * THREE.MathUtils.clamp((y - 0.1) / 1.95, 0, 1))) / 2) + 0.005;
  const slant = Math.atan2((chestW - waistW) / 2, 1.95);

  /** Placa na frente do peito. */
  const chest = (w: number, h: number, y: number, m: THREE.Material, x = 0, d = 0.08, rr = 0.04) => {
    const o = mesh(block(w, h, d, rr), m, x, y, fz(y) + d / 2 - 0.01);
    r.spine.add(o);
    return o;
  };
  /** Faixa ao redor do tronco numa altura. */
  const band = (y: number, h: number, m: THREE.Material, extra = 0.06) => {
    const o = mesh(block(tw(y) + extra, h, fz(y) * 2 + extra, 0.05), m, 0, y, 0);
    r.spine.add(o);
    return o;
  };
  /** Costuras/frisos inclinados nas laterais da frente do tronco. */
  const seams = (m: THREE.Material, inset = 0.06, w = 0.05) => {
    for (const s of [-1, 1]) {
      const o = mesh(block(w, 1.9, 0.03, 0.01), m, s * ((chestW + waistW) / 4 - inset), 1.07, fz(1.07) + 0.012);
      o.rotation.z = -s * slant;
      r.spine.add(o);
    }
  };
  const sleeve = (m: THREE.Material, upper = true, fore = true, extra = 0.04) => {
    for (const [sh, el] of [[r.shoulderL, r.elbowL], [r.shoulderR, r.elbowR]]) {
      if (upper) sh.add(mesh(block(armT + extra, 1.0, armT + extra, 0.24), m, 0, -0.45, 0), mesh(block(armT + 0.08 + extra, 0.6, armT + 0.06 + extra, 0.28), m, 0, -0.08, 0));
      if (fore) el.add(mesh(block(armT * 0.92 + extra, 0.74, armT * 0.92 + extra, 0.22), m, 0, -0.36, 0), mesh(block(armT * 0.94 + extra, 0.4, armT * 0.94 + extra, 0.18), m));
    }
  };
  const cuff = (m: THREE.Material, y = -0.66, h = 0.14, extra = 0.08) => {
    for (const el of [r.elbowL, r.elbowR]) el.add(mesh(block(armT * 0.92 + extra, h, armT * 0.92 + extra, 0.05), m, 0, y, 0));
  };
  const pauldron = (m: THREE.Material, trim: THREE.Material, layers = 2, spikes = false) => {
    [r.shoulderL, r.shoulderR].forEach((sh, i) => {
      const side = i ? 1 : -1;
      const g = new THREE.Group();
      g.position.set(side * 0.06, 0.12, 0);
      g.rotation.z = side * -0.28;
      for (let k = 0; k < layers; k++) {
        const w = armT + 0.42 - k * 0.12;
        g.add(mesh(block(w, 0.22, armT + 0.38 - k * 0.1, 0.1), m, side * k * 0.06, -k * 0.2, 0));
        g.add(mesh(block(w + 0.04, 0.06, armT + 0.42 - k * 0.1, 0.03), trim, side * k * 0.06, -k * 0.2 - 0.1, 0));
      }
      if (spikes) for (const z of [-0.22, 0, 0.22]) g.add(mesh(new THREE.ConeGeometry(0.08, 0.32, 6), trim, side * 0.12, 0.22, z));
      sh.add(g);
    });
  };
  const bracer = (m: THREE.Material, trim: THREE.Material, glow?: THREE.Material) => {
    for (const el of [r.elbowL, r.elbowR]) {
      el.add(mesh(block(armT + 0.12, 0.5, armT + 0.12, 0.1), m, 0, -0.42, 0));
      for (const y of [-0.2, -0.64]) el.add(mesh(block(armT + 0.16, 0.06, armT + 0.16, 0.03), trim, 0, y, 0));
      if (glow) el.add(mesh(block(0.06, 0.3, 0.04, 0.02), glow, 0, -0.42, armT / 2 + 0.07));
    }
  };
  const greave = (m: THREE.Material, trim: THREE.Material, glow?: THREE.Material) => {
    for (const kn of [r.kneeL, r.kneeR]) {
      kn.add(mesh(block(pantsW + 0.1, 0.7, 0.3, 0.1), m, 0, -0.38, 0.36));
      kn.add(mesh(block(pantsW * 0.8, 0.32, 0.26, 0.12), trim, 0, 0.02, 0.4));
      if (glow) kn.add(mesh(block(0.06, 0.45, 0.04, 0.02), glow, 0, -0.4, 0.53));
    }
  };
  const gauntlet = (m: THREE.Material, trim: THREE.Material) => {
    for (const h of [r.handL, r.handR]) {
      h.add(mesh(block(armT * 0.94, 0.56, armT * 0.98, 0.2), m, 0, 0.0, 0));
      h.add(mesh(block(armT * 1.02, 0.12, armT * 1.04, 0.04), trim, 0, 0.26, 0));
    }
  };
  /** Painel solto na frente do quadril (tabardo/faixa) que acompanha a perna que vai à frente. */
  const frontPanel = (w: number, h: number, m: THREE.Material, trim?: THREE.Material, emblem?: THREE.Object3D) => {
    const g = new THREE.Group();
    g.position.set(0, 0.0, front - 0.02);
    g.add(mesh(block(w, h, 0.06, 0.04), m, 0, -h / 2, 0.04));
    if (trim) {
      g.add(mesh(block(w + 0.06, 0.06, 0.07, 0.02), trim, 0, -h + 0.02, 0.04));
      for (const s of [-1, 1]) g.add(mesh(block(0.05, h, 0.07, 0.02), trim, s * (w / 2), -h / 2, 0.04));
    }
    if (emblem) g.add(emblem);
    r.pelvis.add(g);
    const back = g.clone();
    back.position.z = -front + 0.02;
    back.rotation.y = PI;
    r.pelvis.add(back);
    fx.push(() => {
      // Vai junto com a coxa que estiver mais à frente/atrás (nunca é atravessado pela perna).
      g.rotation.x = Math.min(0, r.hipL.rotation.x, r.hipR.rotation.x) * 0.95;
      back.rotation.x = -Math.max(0, r.hipL.rotation.x, r.hipR.rotation.x) * 0.95;
    });
  };
  const rookEmblem = (m: THREE.Material, scale = 1) => {
    const g = new THREE.Group();
    g.add(mesh(block(0.4, 0.1, 0.04, 0.02), m, 0, -0.26, 0));
    g.add(mesh(block(0.26, 0.34, 0.04, 0.02), m, 0, -0.04, 0));
    g.add(mesh(block(0.34, 0.08, 0.04, 0.02), m, 0, 0.16, 0));
    for (const x of [-0.12, 0, 0.12]) g.add(mesh(block(0.08, 0.1, 0.04, 0.02), m, x, 0.24, 0));
    g.scale.setScalar(scale);
    return g;
  };

  switch (id) {
    // -------------------------------------------------------------- NOVATO → Campeão (jaqueta universitária)
    case 'outfit_varsity': {
      const cream = mat('#f5ecd7', { roughness: 0.75 });
      const navy = mat('#0d2a5c', { roughness: 0.6 });
      const goldM = mat('#ffc83d', { roughness: 0.5 });
      sleeve(cream);
      // Punhos e barra canelados (listrados)
      for (const el of [r.elbowL, r.elbowR]) {
        el.add(mesh(block(armT * 0.98, 0.2, armT * 0.98, 0.05), navy, 0, -0.66, 0));
        el.add(mesh(block(armT * 1.0, 0.04, armT * 1.0, 0.02), goldM, 0, -0.66, 0));
      }
      band(0.22, 0.24, navy, 0.08);
      band(0.22, 0.05, goldM, 0.1);
      // Gola
      const collar = mesh(block(1.1, 0.2, 0.9, 0.08), navy, 0, 2.02, -0.02);
      r.spine.add(collar, mesh(block(1.12, 0.04, 0.92, 0.02), goldM, 0, 2.02, -0.02));
      // Fecho de botões e letra (cavalo) no peito
      for (let i = 0; i < 5; i++) chest(0.08, 0.08, 0.5 + i * 0.32, mat('#ffffff', { roughness: 0.3 }), 0, 0.04, 0.03);
      chest(0.04, 1.75, 1.07, mat(darker('#1565c0', 0.6)), 0, 0.03, 0.01);
      const patch = chest(0.42, 0.42, 1.5, goldM, -0.27, 0.05, 0.07);
      const kn = mesh(knightGeo(0.03), navy, -0.27, 1.5, patch.position.z + 0.04);
      kn.scale.setScalar(0.33);
      r.spine.add(kn);
      // Medalha de ouro na fita
      const ribbon = mesh(block(0.14, 0.7, 0.03, 0.02), mat('#e53935'), 0.26, 1.6, fz(1.6) + 0.04);
      ribbon.rotation.z = 0.15;
      const medal = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20), gold(), 0.31, 1.2, fz(1.2) + 0.06);
      medal.rotation.x = PI / 2;
      r.spine.add(ribbon, medal);
      // Tênis cano alto
      for (const kn2 of [r.kneeL, r.kneeR]) kn2.add(mesh(block(pantsW * 0.98, 0.36, 0.92, 0.12), mat('#ffffff'), 0, -0.68, 0.02), mesh(block(pantsW, 0.06, 0.94, 0.02), goldM, 0, -0.56, 0.02));
      return (t) => {
        medal.rotation.y = Math.sin(t * 2) * 0.4;
      };
    }

    // -------------------------------------------------------------- ESTILOSO → DJ Neon
    case 'outfit_dj': {
      const neon = emis('#00e676', 1);
      const blk = mat('#121317', { roughness: 0.6 });
      seams(neon, 0.08, 0.04);
      band(0.22, 0.04, neon, 0.1);
      // Logo neon por cima do logo
      const logo = mesh(knightGeo(), neon, 0, 1.12, fz(1.12) + 0.05);
      logo.scale.setScalar(0.56);
      r.spine.add(logo);
      // Linhas neon nas mangas e na lateral da calça
      for (const el of [r.elbowL, r.elbowR]) for (const y of [-0.22, -0.36]) el.add(mesh(block(armT * 0.97, 0.045, armT * 0.97, 0.02), neon, 0, y, 0));
      for (const [hip, kn] of [[r.hipL, r.kneeL], [r.hipR, r.kneeR]]) {
        const s = hip.position.x < 0 ? -1 : 1;
        hip.add(mesh(block(0.04, 1.0, 0.06, 0.02), neon, s * (pantsW / 2 + 0.005), -0.52, 0));
        kn.add(mesh(block(0.04, 0.8, 0.06, 0.02), neon, s * (pantsW * 0.46 + 0.005), -0.4, 0));
        kn.add(mesh(block(1.0, 0.05, 1.24, 0.02), neon, 0, -0.95, 0.06)); // sola neon
      }
      // Luvas sem dedo
      for (const h of [r.handL, r.handR]) {
        h.add(mesh(block(armT * 0.9, 0.3, armT * 0.94, 0.1), blk, 0, 0.12, 0));
        h.add(mesh(block(armT * 0.92, 0.04, armT * 0.96, 0.02), neon, 0, -0.02, 0));
      }
      // Corrente de carteira no quadril
      const pts = Array.from({ length: 12 }, (_, i) => {
        const u = i / 11;
        return V(0.75 + Math.sin(u * PI) * 0.12, 0.05 - Math.sin(u * PI) * 0.55, 0.3 - u * 0.75);
      });
      const chainGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 5);
      r.pelvis.add(mesh(chainGeo, silver()));
      const col = new THREE.Color();
      return (t) => {
        col.setHSL((t * 0.12) % 1, 1, 0.55);
        neon.color.copy(col);
        neon.emissive.copy(col);
        neon.emissiveIntensity = 0.8 + Math.abs(Math.sin(t * 4)) * 0.5;
      };
    }

    // -------------------------------------------------------------- DESCOLADO → Milionário
    case 'outfit_luxury': {
      const goldM = gold();
      // Frisos de ouro nas lapelas, punhos e barra
      for (const s of [-1, 1]) {
        const lap = mesh(block(0.06, 1.75, 0.04, 0.02), goldM, s * 0.45, 1.05, fz(1.05) + 0.03);
        r.spine.add(lap);
      }
      band(0.15, 0.06, goldM, 0.08);
      cuff(goldM, -0.64, 0.08, 0.1);
      // Botões de ouro e lenço no bolso
      for (const y of [0.5, 0.85]) for (const s of [-1, 1]) r.spine.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), goldM, s * 0.55, y, fz(y) + 0.02));
      const pocket = chest(0.42, 0.06, 1.55, goldM, 0.62, 0.04, 0.02);
      const hanky = new THREE.Shape();
      hanky.moveTo(-0.16, 0);
      hanky.lineTo(-0.1, 0.18);
      hanky.lineTo(0, 0.08);
      hanky.lineTo(0.08, 0.2);
      hanky.lineTo(0.16, 0);
      r.spine.add(mesh(new THREE.ShapeGeometry(hanky), mat('#e91e63'), 0.62, 1.56, pocket.position.z + 0.02));
      // Ombreiras de veludo com tachas
      for (const sh of [r.shoulderL, r.shoulderR]) {
        for (let i = 0; i < 4; i++) sh.add(mesh(new THREE.OctahedronGeometry(0.05), mat('#e0f7fa', { roughness: 0.05, emissive: new THREE.Color('#b2ebf2'), emissiveIntensity: 0.5 }), (i - 1.5) * 0.18, 0.22, 0));
      }
      // Brinco de diamante e tênis dourado com sola branca
      const ear = mesh(new THREE.OctahedronGeometry(0.06), mat('#e0f7fa', { roughness: 0.05, emissive: new THREE.Color('#b2ebf2'), emissiveIntensity: 0.8 }), -HW / 2 - 0.03, -0.12, 0);
      r.head.add(ear);
      for (const kn of [r.kneeL, r.kneeR]) kn.add(mesh(block(0.9, 0.07, 1.1, 0.03), goldM, 0, -0.8, 0.08));
      return (t) => {
        ear.rotation.y = t * 2;
      };
    }

    // -------------------------------------------------------------- LUTADOR → Mestre do Fogo
    case 'outfit_fire_master': {
      const ember = emis('#ff6d00', 0.9);
      const red = mat('#c62828', { roughness: 0.5 });
      const obsidian = mat('#211a1a', { roughness: 0.3, metalness: 0.4 });
      // Chamas estampadas nas barras da calça e das mangas
      const decals: THREE.Mesh[] = [];
      for (const kn of [r.kneeL, r.kneeR]) {
        for (const [rotY, z, x] of [[0, pantsW * 0.46, 0], [PI, -pantsW * 0.46, 0], [PI / 2, 0, pantsW * 0.49], [-PI / 2, 0, -pantsW * 0.49]] as [number, number, number][]) {
          const d = mesh(flameDecal(pantsW * 0.88, 0.5), ember, x, -0.8, z + Math.sign(z) * 0.01);
          d.rotation.y = rotY;
          kn.add(d);
          decals.push(d);
        }
      }
      for (const sh of [r.shoulderL, r.shoulderR]) {
        for (const [rotY, z] of [[0, 1], [PI, -1]] as [number, number][]) {
          const d = mesh(flameDecal(armT + 0.12, 0.34), ember, 0, -1.0, z * ((armT + 0.14) / 2 + 0.11));
          d.rotation.y = rotY;
          sh.add(d);
          decals.push(d);
        }
      }
      // Lapelas vermelhas com friso dourado
      for (const s of [-1, 1]) {
        const lap = mesh(block(0.22, 1.42, 0.04, 0.02), red, s * 0.32, 1.42, front + 0.1);
        lap.rotation.z = -s * 0.5;
        const edge = mesh(block(0.04, 1.42, 0.05, 0.01), gold(), s * 0.42, 1.42, front + 0.11);
        edge.rotation.z = -s * 0.5;
        r.spine.add(lap, edge);
      }
      // Ombreira de obsidiana com fissuras de lava (só no ombro esquerdo)
      const p = new THREE.Group();
      p.position.set(-0.08, 0.16, 0);
      p.rotation.z = 0.3;
      p.add(mesh(block(armT + 0.44, 0.3, armT + 0.36, 0.12), obsidian));
      for (const z of [-0.25, 0, 0.25]) p.add(mesh(new THREE.ConeGeometry(0.09, 0.4, 5), obsidian, -0.1, 0.3, z));
      for (const z of [-0.12, 0.14]) p.add(mesh(block(0.5, 0.03, 0.03, 0.01), ember, 0, 0.16, z));
      r.shoulderL.add(p);
      // Pontas douradas na faixa da cintura
      for (const s of [-1, 1]) {
        const tip = mesh(block(0.17, 0.12, 0.08, 0.03), gold(), s * 0.18, -0.3, front + 0.1);
        r.spine.add(tip);
      }
      // Pontas do cabelo em brasa
      const tips: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        const m = mesh(new THREE.ConeGeometry(0.1, 0.25, 4), ember, Math.sin(a) * 0.4, HH / 2 + 0.55 + Math.cos(a * 2) * 0.1, Math.cos(a) * 0.35 - 0.15);
        m.rotation.x = -0.5 + Math.cos(a) * 0.4;
        r.head.add(m);
        tips.push(m);
      }
      return (t) => {
        ember.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 6)) * 0.6;
        decals.forEach((d, i) => (d.scale.y = 0.9 + Math.abs(Math.sin(t * 8 + i)) * 0.25));
      };
    }

    // -------------------------------------------------------------- NINJA → Sombra Elétrica
    case 'outfit_shadow': {
      const plate = mat('#2b2f38', { metalness: 0.6, roughness: 0.3 });
      const volt = emis('#00e5ff', 1.1);
      pauldron(plate, volt, 2);
      bracer(plate, volt, volt);
      greave(plate, plate, volt);
      // Arnês com fivela elétrica
      for (const s of [-1, 1]) {
        const strap = mesh(block(0.14, 2.1, 0.05, 0.02), plate, s * 0.0, 1.05, fz(1.05) + 0.03);
        strap.rotation.z = s * 0.55;
        r.spine.add(strap);
      }
      const buckle = chest(0.3, 0.3, 1.05, plate, 0, 0.08, 0.06);
      r.spine.add(mesh(new THREE.OctahedronGeometry(0.1), volt, 0, 1.05, buckle.position.z + 0.06));
      // Faixa dos olhos brilhando
      r.head.add(mesh(block(HW + 0.12, 0.05, HD + 0.12, 0.02), volt, 0, -0.08, 0));
      // Cachecol longo que voa com o movimento
      const scarfM = mat('#0f3d4a', { roughness: 0.8 });
      r.neck.add(mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 20), scarfM, 0, 0.05, 0).rotateX(PI / 2));
      const tails: THREE.Group[] = [];
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * 0.2, 0.02, -0.66);
        let parent: THREE.Group = g;
        for (let k = 0; k < 4; k++) {
          const seg = new THREE.Group();
          seg.position.y = k ? -0.42 : 0;
          seg.add(mesh(block(0.3, 0.44, 0.06, 0.03), scarfM, 0, -0.21, 0));
          if (k === 3) seg.add(mesh(block(0.3, 0.05, 0.07, 0.02), volt, 0, -0.42, 0));
          parent.add(seg);
          parent = seg;
        }
        r.neck.add(g);
        tails.push(g);
      }
      const np = V();
      const last = V();
      let first = true;
      let sw = 0;
      return (t, dt) => {
        volt.emissiveIntensity = 0.8 + Math.abs(Math.sin(t * 13)) * 0.5 * (Math.sin(t * 3) > 0.6 ? 1 : 0.3);
        r.neck.getWorldPosition(np);
        if (first) last.copy(np);
        first = false;
        const v = np.distanceTo(last) / Math.max(dt, 1 / 120);
        last.copy(np);
        sw += (Math.min(1.3, v * 0.25) - sw) * Math.min(1, dt * 5);
        tails.forEach((g, i) => {
          let seg = g as THREE.Object3D;
          for (let k = 0; k < 4; k++) {
            seg.rotation.x = (k ? 0.12 : 0.35) + sw * (k ? 0.3 : 0.6) + Math.sin(t * 6 - k * 0.9 + i) * (0.08 + sw * 0.12);
            seg = seg.children.find((c) => c instanceof THREE.Group) ?? seg;
          }
          g.rotation.z = (i ? 1 : -1) * 0.12;
        });
      };
    }

    // -------------------------------------------------------------- FEITICEIRO → Arquimago
    case 'outfit_archmage': {
      const goldM = gold();
      const rune = emis('#b388ff', 1);
      // Bordados dourados: barra do manto, punhos largos, faixa da cintura com runas
      if (r.skirt) {
        r.skirt.add(mesh(block(2.0, 0.12, 1.12, 0.04), goldM, 0, -1.36, 0));
        for (let i = 0; i < 8; i++) r.skirt.add(mesh(new THREE.OctahedronGeometry(0.05), rune, -0.9 + i * 0.26, -1.25, -0.52));
      }
      cuff(goldM, -0.62, 0.16, 0.2);
      band(0.3, 0.1, rune, 0.1);
      // Gola alta (mantelete) com estrelas
      const mantle = new THREE.Group();
      mantle.position.y = 1.9;
      mantle.add(mesh(block(chestW + 0.5, 0.34, 1.4, 0.15), mat('#1a237e', { roughness: 0.7 })));
      mantle.add(mesh(block(chestW + 0.54, 0.06, 1.44, 0.03), goldM, 0, -0.16, 0));
      const collar = mesh(block(1.5, 0.55, 0.12, 0.05), mat('#1a237e', { roughness: 0.7 }), 0, 0.3, -0.55);
      collar.rotation.x = -0.2;
      mantle.add(collar, mesh(block(1.54, 0.05, 0.13, 0.02), goldM, 0, 0.56, -0.6));
      const stars = new THREE.Group();
      for (const [x, y, z] of [[-0.8, 0.05, 0.6], [0.7, 0.06, 0.62], [-0.3, 0.07, 0.68], [0.25, 0.08, 0.68]]) {
        const s = mesh(starGeo(0.08), new THREE.MeshBasicMaterial({ color: '#ffd54f', side: THREE.DoubleSide }), x, y, z);
        stars.add(s);
      }
      mantle.add(stars);
      r.spine.add(mantle);
      // Medalhão de runa no peito
      const med = chest(0.36, 0.36, 1.35, goldM, 0, 0.06, 0.16);
      const gem = mesh(new THREE.OctahedronGeometry(0.12), rune, 0, 1.35, med.position.z + 0.07);
      r.spine.add(gem);
      // Auréola de runas flutuando atrás da cabeça
      const halo = new THREE.Group();
      halo.position.set(0, 0.1, -HD / 2 - 0.45);
      halo.add(mesh(new THREE.TorusGeometry(0.85, 0.02, 6, 48), glowMat('#b388ff', 0.8)));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        const b = mesh(block(0.1, 0.16, 0.02, 0.01), glowMat(i % 3 ? '#e1bee7' : '#ffd54f', 0.95), Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
        b.rotation.z = a;
        halo.add(b);
      }
      r.head.add(halo);
      // Barba mais longa e trançada
      const beardTip = mesh(block(0.3, 0.6, 0.2, 0.1), mat('#ececec', { roughness: 0.9 }), 0, -1.12, HD / 2 - 0.12);
      r.head.add(beardTip, mesh(block(0.34, 0.06, 0.22, 0.02), goldM, 0, -0.95, HD / 2 - 0.12));
      return (t) => {
        halo.rotation.z = t * 0.6;
        rune.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 2.5)) * 0.6;
        gem.rotation.y = t * 1.5;
        stars.children.forEach((s, i) => s.scale.setScalar(0.7 + Math.abs(Math.sin(t * 3 + i)) * 0.6));
      };
    }

    // -------------------------------------------------------------- REI → Imperador
    case 'outfit_emperor': {
      const goldM = gold();
      const ruby = emis('#e53935', 0.5);
      // Couraça dourada com emblema e rubi
      const plate = chest(chestW * 0.86, 1.15, 1.42, goldM, 0, 0.14, 0.2);
      r.spine.add(mesh(block(chestW * 0.62, 0.85, 0.05, 0.12), mat('#b71c1c', { roughness: 0.4 }), 0, 1.42, plate.position.z + 0.08));
      const crownE = new THREE.Group();
      crownE.position.set(0, 1.45, plate.position.z + 0.12);
      crownE.add(mesh(block(0.5, 0.14, 0.04, 0.02), goldM, 0, -0.1, 0));
      for (const x of [-0.18, 0, 0.18]) crownE.add(mesh(new THREE.ConeGeometry(0.06, 0.22, 4), goldM, x, 0.07, 0));
      crownE.add(mesh(new THREE.OctahedronGeometry(0.08), ruby, 0, -0.1, 0.04));
      r.spine.add(crownE);
      pauldron(goldM, mat('#b71c1c'), 3);
      bracer(goldM, mat('#b71c1c'));
      greave(goldM, mat('#b71c1c'));
      band(0.3, 0.16, goldM, 0.1);
      for (const x of [-0.5, 0, 0.5]) r.spine.add(mesh(new THREE.OctahedronGeometry(0.07), ruby, x, 0.3, fz(0.3) + 0.1));
      // Correntes da capa atravessando o peito
      const chainPts = [V(-chestW / 2 + 0.1, 1.95, fz(1.9)), V(0, 1.72, fz(1.72) + 0.16), V(chestW / 2 - 0.1, 1.95, fz(1.9))];
      r.spine.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chainPts), 20, 0.03, 6), goldM));
      // Arminho (branco com pintas) na borda da capa
      if (r.cape) {
        const ermine = mat('#fafafa', { roughness: 0.95 });
        r.cape.add(mesh(block(chestW * 1.25 + 0.25, 0.3, 0.16, 0.1), ermine, 0, -2.85, 0.02));
        for (const s of [-1, 1]) r.cape.add(mesh(block(0.24, 2.8, 0.16, 0.08), ermine, s * (chestW * 0.56 + 0.12), -1.45, 0.02).rotateZ(s * 0.05));
        for (let i = 0; i < 9; i++) r.cape.add(mesh(block(0.05, 0.1, 0.03, 0.01), mat('#111'), -1.2 + i * 0.3, -2.85, 0.12));
      }
      // Coroa imperial: arcos e cruz por cima da coroa
      const arches = new THREE.Group();
      arches.position.y = HH / 2 + 0.4;
      for (const ry of [0, PI / 2]) {
        const a = mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24, PI), goldM);
        a.rotation.y = ry;
        a.scale.y = 0.7;
        arches.add(a);
      }
      arches.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), goldM, 0, 0.48, 0));
      arches.add(mesh(block(0.06, 0.3, 0.06, 0.02), goldM, 0, 0.68, 0), mesh(block(0.22, 0.06, 0.06, 0.02), goldM, 0, 0.7, 0));
      arches.add(mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, PI * 2, 0, PI / 2), mat('#8e0000', { roughness: 0.8 }), 0, 0, 0));
      r.head.add(arches);
      return (t) => {
        ruby.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 2)) * 0.4;
      };
    }

    // -------------------------------------------------------------- ROBÔ → Mark II
    case 'outfit_mk2': {
      const line = emis('#18ffff', 1.2);
      const dark = mat('#3b2c00', { metalness: 0.5, roughness: 0.35 });
      seams(line, 0.14, 0.04);
      band(0.55, 0.04, line, 0.08);
      band(1.85, 0.04, line, 0.08);
      // Linhas de energia nos braços e pernas
      for (const sh of [r.shoulderL, r.shoulderR]) sh.add(mesh(block(armT + 0.02, 0.04, armT + 0.02, 0.01), line, 0, -0.75, 0));
      for (const el of [r.elbowL, r.elbowR]) {
        el.add(mesh(new THREE.TorusGeometry(armT * 0.5, 0.04, 6, 20), line, 0, 0, 0).rotateX(PI / 2));
        el.add(mesh(block(0.05, 0.5, 0.04, 0.01), line, 0, -0.38, armT * 0.46 + 0.01));
      }
      for (const kn of [r.kneeL, r.kneeR]) {
        kn.add(mesh(new THREE.TorusGeometry(pantsW * 0.47, 0.045, 6, 20), line, 0, 0, 0).rotateX(PI / 2));
        kn.add(mesh(block(0.05, 0.55, 0.04, 0.01), line, 0, -0.4, pantsW * 0.43));
      }
      // Anel girando em volta do núcleo do peito
      const coreRing = mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 28), mat('#ffd54f', { metalness: 0.6, roughness: 0.25 }), 0, 1.3, front + 0.08);
      const coreGlow = mesh(new THREE.CircleGeometry(0.55, 24), glowMat('#18ffff', 0.25), 0, 1.3, front + 0.07);
      r.spine.add(coreRing, coreGlow);
      // Propulsores nos ombros
      for (const sh of [r.shoulderL, r.shoulderR]) {
        const tp = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 14), dark, 0, 0.3, -0.25);
        tp.rotation.x = -0.4;
        sh.add(tp, mesh(new THREE.CircleGeometry(0.13, 14), glowMat('#18ffff', 0.8), 0, 0.5, -0.33).rotateX(-PI / 2 - 0.4));
      }
      // Scanner que corre pelo visor e antena dupla
      const scan = mesh(block(0.14, 0.34, 0.04, 0.02), glowMat('#ff3d00', 0.95), 0, 0.1, HD / 2 + 0.11);
      r.head.add(scan);
      r.head.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), dark, -0.3, HH / 2 + 0.2, 0));
      const tip2 = mesh(new THREE.SphereGeometry(0.08, 10, 8), emis('#18ffff', 1.4), -0.3, HH / 2 + 0.45, 0);
      r.head.add(tip2);
      return (t) => {
        coreRing.rotation.z = t * 2;
        coreRing.rotation.y = Math.sin(t) * 0.4;
        (coreGlow.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.abs(Math.sin(t * 3)) * 0.2;
        scan.position.x = Math.sin(t * 3) * 0.42;
        line.emissiveIntensity = 0.9 + Math.sin(t * 5) * 0.3;
        tip2.visible = Math.sin(t * 5) > -0.3;
      };
    }

    // -------------------------------------------------------------- ASTRONAUTA → Comandante
    case 'outfit_commander': {
      const blue = mat('#1e88e5', { roughness: 0.45 });
      const goldM = gold();
      // Faixas azuis, emblemas e estrelas de comandante
      for (const sh of [r.shoulderL, r.shoulderR]) sh.add(mesh(block(armT + 0.06, 0.12, armT + 0.06, 0.03), blue, 0, -0.55, 0));
      for (const hip of [r.hipL, r.hipR]) hip.add(mesh(block(pantsW + 0.04, 0.12, 0.94, 0.03), blue, 0, -0.75, 0));
      const patch = new THREE.Group();
      patch.position.set(0.55, 1.65, fz(1.65) + 0.03);
      patch.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24), mat('#0d47a1')).rotateX(PI / 2));
      patch.add(mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 24), goldM));
      const st = mesh(starGeo(0.12, 0.4), new THREE.MeshBasicMaterial({ color: '#ffd54f', side: THREE.DoubleSide }), 0, 0, 0.03);
      patch.add(st);
      r.spine.add(patch);
      for (let i = 0; i < 3; i++) r.spine.add(mesh(starGeo(0.07, 0.4), new THREE.MeshBasicMaterial({ color: '#ffd54f', side: THREE.DoubleSide }), -0.7 + i * 0.18, 1.78, fz(1.78) + 0.02));
      // Bandeira no ombro (listras)
      r.shoulderL.add(mesh(block(0.05, 0.3, 0.42, 0.02), mat('#ffffff'), -armT / 2 - 0.02, -0.3, 0));
      for (let i = 0; i < 3; i++) r.shoulderL.add(mesh(block(0.06, 0.05, 0.42, 0.01), mat('#e53935'), -armT / 2 - 0.02, -0.18 - i * 0.1, 0));
      // Tubos de oxigênio da mochila até o painel do peito
      for (const s of [-1, 1]) {
        const pts = [V(s * 0.55, 1.75, -0.9), V(s * (chestW / 2 + 0.15), 1.6, 0), V(s * 0.42, 1.38, fz(1.38) + 0.1)];
        r.spine.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.06, 8), mat('#90a4ae', { roughness: 0.4 })));
        for (let k = 0; k < 4; k++) {
          const u = 0.2 + k * 0.2;
          const p = new THREE.CatmullRomCurve3(pts).getPoint(u);
          r.spine.add(mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), mat('#546e7a'), p.x, p.y, p.z).rotateY(PI / 2));
        }
      }
      // Computador de pulso com tela
      const wrist = new THREE.Group();
      wrist.position.set(0, -0.5, armT / 2 + 0.06);
      wrist.add(mesh(block(0.48, 0.36, 0.1, 0.04), mat('#37474f')));
      const screen = mesh(new THREE.PlaneGeometry(0.38, 0.26), new THREE.MeshBasicMaterial({ color: '#00e5ff' }), 0, 0, 0.06);
      wrist.add(screen);
      const bars: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const b = mesh(new THREE.PlaneGeometry(0.05, 0.16), new THREE.MeshBasicMaterial({ color: '#00363d' }), -0.12 + i * 0.08, 0, 0.065);
        wrist.add(b);
        bars.push(b);
      }
      r.elbowL.add(wrist);
      // Luzes extras piscando no painel do peito
      const lights: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const l = mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff'][i] }), -0.3 + i * 0.2, 1.08, fz(1.08) + 0.12);
        r.spine.add(l);
        lights.push(l);
      }
      // Botas com sola azul
      for (const kn of [r.kneeL, r.kneeR]) kn.add(mesh(block(1.0, 0.1, 1.22, 0.04), blue, 0, -0.99, 0.06));
      return (t) => {
        lights.forEach((l, i) => (l.visible = Math.sin(t * 4 + i * 1.7) > -0.2));
        bars.forEach((b, i) => (b.scale.y = 0.3 + Math.abs(Math.sin(t * 5 + i)) * 0.9));
        st.rotation.z = t;
      };
    }

    // -------------------------------------------------------------- GUARDIÃO → Paladino
    case 'outfit_paladin': {
      const goldM = gold();
      const steelM = silver();
      const holy = emis('#40c4ff', 1);
      pauldron(steelM, goldM, 3);
      bracer(steelM, goldM);
      greave(steelM, goldM);
      gauntlet(steelM, goldM);
      // Frisos dourados na couraça e gema azul
      for (const s of [-1, 1]) {
        const e = mesh(block(0.06, 1.2, 0.05, 0.02), goldM, s * chestW * 0.43, 1.4, fz(1.4) + 0.2);
        e.rotation.z = -s * 0.1;
        r.spine.add(e);
      }
      r.spine.add(mesh(block(chestW * 0.86, 0.06, 0.05, 0.02), goldM, 0, 1.98, fz(1.98) + 0.2));
      const gem = mesh(new THREE.OctahedronGeometry(0.14), holy, 0, 1.55, fz(1.55) + 0.26);
      const gemGlow = mesh(new THREE.CircleGeometry(0.35, 20), glowMat('#40c4ff', 0.3), 0, 1.55, fz(1.55) + 0.24);
      r.spine.add(gem, gemGlow);
      // Tabardo azul com torre dourada (segue as pernas)
      const emblem = rookEmblem(goldM, 0.9);
      emblem.position.set(0, -0.42, 0.09);
      frontPanel(0.8, 0.95, mat('#1565c0', { roughness: 0.6 }), goldM, emblem);
      // Borda dourada da capa e pluma maior
      if (r.cape) {
        r.cape.add(mesh(block(chestW * 1.25 + 0.2, 0.1, 0.13, 0.03), goldM, 0, -2.88, 0));
        for (const s of [-1, 1]) r.cape.add(mesh(block(0.08, 2.85, 0.13, 0.03), goldM, s * (chestW * 0.6 + 0.08), -1.44, 0).rotateZ(s * 0.06));
      }
      const plume = new THREE.Group();
      plume.position.set(0, HH / 2 + 0.35, 0);
      for (let i = 0; i < 5; i++) {
        const f = mesh(block(0.2, 0.7, 0.24, 0.1), mat(i % 2 ? '#ffffff' : '#1565c0', { roughness: 0.9 }), 0, 0.1 + Math.sin((i / 4) * PI) * 0.25, 0.35 - i * 0.22);
        f.rotation.x = -0.5 - i * 0.2;
        plume.add(f);
      }
      r.head.add(plume);
      return (t) => {
        holy.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 2)) * 0.6;
        (gemGlow.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.abs(Math.sin(t * 2)) * 0.25;
        gem.rotation.y = t * 1.5;
      };
    }
  }
  return fx.length ? (t, dt) => fx.forEach((f) => f(t, dt)) : null;

  function darker(hex: string, k: number) {
    return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  }
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterStyle } from '../lib/types';
import type { Avatar } from './avatar';
import { disposeTree } from './avatar';
import { addGear, type GearId } from './gear';
import { addEvolution, type EvoId } from './evolve';

/**
 * Boneco 3D "v2": ainda em blocos, mas com cara de gente — ombros mais largos que a cintura,
 * peças arredondadas e afinadas, mãos, sobrancelhas, cabelo em mechas e roupas especiais
 * (moletom, kimono, ninja, manto real, traje espacial, armadura...).
 * Mantém o mesmo esqueleto do modelo antigo (avatar.ts), então todas as animações continuam valendo.
 * Medidas em "studs": pés em y=0, altura ~5,4; o boneco olha para +z.
 */

/** Aparência completa: o estilo do boneco (catálogo) + roupa evoluída e item especial. */
export type Look2 = CharacterStyle & {
  /** Itens especiais equipados (ver gear.ts). */
  gear?: GearId[];
  /** Roupa evoluída (ver evolve.ts). */
  evolution?: EvoId;
};

/**
 * Catálogos antigos (em cache no aparelho ou servidor desatualizado) usam o formato antigo
 * do boneco (shirt/hat). Converte para o novo para nunca quebrar o desenho.
 */
export function normalizeLook(style: unknown): CharacterStyle {
  const s = (style ?? {}) as Record<string, string | undefined>;
  if (s.outfit && s.headwear) return style as CharacterStyle;
  const hatMap: Record<string, CharacterStyle['headwear']> = { cap: 'cap', crown: 'crown', tophat: 'wizard', helmet: 'helmet', headband: 'headband' };
  return {
    skin: s.skin ?? '#f2c18f',
    hair: s.hat === 'hair' ? 'swoop' : s.hat === 'none' || !s.hat ? 'swoop' : 'buzz',
    hairColor: s.hat === 'hair' ? (s.hatColor ?? '#5d3a1a') : '#3b2a20',
    outfit: 'tee',
    top: s.shirt ?? '#1e88e5',
    accent: '#ffffff',
    pants: s.pants ?? '#3b5f8a',
    shoes: s.shoes ?? '#e53935',
    headwear: hatMap[s.hat ?? ''] ?? 'none',
    headwearColor: s.hatColor ?? '#000000',
    face: (['smile', 'grin', 'shades', 'mask', 'visor'].includes(s.face ?? '') ? s.face : 'smile') as CharacterStyle['face'],
  };
}

export interface Avatar2 extends Avatar {
  /** Movimento secundário: piscar, cabelo/faixa/capa balançando. Chamar a cada quadro, depois de applyPose. */
  tick(t: number, dt: number): void;
}

const PELVIS_Y = 2.05;

const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.58, metalness: 0, ...o });

const darker = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

/** Caixa arredondada que afina de baixo para cima (ou o contrário). */
function block(w: number, h: number, d: number, r: number, taper: { top?: number; bottom?: number; topZ?: number; bottomZ?: number } = {}) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const { top = 1, bottom = 1, topZ = 1, bottomZ = 1 } = taper;
  if (top !== 1 || bottom !== 1 || topZ !== 1 || bottomZ !== 1) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = (p.getY(i) + h / 2) / h;
      p.setX(i, p.getX(i) * (bottom + (top - bottom) * k));
      p.setZ(i, p.getZ(i) * (bottomZ + (topZ - bottomZ) * k));
    }
    g.computeVertexNormals();
  }
  return g;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};

/** Silhueta do cavalo do xadrez (logo do moletom). */
function knightShape() {
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
  const g = new THREE.ShapeGeometry(s, 8);
  g.translate(-0.5, -0.55, 0);
  return g;
}

export function buildAvatar2(input: Look2): Avatar2 {
  const look: Look2 = { ...normalizeLook(input), gear: input.gear, evolution: input.evolution };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = PELVIS_Y;
  body.add(pelvis);
  const spine = new THREE.Group();
  pelvis.add(spine);

  const metal = look.outfit === 'robot';
  const skin = metal ? mat(look.skin, { metalness: 0.35, roughness: 0.3 }) : mat(look.skin, { roughness: 0.5 });
  const top = mat(look.top, metal ? { metalness: 0.35, roughness: 0.32 } : {});
  const topDark = mat(darker(look.top, 0.72), metal ? { metalness: 0.35, roughness: 0.32 } : {});
  const accent = mat(look.accent);
  const pants = mat(look.pants, metal ? { metalness: 0.35, roughness: 0.32 } : { roughness: 0.7 });
  const shoes = mat(look.shoes, metal ? { metalness: 0.35, roughness: 0.35 } : {});
  const sole = mat(look.sole ?? '#f4f4f4');
  const ink = mat('#17171c', { roughness: 0.35 });
  const white = mat('#ffffff', { roughness: 0.3 });
  const stone = mat('#5d6166', { roughness: 0.85 });
  const stoneLight = mat('#868b91', { roughness: 0.85 });

  const strong = !!look.strong;
  const chestW = strong ? 2.35 : 2.0;
  const waistW = strong ? 1.72 : 1.7;
  const armT = strong ? 0.92 : 0.8; // espessura do braço
  const shoulderX = chestW / 2 + armT / 2 + 0.02;
  const longSleeve = ['hoodie', 'ninja', 'space', 'robot', 'robe', 'armor', 'jacket', 'royal'].includes(look.outfit);
  const wideSleeve = look.outfit === 'gi' || look.outfit === 'robe';

  // ---------------------------------------------------------------- pernas
  const pantsW = look.outfit === 'gi' ? 0.96 : 0.86;
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.47, -0.02, 0);
    const thigh = mesh(block(pantsW, 1.08, 0.9, 0.24, { top: 1.04, bottom: 0.9 }), pants, 0, -0.52, 0);
    const knee = new THREE.Group();
    knee.position.y = -1.02;
    const cap = mesh(block(pantsW * 0.92, 0.44, 0.84, 0.2), pants);
    const shin = mesh(block(pantsW * 0.92, 0.82, 0.82, 0.22, { top: 1, bottom: 0.9 }), pants, 0, -0.4, 0);
    knee.add(cap, shin);
    if (look.ripped) {
      // Rasgos da calça: frestas de pele com borda desfiada.
      for (const [g, y, w, rz] of [
        [thigh, -0.35, 0.42, 0.12 * side],
        [knee, -0.12, 0.5, -0.08 * side],
        [knee, -0.42, 0.34, 0.15 * side],
      ] as [THREE.Object3D, number, number, number][]) {
        const tear = mesh(block(w, 0.1, 0.05, 0.04), skin, 0.02 * side, y, 0.44);
        for (const dx of [-w / 4, w / 6]) g.add(mesh(block(0.03, 0.14, 0.02, 0.01), white, 0.02 * side + dx, y, 0.465));
        tear.rotation.z = rz;
        const fray = mesh(block(w + 0.06, 0.15, 0.03, 0.05), mat('#3a3a40', { roughness: 0.95 }), 0.02 * side, y, 0.43);
        fray.rotation.z = rz;
        g.add(fray, tear);
      }
    }
    // Calçado
    const foot = new THREE.Group();
    foot.position.set(0, -0.86, 0.06);
    if (look.outfit === 'gi' || look.outfit === 'ninja') {
      // Pés de lutador: sem tênis (gi) ou tabi (ninja).
      const f = mesh(block(0.78, 0.3, 1.06, 0.12), look.outfit === 'gi' ? skin : shoes, 0, 0.02, 0.05);
      foot.add(f);
    } else if (look.outfit === 'space' || look.outfit === 'armor' || look.outfit === 'robot') {
      foot.add(mesh(block(0.98, 0.42, 1.2, 0.16, { top: 0.9 }), shoes, 0, 0.06, 0.06));
      foot.add(mesh(block(1.0, 0.12, 1.24, 0.05), metal ? topDark : ink, 0, -0.12, 0.06));
    } else {
      foot.add(mesh(block(0.98, 0.16, 1.22, 0.07), sole, 0, -0.1, 0.06));
      foot.add(mesh(block(0.88, 0.3, 1.08, 0.15, { top: 0.88 }), shoes, 0, 0.1, 0.02));
      foot.add(mesh(block(0.9, 0.08, 0.32, 0.04), sole, 0, -0.02, 0.56)); // biqueira
      for (const z of [0.18, 0.34]) foot.add(mesh(block(0.42, 0.04, 0.08, 0.02), white, 0, 0.27, z)); // cadarço
    }
    knee.add(foot);
    if (look.bracers) {
      // Caneleira de pedra
      const guard = mesh(block(pantsW + 0.08, 0.72, 0.9, 0.14, { top: 1.08 }), stone, 0, -0.12, 0.02);
      knee.add(guard);
      for (const y of [0.14, -0.4]) knee.add(mesh(block(pantsW + 0.14, 0.08, 0.94, 0.03), stoneLight, 0, y, 0.02));
      knee.add(mesh(new THREE.ConeGeometry(0.1, 0.22, 4), stoneLight, 0, -0.12, 0.52).rotateX(Math.PI / 2));
    }
    if (look.outfit === 'space' || look.outfit === 'armor') knee.add(mesh(block(0.7, 0.4, 0.2, 0.08), look.outfit === 'armor' ? top : accent, 0, 0, 0.45));
    hip.add(thigh, knee);
    pelvis.add(hip);
    return { hip, knee };
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ---------------------------------------------------------------- quadril e tronco
  const hips = mesh(block(1.86, 0.5, 0.96, 0.2), pants, 0, 0.06, 0);
  pelvis.add(hips);
  const torsoH = 1.95;
  const torso = mesh(block(chestW, torsoH, 1.02, 0.28, { top: 1, bottom: waistW / chestW, topZ: 1, bottomZ: 0.92 }), top, 0, torsoH / 2 + 0.1, 0);
  spine.add(torso);
  const front = 0.51;

  switch (look.outfit) {
    case 'hoodie': {
      // Barra e punho canelados, bolso canguru, capuz atrás do pescoço e cordões.
      spine.add(mesh(block(waistW + 0.06, 0.26, 0.98, 0.1), topDark, 0, 0.2, 0));
      spine.add(mesh(block(1.2, 0.5, 0.08, 0.12, { top: 0.82 }), topDark, 0, 0.62, front + 0.01));
      const hood = mesh(block(1.5, 0.5, 0.62, 0.24, { top: 0.82 }), top, 0, 2.05, -0.34);
      hood.rotation.x = -0.25;
      spine.add(hood);
      spine.add(mesh(block(1.0, 0.14, 0.5, 0.07), topDark, 0, 2.06, 0.02));
      for (const s of [-1, 1]) {
        const cord = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), white, s * 0.2, 1.62, front + 0.05);
        cord.rotation.z = s * 0.06;
        spine.add(cord, mesh(new THREE.SphereGeometry(0.06, 8, 6), white, s * 0.22, 1.3, front + 0.06));
      }
      if (look.logo) {
        const logo = mesh(knightShape(), white, 0, 1.12, front + 0.035);
        logo.scale.setScalar(0.52);
        spine.add(logo);
      }
      break;
    }
    case 'tee': {
      spine.add(mesh(block(0.62, 0.16, 0.1, 0.06), skin, 0, 1.98, front - 0.03)); // gola
      if (look.logo) {
        const logo = mesh(knightShape(), accent, 0, 1.25, front + 0.03);
        logo.scale.setScalar(0.5);
        spine.add(logo);
      }
      spine.add(mesh(block(waistW + 0.04, 0.16, 0.96, 0.06), ink, 0, 0.18, 0)); // cinto
      break;
    }
    case 'jacket': {
      // Jaqueta aberta com camiseta por baixo.
      spine.add(mesh(block(0.86, 1.7, 0.08, 0.06), accent, 0, 1.05, front + 0.0));
      for (const s of [-1, 1]) {
        const lapel = mesh(block(0.18, 1.0, 0.1, 0.04), topDark, s * 0.5, 1.5, front + 0.04);
        lapel.rotation.z = s * 0.25;
        spine.add(lapel);
      }
      if (look.logo) {
        const logo = mesh(knightShape(), white, 0, 1.2, front + 0.06);
        logo.scale.setScalar(0.4);
        spine.add(logo);
      }
      break;
    }
    case 'gi': {
      // Kimono aberto em V mostrando o peito, faixa preta com nó e pontas.
      const v = new THREE.Shape();
      v.moveTo(-0.62, 0.95);
      v.lineTo(0.62, 0.95);
      v.lineTo(0.05, -0.2);
      v.lineTo(-0.05, -0.2);
      v.closePath();
      const chest = mesh(new THREE.ShapeGeometry(v), skin, 0, 1.05, front + 0.012);
      spine.add(chest);
      for (const s of [-1, 1]) {
        const lapel = mesh(block(0.2, 1.42, 0.1, 0.04), mat(darker(look.top, 0.92)), s * 0.32, 1.42, front + 0.05);
        lapel.rotation.z = -s * 0.5;
        spine.add(lapel);
      }
      spine.add(mesh(block(waistW + 0.1, 0.26, 1.04, 0.08), accent, 0, 0.32, 0));
      spine.add(mesh(block(0.3, 0.26, 0.16, 0.08), accent, 0, 0.32, front + 0.06));
      for (const s of [-1, 1]) {
        const tail = mesh(block(0.16, 0.6, 0.06, 0.04), accent, s * 0.12, 0.0, front + 0.08);
        tail.rotation.z = s * 0.25;
        spine.add(tail);
      }
      break;
    }
    case 'ninja': {
      spine.add(mesh(block(waistW + 0.1, 0.22, 1.04, 0.08), accent, 0, 0.3, 0));
      const strap = mesh(block(0.16, 2.3, 0.06, 0.04), topDark, 0, 1.1, front + 0.03);
      strap.rotation.z = 0.75;
      spine.add(strap);
      // Espada nas costas
      const sword = new THREE.Group();
      sword.position.set(0, 1.25, -0.6);
      sword.rotation.z = 0.75;
      sword.add(mesh(block(0.16, 2.0, 0.1, 0.04), mat('#3a2a1e'), 0, 0, 0));
      sword.add(mesh(block(0.4, 0.08, 0.2, 0.03), mat('#c9a227', { metalness: 0.6, roughness: 0.3 }), 0, 1.0, 0));
      sword.add(mesh(block(0.13, 0.5, 0.1, 0.04), accent, 0, 1.3, 0));
      spine.add(sword);
      break;
    }
    case 'royal': {
      // Túnica com faixa dourada, gola de pele e capa.
      const gold = mat('#f2c230', { metalness: 0.6, roughness: 0.3 });
      spine.add(mesh(block(0.2, 1.9, 0.06, 0.04), gold, 0, 1.08, front + 0.01));
      spine.add(mesh(block(waistW + 0.08, 0.2, 1.0, 0.06), gold, 0, 0.3, 0));
      spine.add(mesh(new THREE.SphereGeometry(0.12, 12, 8), mat('#2979ff', { roughness: 0.2 }), 0, 0.3, front + 0.06));
      const fur = mesh(block(chestW + 0.3, 0.38, 1.3, 0.18), mat('#f5f1e8', { roughness: 0.95 }), 0, 1.98, -0.05);
      spine.add(fur);
      for (const [x, z] of [[-0.7, 0.62], [0.4, 0.64], [-0.1, 0.66], [0.9, 0.5], [-1.0, 0.4]]) {
        spine.add(mesh(block(0.08, 0.14, 0.04, 0.02), ink, x, 1.96, z));
      }
      break;
    }
    case 'space': {
      const panel = mesh(block(0.9, 0.62, 0.12, 0.08), mat('#cfd8dc'), 0, 1.35, front + 0.03);
      spine.add(panel);
      [['#ff5252', -0.24], ['#ffd740', 0], ['#69f0ae', 0.24]].forEach(([c, x]) =>
        spine.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(c as string, { emissive: new THREE.Color(c as string), emissiveIntensity: 0.6 }), x as number, 1.42, front + 0.1)),
      );
      spine.add(mesh(block(0.6, 0.1, 0.06, 0.03), mat('#37474f'), 0, 1.22, front + 0.1));
      spine.add(mesh(block(chestW + 0.04, 0.16, 1.06, 0.06), accent, 0, 0.75, 0));
      spine.add(mesh(block(1.5, 1.5, 0.6, 0.2), mat('#eceff1'), 0, 1.15, -0.78)); // mochila
      spine.add(mesh(block(1.1, 0.24, 0.2, 0.08), accent, 0, 1.6, -1.1));
      break;
    }
    case 'robot': {
      const core = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 20), mat('#1de9ff', { emissive: new THREE.Color('#1de9ff'), emissiveIntensity: 1.2 }), 0, 1.3, front + 0.04);
      core.rotation.x = Math.PI / 2;
      spine.add(core, mesh(block(1.3, 0.12, 0.06, 0.03), topDark, 0, 0.75, front + 0.02), mesh(block(1.3, 0.12, 0.06, 0.03), topDark, 0, 0.55, front + 0.02));
      break;
    }
    case 'armor': {
      const plate = mesh(block(chestW * 0.86, 1.2, 0.2, 0.18, { bottom: 0.8 }), mat(look.accent, { metalness: 0.65, roughness: 0.35 }), 0, 1.4, front);
      spine.add(plate, mesh(block(waistW + 0.06, 0.24, 1.02, 0.06), mat('#5b3a1e'), 0, 0.3, 0));
      spine.add(mesh(block(0.3, 0.26, 0.1, 0.06), mat('#f2c230', { metalness: 0.6, roughness: 0.3 }), 0, 0.3, front + 0.04));
      break;
    }
    case 'robe': {
      // Manto longo até o joelho (preso ao quadril, abre na frente).
      const gold = mat('#ffd54f', { metalness: 0.4, roughness: 0.4 });
      spine.add(mesh(block(waistW + 0.06, 0.2, 1.0, 0.06), gold, 0, 0.3, 0));
      for (const [x, y] of [[-0.45, 1.5], [0.5, 1.1], [-0.2, 0.8], [0.25, 1.7]]) {
        const star = mesh(new THREE.OctahedronGeometry(0.1), gold, x, y, front + 0.04);
        spine.add(star);
      }
      break;
    }
  }

  // Saia do manto/capa (presa à pelve, balança com o movimento).
  let skirt: THREE.Group | null = null;
  if (look.outfit === 'robe') {
    skirt = new THREE.Group();
    skirt.position.set(0, 0.2, 0);
    const back = mesh(block(1.95, 1.4, 0.16, 0.08, { bottom: 1.12 }), top, 0, -0.7, -0.42);
    const sideL = mesh(block(0.16, 1.4, 0.9, 0.06, { bottomZ: 1.1 }), top, -0.98, -0.7, 0);
    const sideR = mesh(block(0.16, 1.4, 0.9, 0.06, { bottomZ: 1.1 }), top, 0.98, -0.7, 0);
    const frontL = mesh(block(0.55, 1.4, 0.14, 0.06), top, -0.72, -0.7, 0.45);
    const frontR = mesh(block(0.55, 1.4, 0.14, 0.06), top, 0.72, -0.7, 0.45);
    skirt.add(back, sideL, sideR, frontL, frontR);
    pelvis.add(skirt);
  }
  let cape: THREE.Group | null = null;
  if (look.outfit === 'royal' || look.outfit === 'armor') {
    cape = new THREE.Group();
    cape.position.set(0, 1.92, -0.58);
    const c = mesh(block(chestW + 0.15, 2.9, 0.1, 0.05, { bottom: 1.25, top: 1 }), mat(look.outfit === 'royal' ? '#b71c1c' : look.accent), 0, -1.45, 0);
    const lining = mesh(block(chestW + 0.05, 2.8, 0.04, 0.02, { bottom: 1.25 }), mat(look.outfit === 'royal' ? '#ffd54f' : darker(look.accent, 0.7)), 0, -1.42, 0.06);
    cape.add(c, lining);
    // Dobras do tecido (faixas mais escuras que abrem para baixo, acompanhando o corte da capa)
    const fold = mat(darker(look.outfit === 'royal' ? '#b71c1c' : look.accent, 0.72));
    for (const x of [-0.6, -0.2, 0.2, 0.6]) {
      const f = mesh(block(0.12, 2.7, 0.04, 0.02, { bottom: 1.6 }), fold, x * (chestW / 2), -1.45, -0.06);
      f.rotation.z = -x * 0.12;
      cape.add(f);
    }
    spine.add(cape);
  }

  // ---------------------------------------------------------------- braços
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, 1.85, 0);
    // Ombro arredondado (deltoide) + braço
    const delt = mesh(block(armT + 0.08, 0.6, armT + 0.06, 0.28), top, 0, -0.08, 0);
    const upper = mesh(block(armT, 0.98, armT, 0.24, { top: 1.02, bottom: 0.92 }), wideSleeve || longSleeve ? top : top, 0, -0.45, 0);
    shoulder.add(delt, upper);
    if (look.outfit === 'tee' || look.outfit === 'gi') {
      // Manga curta: o resto do braço é pele.
      const skinArm = mesh(block(armT * 0.9, 0.5, armT * 0.9, 0.2), skin, 0, -0.78, 0);
      if (look.outfit === 'gi') {
        // Manga larga do kimono, terminando um pouco abaixo do cotovelo.
        const sleeve = mesh(block(armT + 0.14, 0.44, armT + 0.14, 0.12, { bottom: 1.1 }), top, 0, -0.78, 0);
        shoulder.add(sleeve);
      } else shoulder.add(skinArm);
    }
    if (look.outfit === 'royal' || look.outfit === 'armor' || look.outfit === 'space') {
      const pad = mesh(block(armT + 0.26, 0.36, armT + 0.22, 0.16), look.outfit === 'royal' ? mat('#f2c230', { metalness: 0.6, roughness: 0.3 }) : look.outfit === 'armor' ? mat(look.accent, { metalness: 0.65, roughness: 0.35 }) : accent, 0, 0.05, 0);
      shoulder.add(pad);
    }
    const elbow = new THREE.Group();
    elbow.position.y = -0.94;
    const foreMat = longSleeve ? top : skin;
    const cap = mesh(block(armT * 0.94, 0.4, armT * 0.94, 0.18), foreMat);
    const fore = mesh(block(armT * 0.92, 0.72, armT * 0.92, 0.22, { top: 1, bottom: 0.9 }), foreMat, 0, -0.36, 0);
    elbow.add(cap, fore);
    if (look.outfit === 'hoodie' || look.outfit === 'jacket') {
      // Listras na manga + punho
      for (const y of [-0.22, -0.36]) elbow.add(mesh(block(armT * 0.95, 0.07, armT * 0.95, 0.03), look.outfit === 'hoodie' ? white : accent, 0, y, 0));
      elbow.add(mesh(block(armT * 0.86, 0.16, armT * 0.86, 0.06), topDark, 0, -0.68, 0));
    }
    if (look.outfit === 'ninja') elbow.add(mesh(block(armT * 0.96, 0.3, armT * 0.96, 0.08), accent, 0, -0.55, 0));
    if (look.bracers) {
      elbow.add(mesh(block(armT + 0.16, 0.44, armT + 0.16, 0.08), stone, 0, -0.46, 0));
      for (const y of [-0.3, -0.62]) elbow.add(mesh(block(armT + 0.22, 0.08, armT + 0.22, 0.03), stoneLight, 0, y, 0));
      for (const z of [-1, 1]) elbow.add(mesh(new THREE.ConeGeometry(0.09, 0.2, 4), stoneLight, side * (armT / 2 + 0.12), -0.46, z * 0.22));
    }
    // Mão (punho fechado) com polegar
    const handMat = look.outfit === 'space' ? mat('#eceff1') : look.outfit === 'ninja' ? shoes : skin;
    const hand = new THREE.Group();
    hand.position.y = -0.86;
    hand.add(mesh(block(armT * 0.86, 0.5, armT * 0.9, 0.2), handMat));
    hand.add(mesh(block(0.2, 0.26, 0.26, 0.09), handMat, -side * 0.02, -0.02, armT * 0.45));
    elbow.add(hand);
    shoulder.add(elbow);
    spine.add(shoulder);
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---------------------------------------------------------------- cabeça
  const neckJoint = new THREE.Group();
  neckJoint.position.y = 2.05;
  spine.add(neckJoint);
  const head = new THREE.Group();
  head.position.y = 0.72;
  neckJoint.add(head);
  neckJoint.add(mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.36, 14), skin, 0, 0.12, 0));
  const HW = 1.26;
  const HH = 1.2;
  const HD = 1.14;
  head.add(mesh(block(HW, HH, HD, 0.36, { top: 0.96, bottom: 0.9, bottomZ: 0.92 }), skin));
  const fz = HD / 2 + 0.005;

  // Rosto: olhos ovais com brilho, sobrancelhas expressivas e boca.
  const eyes = new THREE.Group();
  head.add(eyes);
  const browAngle = look.face === 'determined' ? 0.38 : look.face === 'smirk' ? 0.15 : -0.12;
  if (look.face !== 'visor' && look.face !== 'shades') {
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.1, 14, 10), ink, s * 0.24, 0.06, fz - 0.02);
      eye.scale.set(0.95, 1.5, 0.45);
      const glint = mesh(new THREE.SphereGeometry(0.035, 8, 6), white, s * 0.24 - 0.03, 0.13, fz + 0.025);
      eyes.add(eye, glint);
    }
  }
  if (look.face !== 'visor') {
    const browMat = mat(look.hair !== 'none' ? darker(look.hairColor, 0.8) : '#3b2a20');
    for (const s of [-1, 1]) {
      const brow = mesh(block(0.3, 0.075, 0.05, 0.03), browMat, s * 0.25, look.face === 'determined' ? 0.27 : 0.31, fz);
      brow.rotation.z = s * browAngle;
      head.add(brow);
    }
  }
  const mouth = (kind: 'smile' | 'grin' | 'smirk') => {
    if (kind === 'grin') {
      const m = new THREE.Shape();
      m.moveTo(-0.26, 0);
      m.lineTo(0.26, 0);
      m.quadraticCurveTo(0.22, -0.26, 0, -0.27);
      m.quadraticCurveTo(-0.22, -0.26, -0.26, 0);
      const open = mesh(new THREE.ShapeGeometry(m, 10), mat('#5a1f24'), 0, -0.14, fz + 0.002);
      const teeth = mesh(block(0.42, 0.07, 0.02, 0.01), white, 0, -0.175, fz + 0.01);
      const tongue = mesh(new THREE.CircleGeometry(0.1, 12, 0, Math.PI), mat('#ff7b8a'), 0, -0.39, fz + 0.004);
      head.add(open, teeth, tongue);
      return;
    }
    const arc = mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 18, Math.PI * 0.85), ink, kind === 'smirk' ? 0.05 : 0, -0.15, fz);
    arc.rotation.z = Math.PI + Math.PI * 0.075 + (kind === 'smirk' ? 0.25 : 0);
    head.add(arc);
  };
  switch (look.face) {
    case 'shades': {
      const glass = mat('#0d0d12', { roughness: 0.15, metalness: 0.3 });
      for (const s of [-1, 1]) head.add(mesh(block(0.46, 0.28, 0.07, 0.08, { bottom: 0.85 }), glass, s * 0.27, 0.1, fz + 0.03));
      head.add(mesh(block(1.3, 0.06, 0.06, 0.02), glass, 0, 0.2, fz + 0.02));
      mouth('smirk');
      break;
    }
    case 'visor': {
      const visor = mesh(
        block(1.12, 0.46, 0.12, 0.08),
        mat('#0b1a2a', { emissive: new THREE.Color(look.outfit === 'robot' ? '#ff3d00' : '#1de9ff'), emissiveIntensity: 0.35, roughness: 0.15 }),
        0,
        0.1,
        fz + 0.03,
      );
      head.add(visor);
      if (look.outfit === 'robot') {
        head.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), topDark, 0.3, HH / 2 + 0.22, 0));
        head.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), mat('#ff3d00', { emissive: new THREE.Color('#ff3d00'), emissiveIntensity: 1 }), 0.3, HH / 2 + 0.5, 0));
        for (const s of [-1, 1]) head.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), topDark, s * (HW / 2 + 0.04), 0, 0).rotateZ(Math.PI / 2));
      }
      break;
    }
    case 'mask': {
      mouth('smile');
      break;
    }
    case 'grin':
      mouth('grin');
      break;
    case 'smirk':
    case 'determined':
      mouth('smirk');
      break;
    default:
      mouth('smile');
  }
  if (look.beard) {
    const beard = mesh(block(1.0, 0.7, 0.3, 0.14, { bottom: 0.55 }), mat(look.beard, { roughness: 0.9 }), 0, -0.6, fz - 0.06);
    head.add(beard, mesh(block(0.5, 0.09, 0.06, 0.03), mat(look.beard, { roughness: 0.9 }), 0, -0.08, fz + 0.03));
  }

  // ---------------------------------------------------------------- cabelo
  const hairMat = mat(look.hairColor, { roughness: 0.5 });
  const hairTop = HH / 2;
  const spikes: THREE.Object3D[] = [];
  const spike = (x: number, y: number, z: number, len: number, rx: number, rz: number, w = 0.34) => {
    const g = new THREE.ConeGeometry(w, len, 4);
    g.translate(0, len / 2, 0);
    const m = mesh(g, hairMat, x, y, z);
    m.rotation.set(rx, Math.PI / 4, rz);
    head.add(m);
    spikes.push(m);
  };
  switch (look.hair) {
    case 'spiky': {
      head.add(mesh(block(HW + 0.1, 0.4, HD + 0.08, 0.18), hairMat, 0, hairTop - 0.04, -0.02));
      head.add(mesh(block(HW + 0.1, 0.8, 0.3, 0.14), hairMat, 0, hairTop - 0.42, -HD / 2 + 0.06));
      for (const s of [-1, 1]) head.add(mesh(block(0.12, 0.5, HD * 0.7, 0.05), hairMat, s * (HW / 2 + 0.03), hairTop - 0.36, -0.15));
      // Mechas espetadas para cima e para trás
      const spec: [number, number, number, number, number, number, number][] = [
        [-0.34, 0.02, 0.3, 0.78, -0.2, 0.55, 0.36],
        [0.02, 0.06, 0.36, 0.92, -0.3, 0.08, 0.4],
        [0.36, 0.02, 0.28, 0.76, -0.25, -0.6, 0.36],
        [-0.44, 0.02, -0.08, 0.82, -0.75, 0.85, 0.38],
        [-0.14, 0.06, -0.04, 1.0, -0.8, 0.2, 0.42],
        [0.24, 0.06, -0.06, 0.95, -0.85, -0.35, 0.42],
        [0.5, 0.0, -0.12, 0.78, -0.8, -0.95, 0.36],
        [0, -0.04, -0.42, 0.86, -1.35, 0.0, 0.4],
        [-0.42, -0.1, -0.4, 0.7, -1.3, 0.7, 0.34],
        [0.42, -0.1, -0.4, 0.7, -1.3, -0.7, 0.34],
      ];
      for (const [x, y, z, len, rx, rz, w] of spec) spike(x, hairTop + y, z, len, rx, rz, w);
      // Camada de baixo: mechas menores preenchendo os vãos.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spike(Math.sin(a) * 0.42, hairTop - 0.06, Math.cos(a) * 0.38 - 0.08, 0.5, -0.5 + Math.cos(a) * 0.5 - 0.4, -Math.sin(a) * 0.9, 0.32);
      }
      // Franja caindo na testa
      for (const [x, rz] of [[-0.3, -2.7], [0.05, -2.95], [0.32, 2.75]] as [number, number][]) spike(x, hairTop + 0.08, HD / 2 - 0.02, 0.34, 0.25, rz, 0.16);
      break;
    }
    case 'swoop': {
      head.add(mesh(block(HW + 0.12, 0.46, HD + 0.1, 0.2), hairMat, 0, hairTop + 0.02, -0.02));
      head.add(mesh(block(HW + 0.1, 0.72, 0.28, 0.12), hairMat, 0, hairTop - 0.36, -HD / 2 + 0.04));
      for (const s of [-1, 1]) head.add(mesh(block(0.12, 0.55, HD * 0.75, 0.05), hairMat, s * (HW / 2 + 0.04), hairTop - 0.32, -0.12));
      const swoop = mesh(block(0.95, 0.32, 0.36, 0.14), hairMat, -0.18, hairTop + 0.05, HD / 2 - 0.05);
      swoop.rotation.z = 0.28;
      const tuft = mesh(block(0.5, 0.26, 0.4, 0.12), hairMat, 0.38, hairTop + 0.16, HD / 2 - 0.12);
      tuft.rotation.z = -0.4;
      head.add(swoop, tuft);
      break;
    }
    case 'buzz':
      head.add(mesh(block(HW + 0.06, 0.24, HD + 0.06, 0.12), hairMat, 0, hairTop - 0.02, 0));
      head.add(mesh(block(HW + 0.06, 0.5, 0.2, 0.1), hairMat, 0, hairTop - 0.3, -HD / 2 + 0.06));
      break;
    case 'long': {
      head.add(mesh(block(HW + 0.12, 0.44, HD + 0.1, 0.2), hairMat, 0, hairTop + 0.02, -0.02));
      head.add(mesh(block(HW + 0.16, 1.5, 0.4, 0.18, { bottom: 1.08 }), hairMat, 0, hairTop - 0.75, -HD / 2 + 0.06));
      for (const s of [-1, 1]) head.add(mesh(block(0.2, 1.1, HD * 0.6, 0.08), hairMat, s * (HW / 2 + 0.06), hairTop - 0.6, -0.15));
      break;
    }
  }

  // ---------------------------------------------------------------- acessórios de cabeça
  const hwMat = mat(look.headwearColor);
  const tails: THREE.Group[] = [];
  switch (look.headwear) {
    case 'headband': {
      head.add(mesh(block(HW + 0.14, 0.2, HD + 0.14, 0.08), hwMat, 0, 0.36, 0));
      const knot = mesh(block(0.24, 0.24, 0.16, 0.06), hwMat, 0, 0.36, -HD / 2 - 0.1);
      head.add(knot);
      for (const s of [-1, 1]) {
        const tail = new THREE.Group();
        tail.position.set(s * 0.06, 0.34, -HD / 2 - 0.14);
        tail.add(mesh(block(0.16, 0.7, 0.05, 0.03), hwMat, 0, -0.33, 0));
        tail.rotation.set(0.5, 0, s * 0.35);
        head.add(tail);
        tails.push(tail);
      }
      if (look.outfit === 'gi') head.add(mesh(new THREE.CircleGeometry(0.09, 16), white, 0, 0.36, HD / 2 + 0.08));
      break;
    }
    case 'cap':
    case 'capBack': {
      const back = look.headwear === 'capBack' ? -1 : 1;
      head.add(mesh(block(HW + 0.14, 0.44, HD + 0.14, 0.2, { top: 0.86, topZ: 0.86 }), hwMat, 0, hairTop + 0.08, 0));
      const brim = mesh(block(1.0, 0.08, 0.7, 0.04), mat(darker(look.headwearColor, 0.8)), 0, hairTop - 0.08, back * (HD / 2 + 0.28));
      brim.rotation.x = back * 0.08;
      head.add(brim, mesh(new THREE.SphereGeometry(0.07, 8, 6), hwMat, 0, hairTop + 0.31, 0));
      break;
    }
    case 'crown': {
      const gold = mat(look.headwearColor, { metalness: 0.7, roughness: 0.25, emissive: new THREE.Color(look.headwearColor), emissiveIntensity: 0.12 });
      const crown = new THREE.Group();
      crown.position.y = hairTop + 0.1;
      crown.add(mesh(block(HW + 0.1, 0.3, HD + 0.1, 0.06), gold));
      for (const [x, z] of [[-0.5, 0.55], [0, 0.6], [0.5, 0.55], [-0.6, 0], [0.6, 0], [-0.5, -0.55], [0, -0.6], [0.5, -0.55]]) {
        const p = mesh(new THREE.ConeGeometry(0.13, 0.36, 4), gold, x, 0.3, z);
        p.rotation.y = Math.PI / 4;
        crown.add(p, mesh(new THREE.SphereGeometry(0.06, 8, 6), gold, x, 0.5, z));
      }
      crown.add(mesh(new THREE.OctahedronGeometry(0.12), mat('#ff1744', { roughness: 0.15, emissive: new THREE.Color('#ff1744'), emissiveIntensity: 0.4 }), 0, 0, HD / 2 + 0.08));
      head.add(crown);
      break;
    }
    case 'wizard': {
      const hat = new THREE.Group();
      hat.position.y = hairTop + 0.05;
      hat.add(mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 28), hwMat));
      const cone = mesh(new THREE.ConeGeometry(0.62, 1.5, 20), hwMat, 0, 0.75, 0);
      cone.rotation.z = 0.12;
      const tip = mesh(new THREE.ConeGeometry(0.26, 0.6, 14), hwMat, -0.32, 1.65, -0.05);
      tip.rotation.z = 0.9;
      hat.add(cone, tip, mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.18, 24), mat('#ffd54f', { metalness: 0.4, roughness: 0.4 }), 0, 0.14, 0));
      for (const [x, y, z] of [[0.3, 0.7, 0.42], [-0.25, 1.0, 0.33], [0.1, 0.45, 0.58]]) hat.add(mesh(new THREE.OctahedronGeometry(0.08), mat('#ffd54f', { emissive: new THREE.Color('#ffd54f'), emissiveIntensity: 0.6 }), x, y, z));
      head.add(hat);
      break;
    }
    case 'helmet': {
      const glass = mesh(
        new THREE.SphereGeometry(1.08, 28, 20),
        new THREE.MeshStandardMaterial({ color: look.headwearColor, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, depthWrite: false }),
      );
      const ring = mesh(new THREE.TorusGeometry(0.78, 0.14, 10, 28), mat('#eceff1'), 0, -0.62, 0);
      ring.rotation.x = Math.PI / 2;
      head.add(ring, glass);
      break;
    }
    case 'knight': {
      const steel = mat(look.headwearColor, { metalness: 0.7, roughness: 0.3 });
      head.add(mesh(block(HW + 0.2, HH + 0.16, HD + 0.2, 0.36, { top: 0.94 }), steel, 0, 0.06, -0.02));
      // Abertura do rosto em T
      head.add(mesh(block(0.9, 0.24, 0.06, 0.05), mat('#111'), 0, 0.1, HD / 2 + 0.1));
      head.add(mesh(block(0.26, 0.5, 0.06, 0.05), mat('#111'), 0, -0.18, HD / 2 + 0.1));
      const plume = mesh(block(0.18, 0.5, 1.2, 0.09), mat(look.accent), 0, HH / 2 + 0.36, -0.05);
      head.add(plume);
      break;
    }
  }
  if (look.face === 'mask') {
    // Capuz ninja: cobre a cabeça e deixa só a faixa dos olhos.
    const hood = mat(look.top);
    head.add(mesh(block(HW + 0.1, 0.55, HD + 0.1, 0.2), hood, 0, -0.33, 0));
    head.add(mesh(block(HW + 0.1, 0.34, HD + 0.1, 0.2), hood, 0, 0.47, 0));
    head.add(mesh(block(HW + 0.1, 0.5, 0.3, 0.12), hood, 0, 0.08, -HD / 2 + 0.06));
  }

  // ---------------------------------------------------------------- roupa evoluída
  const evoFx = look.evolution
    ? addEvolution(
        {
          root, pelvis, spine, neck: neckJoint, head,
          shoulderL: armL.shoulder, shoulderR: armR.shoulder, elbowL: armL.elbow, elbowR: armR.elbow, handL: armL.hand, handR: armR.hand,
          hipL: legL.hip, hipR: legR.hip, kneeL: legL.knee, kneeR: legR.knee,
          skirt, cape, chestW, waistW, armT, pantsW, front, HW, HH, HD,
        },
        look.evolution,
      )
    : null;

  // ---------------------------------------------------------------- itens especiais
  const gearFx = (look.gear ?? [])
    .map((id) =>
      addGear(
        { root, body, pelvis, spine, head, handL: armL.hand, handR: armR.hand, elbowL: armL.elbow, elbowR: armR.elbow, armT, front, chestW, HW, HD },
        id,
      ),
    )
    .filter((f): f is NonNullable<typeof f> => !!f);

  // ---------------------------------------------------------------- movimento secundário
  const neckPos = new THREE.Vector3();
  const lastNeck = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let sway = 0;
  let swayV = 0;
  let nextBlink = 1.5;
  let first = true;
  const tick = (t: number, dt: number) => {
    // Piscar
    const since = t - nextBlink;
    if (since > 0.16) nextBlink = t + 2 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) * 1.5;
    eyes.scale.y = since > 0 && since < 0.16 ? Math.max(0.12, Math.abs(since - 0.08) / 0.08) : 1;
    // Velocidade do pescoço → balanço (mola amortecida)
    neckJoint.getWorldPosition(neckPos);
    if (first || dt <= 0) {
      lastNeck.copy(neckPos);
      first = false;
    }
    vel.subVectors(neckPos, lastNeck).divideScalar(Math.max(dt, 1 / 120));
    lastNeck.copy(neckPos);
    const target = Math.min(1.2, vel.length() * 0.12);
    const k = 60;
    const c = 9;
    swayV += (k * (target - sway) - c * swayV) * Math.min(dt, 0.05);
    sway += swayV * Math.min(dt, 0.05);
    const flutter = Math.sin(t * 7) * 0.06 + Math.sin(t * 11.3) * 0.03;
    tails.forEach((tl, i) => {
      tl.rotation.x = 0.45 + sway * 0.9 + flutter * (i ? 1 : -1);
    });
    if (cape) cape.rotation.x = 0.06 + sway * 0.5 + flutter * 0.3 - Math.max(0, spine.rotation.x) * 0.9;
    if (skirt) skirt.rotation.x = -sway * 0.15 + flutter * 0.1;
    spikes.forEach((s, i) => (s.scale.y = 1 + Math.sin(t * 3 + i) * 0.015));
    evoFx?.(t, dt);
    gearFx.forEach((f) => f.tick(t, dt));
  };

  return {
    root,
    body,
    pelvis,
    spine,
    neck: neckJoint,
    shoulderL: armL.shoulder,
    elbowL: armL.elbow,
    shoulderR: armR.shoulder,
    elbowR: armR.elbow,
    hipL: legL.hip,
    kneeL: legL.knee,
    hipR: legR.hip,
    kneeR: legR.knee,
    pelvisHeight: PELVIS_Y,
    tick,
    dispose: () => {
      gearFx.forEach((f) => f.dispose());
      disposeTree(root);
    },
  };
}

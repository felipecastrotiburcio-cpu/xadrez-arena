import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterStyle } from '../lib/types';

/**
 * Boneco 3D em blocos (estilo avatar de jogo), com esqueleto articulado:
 * pelve → coluna → pescoço/ombros/cotovelos e pelve → quadris/joelhos.
 * Medidas em "studs": pés em y=0, altura total ~5,3; o boneco olha para +z.
 *
 * Convenções de rotação (radianos):
 * - ombro/quadril .x negativo: braço/perna para a FRENTE; .z afasta do corpo
 *   (negativo no lado esquerdo, positivo no direito);
 * - cotovelo .x negativo dobra o antebraço para a frente; joelho .x positivo dobra para trás;
 * - coluna/pescoço .x positivo: inclina para a frente;
 * - body: pivô nos pés (cair, inclinar); pelvis: pivô no quadril (saltos mortais).
 */
export interface Avatar {
  /** Posição no chão e direção (rotation.y). */
  root: THREE.Group;
  body: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  shoulderL: THREE.Group;
  elbowL: THREE.Group;
  shoulderR: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  hipR: THREE.Group;
  kneeR: THREE.Group;
  /** Altura de repouso da pelve (quadril). */
  pelvisHeight: number;
  dispose(): void;
}

const toon = (color: string, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...extra });

const PELVIS_Y = 2;

export function buildAvatar(look: CharacterStyle): Avatar {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = PELVIS_Y;
  body.add(pelvis);
  const spine = new THREE.Group();
  pelvis.add(spine);

  const skin = toon(look.skin);
  const shirt = toon(look.shirt);
  const pants = toon(look.pants);
  const shoes = toon(look.shoes);
  const dark = toon('#1b1b1f');
  const segment = new RoundedBoxGeometry(0.98, 1.06, 0.98, 2, 0.14);
  // "Tampa" da articulação: preenche a fresta quando cotovelo/joelho dobram.
  const jointCap = new RoundedBoxGeometry(0.9, 0.5, 0.9, 2, 0.2);

  // Pernas: quadril → coxa → joelho → canela + tênis.
  const makeLeg = (x: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0, 0);
    const thigh = new THREE.Mesh(segment, pants);
    thigh.position.y = -0.5;
    const knee = new THREE.Group();
    knee.position.y = -1;
    const cap = new THREE.Mesh(jointCap, pants);
    const shin = new THREE.Mesh(segment, pants);
    shin.scale.y = 0.85;
    shin.position.y = -0.42;
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.36, 1.14, 2, 0.1), shoes);
    shoe.position.set(0, -0.82, 0.07);
    knee.add(cap, shin, shoe);
    hip.add(thigh, knee);
    pelvis.add(hip);
    return { hip, knee };
  };
  const legL = makeLeg(-0.5);
  const legR = makeLeg(0.5);

  // Tronco (preso à coluna) e cinto (preso à pelve).
  const torso = new THREE.Mesh(new RoundedBoxGeometry(2, 2, 1, 2, 0.16), shirt);
  torso.position.y = 1;
  spine.add(torso);
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.18, 1.04),
    toon(new THREE.Color(look.pants).multiplyScalar(0.7).getStyle()),
  );
  belt.position.y = 0.1;
  pelvis.add(belt);

  // Braços: ombro → braço (manga) → cotovelo → antebraço + mão.
  const makeArm = (x: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.8, 0);
    const upper = new THREE.Mesh(segment, shirt);
    upper.scale.y = 0.95;
    upper.position.y = -0.38;
    const elbow = new THREE.Group();
    elbow.position.y = -0.92;
    const cap = new THREE.Mesh(jointCap, skin);
    cap.scale.set(1.04, 1, 1.04);
    const fore = new THREE.Mesh(segment, skin);
    fore.scale.set(0.96, 0.92, 0.96);
    fore.position.y = -0.45;
    elbow.add(cap, fore);
    shoulder.add(upper, elbow);
    spine.add(shoulder);
    return { shoulder, elbow };
  };
  const armL = makeArm(-1.5);
  const armR = makeArm(1.5);

  // Cabeça (presa ao pescoço, que gira a partir do topo do tronco)
  const neckJoint = new THREE.Group();
  neckJoint.position.y = 2.0;
  spine.add(neckJoint);
  const head = new THREE.Group();
  head.position.y = 0.68;
  neckJoint.add(head);
  const headSize = 1.3;
  const front = headSize / 2 + 0.005;
  head.add(new THREE.Mesh(new RoundedBoxGeometry(headSize, headSize, headSize, 3, 0.26), skin));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 12), skin);
  neck.position.y = -0.68;
  head.add(neck);

  // Rosto (na face +z)
  const eyeGeo = new THREE.BoxGeometry(0.15, 0.24, 0.04);
  const addEyes = () => {
    for (const x of [-0.24, 0.24]) {
      const eye = new THREE.Mesh(eyeGeo, dark);
      eye.position.set(x, 0.12, front);
      const glint = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), toon('#ffffff'));
      glint.position.set(x - 0.03, 0.18, front + 0.02);
      head.add(eye, glint);
    }
  };
  const smile = (wide: boolean) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(wide ? 0.3 : 0.24, 0.045, 6, 16, Math.PI), dark);
    arc.rotation.z = Math.PI;
    arc.position.set(0, -0.08, front);
    head.add(arc);
    if (wide) {
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.03), toon('#ffffff'));
      teeth.position.set(0, -0.15, front + 0.005);
      head.add(teeth);
    }
  };
  switch (look.face) {
    case 'shades': {
      const glass = toon('#0d0d12');
      for (const x of [-0.27, 0.27]) {
        const lens = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.26, 0.06, 1, 0.05), glass);
        lens.position.set(x, 0.14, front + 0.02);
        head.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.06), glass);
      bridge.position.set(0, 0.2, front + 0.01);
      head.add(bridge);
      smile(false);
      break;
    }
    case 'mask': {
      addEyes();
      const mask = new THREE.Mesh(new RoundedBoxGeometry(headSize + 0.06, 0.62, headSize + 0.06, 2, 0.2), toon(look.shirt));
      mask.position.y = -0.36;
      head.add(mask);
      break;
    }
    case 'visor': {
      const visor = new THREE.Mesh(
        new RoundedBoxGeometry(1.1, 0.5, 0.1, 2, 0.06),
        toon('#101826', { emissive: new THREE.Color('#1de9ff'), emissiveIntensity: 0.25 }),
      );
      visor.position.set(0, 0.1, front + 0.03);
      head.add(visor);
      break;
    }
    case 'grin':
      addEyes();
      smile(true);
      break;
    default:
      addEyes();
      smile(false);
  }

  // Acessórios
  const hatMat = toon(look.hatColor);
  const top = headSize / 2;
  switch (look.hat) {
    case 'cap': {
      const cap = new THREE.Mesh(new RoundedBoxGeometry(headSize + 0.1, 0.42, headSize + 0.1, 2, 0.16), hatMat);
      cap.position.y = top + 0.08;
      const brim = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.1, 0.75, 1, 0.04), hatMat);
      brim.position.set(0, top - 0.06, front + 0.3);
      head.add(cap, brim);
      break;
    }
    case 'hair': {
      const hair = new THREE.Mesh(new RoundedBoxGeometry(headSize + 0.12, 0.42, headSize + 0.12, 2, 0.16), hatMat);
      hair.position.y = top + 0.04;
      const back = new THREE.Mesh(new RoundedBoxGeometry(headSize + 0.12, 0.9, 0.3, 2, 0.12), hatMat);
      back.position.set(0, top - 0.4, -front + 0.08);
      const fringe = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.26, 0.2, 1, 0.08), hatMat);
      fringe.position.set(-0.25, top - 0.1, front);
      fringe.rotation.z = 0.3;
      head.add(hair, back, fringe);
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 24), hatMat);
      brim.position.y = top + 0.05;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 1.0, 24), hatMat);
      crown.position.y = top + 0.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.18, 24), toon('#ffc83d'));
      band.position.y = top + 0.22;
      head.add(brim, crown, band);
      break;
    }
    case 'crown':
      head.add(buildCrown(look.hatColor, top));
      break;
    case 'headband': {
      const band = new THREE.Mesh(new THREE.BoxGeometry(headSize + 0.08, 0.2, headSize + 0.08), hatMat);
      band.position.y = 0.42;
      head.add(band);
      for (const [y, rz] of [
        [0.32, 0.5],
        [0.5, 0.2],
      ]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.06), hatMat);
        tail.position.set(0.15, y - 0.2, -front - 0.1);
        tail.rotation.z = rz;
        head.add(tail);
      }
      break;
    }
    case 'helmet': {
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(1.08, 24, 18),
        new THREE.MeshPhongMaterial({ color: look.hatColor, transparent: true, opacity: 0.28, shininess: 120 }),
      );
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 8, 24), toon('#eceff1'));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.6;
      head.add(glass, ring);
      break;
    }
  }

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
    dispose: () => disposeTree(root),
  };
}

/** Coroa dourada com pontas e joia (também usada no movimento "Coroação"). */
export function buildCrown(color = '#ffc107', y = 0.65) {
  const gold = new THREE.MeshToonMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.25 });
  const crown = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 20, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 8), gold);
    spike.position.set(Math.sin(a) * 0.56, 0.36, Math.cos(a) * 0.56);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), gold);
    ball.position.set(Math.sin(a) * 0.56, 0.6, Math.cos(a) * 0.56);
    crown.add(spike, ball);
  }
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12),
    new THREE.MeshToonMaterial({ color: '#ff1744', emissive: new THREE.Color('#ff1744'), emissiveIntensity: 0.5 }),
  );
  gem.position.set(0, 0.02, 0.64);
  crown.add(gem);
  crown.position.y = y + 0.15;
  return crown;
}

export function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

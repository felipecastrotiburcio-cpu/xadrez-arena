import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterStyle } from '../lib/types';

/**
 * Boneco 3D em blocos (estilo avatar de jogo): cabeça, tronco, braços e pernas
 * são caixas arredondadas. Medidas em "studs": pés em y=0, altura total ~5,3.
 *
 * Articulações (Groups) giram a partir do ombro/quadril. Convenções:
 * - rotation.x negativo leva braço/perna para a FRENTE (+z local);
 * - rotation.z afasta o braço do corpo (negativo no esquerdo, positivo no direito).
 */
export interface Avatar {
  /** Posição no chão e direção (rotation.y). */
  root: THREE.Group;
  /** Pivô nos pés: usado para cair, inclinar e pular. */
  body: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** Volta todas as articulações para a pose neutra. */
  resetPose(): void;
  dispose(): void;
}

const toon = (color: string, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...extra });

export function buildAvatar(look: CharacterStyle): Avatar {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const limbGeo = new RoundedBoxGeometry(0.98, 2, 0.98, 2, 0.14);
  const skin = toon(look.skin);
  const shirt = toon(look.shirt);
  const pants = toon(look.pants);
  const shoes = toon(look.shoes);
  const dark = toon('#1b1b1f');

  // Pernas: pivô no quadril (y = 2).
  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2, 0);
    const leg = new THREE.Mesh(limbGeo, pants);
    leg.position.y = -1;
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.36, 1.12, 2, 0.1), shoes);
    shoe.position.set(0, -1.82, 0.06);
    pivot.add(leg, shoe);
    body.add(pivot);
    return pivot;
  };
  const legL = makeLeg(-0.5);
  const legR = makeLeg(0.5);

  const torso = new THREE.Mesh(new RoundedBoxGeometry(2, 2, 1, 2, 0.16), shirt);
  torso.position.y = 3;
  body.add(torso);
  // Cinto
  const belt = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.18, 1.04), toon(new THREE.Color(look.pants).multiplyScalar(0.7).getStyle()));
  belt.position.y = 2.1;
  body.add(belt);

  // Braços: pivô no ombro.
  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 3.8, 0);
    const sleeve = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.9, 0.98, 2, 0.14), shirt);
    sleeve.position.y = -0.25;
    const arm = new THREE.Mesh(limbGeo, skin);
    arm.scale.y = 0.62;
    arm.position.y = -1.08;
    pivot.add(arm, sleeve);
    body.add(pivot);
    return pivot;
  };
  const armL = makeArm(-1.5);
  const armR = makeArm(1.5);

  // Cabeça
  const head = new THREE.Group();
  head.position.y = 4.68;
  body.add(head);
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

  const resetPose = () => {
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1, 1);
    head.rotation.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    for (const j of [armL, armR, legL, legR]) j.rotation.set(0, 0, 0);
  };

  return {
    root,
    body,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    resetPose,
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

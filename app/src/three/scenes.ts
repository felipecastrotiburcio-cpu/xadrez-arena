import * as THREE from 'three';
import type { BoardStyle, CharacterStyle } from '../lib/types';
import { buildAvatar, buildCrown, disposeTree, type Avatar } from './avatar';
import type { SceneFactory } from './Scene3D';

// ------------------------------------------------------------------ utilidades
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progresso 0..1 de uma fase que começa em `start` e dura `dur` segundos. */
const phase = (t: number, start: number, dur: number) => clamp01((t - start) / dur);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const easeOutBack = (x: number) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;
const easeOutBounce = (x: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
const PI = Math.PI;

// ------------------------------------------------------------------ palco
interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose(): void;
}

/** Piso quadriculado com as cores do tabuleiro equipado (textura gerada em memória). */
function checkerTexture(board: BoardStyle) {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  // Bytes sRGB direto do hex (a textura é marcada como sRGB; THREE.Color guardaria valores lineares).
  const rgb = (hex: string) => {
    const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const a = rgb(board.light);
  const b = rgb(board.dark);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = (x + y) % 2 ? b : a;
      data.set([c[0], c[1], c[2], 255], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildStage(width: number, height: number, board: BoardStyle, bg: string, radius: number): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 18, 40);

  scene.add(new THREE.HemisphereLight('#d9ccff', '#2a1d5c', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(5, 12, 9);
  scene.add(sun);
  const rimPink = new THREE.DirectionalLight('#ff4fd8', 1.2);
  rimPink.position.set(-8, 6, -8);
  scene.add(rimPink);
  const rimCyan = new THREE.DirectionalLight('#2ec5ff', 0.9);
  rimCyan.position.set(8, 4, -6);
  scene.add(rimCyan);

  // Arena: piso do tabuleiro + borda neon.
  const floorTex = checkerTexture(board);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(radius / 2, radius / 2);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshToonMaterial({ map: floorTex }));
  floor.rotation.x = -PI / 2;
  scene.add(floor);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.3, radius + 0.6, 0.8, 48),
    new THREE.MeshToonMaterial({ color: board.border }),
  );
  base.position.y = -0.41;
  scene.add(base);
  const neon = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.15, 0.12, 8, 64),
    new THREE.MeshBasicMaterial({ color: '#ff4fd8' }),
  );
  neon.rotation.x = PI / 2;
  neon.position.y = 0.02;
  scene.add(neon);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  return {
    scene,
    camera,
    dispose: () => {
      floorTex.dispose();
      disposeTree(scene);
    },
  };
}

/** Sombra arredondada sob o boneco (mais leve que sombras reais no celular). */
function blobShadow() {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  m.rotation.x = -PI / 2;
  m.position.y = 0.02;
  return m;
}

// ------------------------------------------------------------------ efeitos
const CONFETTI_COLORS = ['#ffc83d', '#2ee59d', '#2ec5ff', '#ff4d6d', '#b45cff', '#ff9a3d'];

function confetti(count: number) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.18, 0.3);
  const mats = CONFETTI_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const parts = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(geo, mats[i % mats.length]);
    m.position.set((Math.random() - 0.5) * 14, 8 + Math.random() * 10, (Math.random() - 0.5) * 8);
    group.add(m);
    return { m, vy: 2 + Math.random() * 2.5, spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), sway: Math.random() * 6 };
  });
  return {
    group,
    update(dt: number, t: number) {
      for (const p of parts) {
        p.m.position.y -= p.vy * dt;
        p.m.position.x += Math.sin(t * 2 + p.sway) * dt * 0.8;
        p.m.rotation.x += p.spin.x * dt;
        p.m.rotation.y += p.spin.y * dt;
        if (p.m.position.y < 0) p.m.position.y += 14;
      }
    },
  };
}

/** Explosão estilizada do impacto: estrela que cresce e some. */
function burst() {
  const group = new THREE.Group();
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: '#ff9a3d', transparent: true }));
  group.add(star, ring);
  const spikes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 4), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true }));
    const a = (i / 8) * PI * 2;
    s.rotation.z = a - PI / 2;
    s.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0);
    spikes.push(s);
    group.add(s);
  }
  group.visible = false;
  return {
    group,
    /** k: 0..1 desde o impacto. */
    set(k: number) {
      group.visible = k > 0 && k < 1;
      const s = 0.4 + easeOutBack(clamp01(k * 2)) * 1.6;
      group.scale.setScalar(s);
      const o = 1 - k;
      (star.material as THREE.MeshBasicMaterial).opacity = o;
      (ring.material as THREE.MeshBasicMaterial).opacity = o;
      spikes.forEach((sp) => ((sp.material as THREE.MeshBasicMaterial).opacity = o));
      group.rotation.z = k * 2;
    },
  };
}

/** Raio em zigue-zague do céu até o alvo. */
function lightning() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#e6f7ff' });
  const glow = new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.45 });
  const light = new THREE.PointLight('#9fe3ff', 0, 18);
  group.add(light);
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), mat);
    const halo = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), glow);
    core.add(halo);
    segs.push(core);
    group.add(core);
  }
  return {
    group,
    strike(target: THREE.Vector3, on: boolean) {
      group.visible = on;
      light.intensity = on ? 60 : 0;
      if (!on) return;
      light.position.copy(target).add(new THREE.Vector3(0, 2, 1));
      let prev = new THREE.Vector3(target.x + (Math.random() - 0.5) * 2, 12, target.z);
      segs.forEach((s, i) => {
        const k = (i + 1) / segs.length;
        const next = new THREE.Vector3(
          lerp(prev.x, target.x, 0.5) + (i === segs.length - 1 ? 0 : (Math.random() - 0.5) * 1.6),
          lerp(12, target.y, k),
          target.z + (Math.random() - 0.5) * 0.6,
        );
        if (i === segs.length - 1) next.copy(target);
        const mid = prev.clone().add(next).multiplyScalar(0.5);
        const len = prev.distanceTo(next);
        s.position.copy(mid);
        s.scale.y = len;
        s.lookAt(next);
        s.rotateX(PI / 2);
        prev = next;
      });
    },
  };
}

/** Dígito de 7 segmentos feito de blocos luminosos (para o movimento do 67). */
function digit(n: 6 | 7) {
  const SEG: Record<string, [number, number, number, number]> = {
    a: [0, 1, 0.9, 0.2],
    b: [0.45, 0.5, 0.2, 0.9],
    c: [0.45, -0.5, 0.2, 0.9],
    d: [0, -1, 0.9, 0.2],
    e: [-0.45, -0.5, 0.2, 0.9],
    f: [-0.45, 0.5, 0.2, 0.9],
    g: [0, 0, 0.9, 0.2],
  };
  const on = n === 6 ? 'acdefg' : 'abc';
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffc83d' });
  const edge = new THREE.MeshBasicMaterial({ color: '#ff4fd8' });
  for (const k of on) {
    const [x, y, w, h] = SEG[k];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), mat);
    m.position.set(x, y, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.18), edge);
    back.position.z = -0.06;
    m.add(back);
    group.add(m);
  }
  return group;
}

// ------------------------------------------------------------------ animações do boneco
/** Ciclo de caminhada (ph em radianos). */
function walk(a: Avatar, ph: number, amount = 1) {
  a.legL.rotation.x = Math.sin(ph) * 0.7 * amount;
  a.legR.rotation.x = -Math.sin(ph) * 0.7 * amount;
  a.armL.rotation.x = -Math.sin(ph) * 0.6 * amount;
  a.armR.rotation.x = Math.sin(ph) * 0.6 * amount;
  a.body.position.y = Math.abs(Math.cos(ph)) * 0.12 * amount;
}

/** Comemorações (τ = segundos desde o início da dança). */
export function dance(a: Avatar, move: string, tau: number) {
  const w = PI * 2 * 2; // 2 batidas por segundo
  const s = Math.sin(tau * w);
  switch (move) {
    case '67': {
      // Mãos para a frente, palmas para cima, subindo e descendo alternadas: "six… seven!"
      a.armL.rotation.x = -1.35 - s * 0.5;
      a.armR.rotation.x = -1.35 + s * 0.5;
      a.armL.rotation.z = -0.3;
      a.armR.rotation.z = 0.3;
      a.body.rotation.z = s * 0.06;
      a.head.rotation.z = -s * 0.15;
      a.head.rotation.x = Math.abs(s) * 0.12;
      a.body.position.y = Math.abs(s) * 0.12;
      break;
    }
    case 'spin': {
      a.armL.rotation.z = -PI / 2 + 0.2;
      a.armR.rotation.z = PI / 2 - 0.2;
      a.body.rotation.y = tau * PI * 3;
      a.body.position.y = Math.abs(Math.sin(tau * PI * 1.5)) * 0.5;
      a.legL.rotation.z = -0.15;
      a.legR.rotation.z = 0.15;
      break;
    }
    case 'flex': {
      const pump = (Math.sin(tau * PI * 2.5) + 1) / 2;
      a.armL.rotation.z = -2.5 + pump * 0.4;
      a.armR.rotation.z = 2.5 - pump * 0.4;
      a.armL.rotation.x = -0.4;
      a.armR.rotation.x = -0.4;
      a.torso.scale.setScalar(1 + pump * 0.1);
      a.body.position.y = pump * 0.1;
      a.head.rotation.x = -0.15;
      break;
    }
    case 'kick':
    case 'lightning': {
      // Polichinelo comemorando.
      const j = (Math.sin(tau * PI * 3) + 1) / 2;
      a.armL.rotation.z = -0.3 - j * 2.4;
      a.armR.rotation.z = 0.3 + j * 2.4;
      a.legL.rotation.z = -j * 0.35;
      a.legR.rotation.z = j * 0.35;
      a.body.position.y = j * 0.7;
      break;
    }
    case 'crown': {
      a.armL.rotation.z = -2.6 + s * 0.3;
      a.armR.rotation.z = 2.6 - s * 0.3;
      a.body.rotation.y = Math.sin(tau * PI) * 0.4;
      a.body.position.y = Math.abs(s) * 0.15;
      break;
    }
    case 'jamal':
    default: {
      // Passinho do Jamal: pra lá e pra cá, pés alternando, braços no contratempo e quadril balançando.
      const step = Math.sin(tau * w * 0.5);
      a.body.position.x = step * 0.55;
      a.body.position.y = Math.abs(s) * 0.22;
      a.legL.rotation.x = Math.max(0, s) * -0.9;
      a.legR.rotation.x = Math.max(0, -s) * -0.9;
      a.legL.rotation.z = -0.12;
      a.legR.rotation.z = 0.12;
      a.armL.rotation.x = -s * 0.9;
      a.armR.rotation.x = s * 0.9;
      a.armL.rotation.z = -0.35;
      a.armR.rotation.z = 0.35;
      a.body.rotation.y = step * 0.45;
      a.body.rotation.z = -step * 0.1;
      a.head.rotation.z = s * 0.12;
    }
  }
}

/** Pose parada com respiração e um aceno de vez em quando. */
function idle(a: Avatar, t: number) {
  const breath = Math.sin(t * 2.2);
  a.torso.scale.set(1 + breath * 0.015, 1 + breath * 0.02, 1);
  a.armL.rotation.z = -0.08 - breath * 0.03;
  a.head.rotation.y = Math.sin(t * 0.7) * 0.25;
  a.head.rotation.x = Math.sin(t * 1.1) * 0.05;
  const cycle = t % 5;
  if (cycle > 3.4) {
    const k = Math.sin(((cycle - 3.4) / 1.6) * PI);
    a.armR.rotation.z = 2.6 * k;
    a.armR.rotation.x = Math.sin(t * 14) * 0.35 * k;
  } else {
    a.armR.rotation.z = 0.08 + breath * 0.03;
    a.armR.rotation.x = 0;
  }
}

// ------------------------------------------------------------------ cenas
export interface FinaleOptions {
  winner: CharacterStyle;
  loser: CharacterStyle;
  move: string;
  board: BoardStyle;
  bg: string;
}

/**
 * Finalização: os dois entram caminhando, o vencedor derruba o rival (soco,
 * voadora ou raio, conforme o movimento) e comemora com o movimento especial
 * enquanto a câmera gira ao redor.
 */
export const createFinaleScene =
  ({ winner, loser, move, board, bg }: FinaleOptions): SceneFactory =>
  (renderer, width, height) => {
    const stage = buildStage(width, height, board, bg, 9);
    const { scene, camera } = stage;
    const W = buildAvatar(winner);
    const L = buildAvatar(loser);
    const wShadow = blobShadow();
    const lShadow = blobShadow();
    scene.add(W.root, L.root, wShadow, lShadow);

    const fx = burst();
    const bolt = lightning();
    const party = confetti(90);
    party.group.visible = false;
    scene.add(fx.group, bolt.group, party.group);

    const crown = move === 'crown' ? buildCrown('#ffc107', 0) : null;
    if (crown) {
      crown.visible = false;
      crown.scale.setScalar(1.1);
      scene.add(crown);
    }
    const six = move === '67' ? digit(6) : null;
    const seven = move === '67' ? digit(7) : null;
    if (six && seven) {
      six.visible = seven.visible = false;
      scene.add(six, seven);
    }

    const ATTACK = 1.1;
    const IMPACT = move === 'lightning' ? 1.85 : 1.55;
    const DANCE = 2.5;
    const target = new THREE.Vector3();
    let shake = 0;

    return {
      update(t, dt) {
        W.resetPose();
        L.resetPose();

        // ---- entrada caminhando
        const intro = easeInOut(phase(t, 0, 0.9));
        let wx = lerp(-10, -2.3, intro);
        let lx = lerp(10, 2.3, intro);
        let wy = 0;
        W.root.rotation.y = PI / 2;
        L.root.rotation.y = -PI / 2;
        if (t < 0.9) {
          walk(W, t * 14);
          walk(L, t * 14 + 1);
        } else if (t < ATTACK) {
          // encarada: o rival se prepara
          L.armL.rotation.x = L.armR.rotation.x = -0.9;
          W.head.rotation.x = -0.1;
        }

        // ---- ataque
        if (move === 'kick') {
          const run = easeInOut(phase(t, ATTACK, 0.3));
          const air = phase(t, ATTACK + 0.2, 0.55);
          wx = lerp(-2.3, -0.4, run);
          wy = Math.sin(air * PI) * 1.6;
          if (t > ATTACK && t < ATTACK + 0.3) walk(W, t * 18);
          if (air > 0 && air < 1) {
            W.legR.rotation.x = -1.7 * Math.sin(clamp01(air * 1.6) * PI * 0.6);
            W.legL.rotation.x = 0.6;
            W.armL.rotation.x = 0.8;
            W.armR.rotation.x = 0.8;
          }
        } else if (move === 'lightning') {
          const up = easeOutBack(phase(t, ATTACK, 0.35));
          W.armL.rotation.z = -2.7 * up;
          W.armR.rotation.z = 2.7 * up;
        } else {
          const dash = easeInOut(phase(t, ATTACK, 0.3));
          const back = easeInOut(phase(t, IMPACT + 0.25, 0.6));
          wx = lerp(lerp(-2.3, 0.1, dash), -1.6, back);
          if (t > ATTACK && t < ATTACK + 0.3) walk(W, t * 18);
          const punch = phase(t, ATTACK + 0.22, 0.2) - phase(t, IMPACT + 0.2, 0.25);
          W.armR.rotation.x = -PI / 2 * clamp01(punch);
          W.armL.rotation.x = 0.5 * clamp01(punch);
          W.body.rotation.x = 0.15 * clamp01(punch);
        }

        // ---- rival derrubado
        const hit = phase(t, IMPACT, move === 'kick' ? 0.9 : 0.55);
        if (t >= IMPACT) {
          if (move === 'kick') {
            lx = 2.3 + easeInOut(hit) * 2.2;
            L.body.position.y = Math.sin(hit * PI) * 2.6;
            L.body.rotation.x = -hit * PI * 2.5;
          } else {
            lx = 2.3 + easeInOut(hit) * 0.8;
            L.body.rotation.x = (-PI / 2) * easeOutBounce(hit);
            // apoia as costas no chão enquanto tomba (o tronco tem 1 de espessura)
            L.body.position.y = 0.5 * Math.sin(-L.body.rotation.x);
          }
          if (hit >= 1) {
            // caído e tonto, de braços abertos
            L.body.rotation.x = -PI / 2;
            L.body.position.y = 0.5;
            L.armL.rotation.z = -1.2;
            L.armR.rotation.z = 1.2;
            L.head.rotation.y = Math.sin(t * 6) * 0.4;
          }
        } else if (move === 'lightning' && t > 1.3) {
          L.body.position.x = Math.sin(t * 60) * 0.08; // tremendo com os raios
        }
        if (move === 'lightning') {
          const strikes = [1.4, 1.62, 1.82, 2.6, 3.5, 4.4, 5.3];
          const on = strikes.some((s) => t > s && t < s + 0.12);
          target.set(lx, 1.5, 0);
          bolt.strike(target, on);
          if (on) shake = Math.max(shake, 0.25);
        } else {
          bolt.strike(target, false);
        }
        const k = (t - IMPACT) / 0.45;
        fx.group.position.set(lerp(wx, lx, 0.65), 3.4, 0.6);
        fx.set(clamp01(k));
        if (t > IMPACT && t < IMPACT + 0.05) shake = 0.45;

        // ---- comemoração
        const turn = easeInOut(phase(t, DANCE - 0.4, 0.4));
        W.root.rotation.y = lerp(PI / 2, 0.25, turn);
        if (t > DANCE) {
          dance(W, move, t - DANCE);
          party.group.visible = true;
          party.update(dt, t);
          if (crown) {
            const c = easeOutBounce(phase(t, DANCE + 0.2, 1.1));
            crown.visible = true;
            const headPos = new THREE.Vector3();
            W.head.getWorldPosition(headPos);
            crown.position.set(headPos.x, lerp(headPos.y + 7, headPos.y + 0.78, c), headPos.z);
            crown.rotation.y = t * 1.5;
          }
          if (six && seven) {
            const beat = Math.sin((t - DANCE) * PI * 4);
            six.visible = seven.visible = true;
            six.position.set(wx - 1.7, 6.7, 0.6);
            seven.position.set(wx + 1.7, 6.7, 0.6);
            six.scale.setScalar(0.9 + Math.max(0, beat) * 0.45);
            seven.scale.setScalar(0.9 + Math.max(0, -beat) * 0.45);
            six.rotation.y = seven.rotation.y = Math.sin(t * 2) * 0.3;
          }
        }

        W.root.position.set(wx, wy, 0);
        L.root.position.set(lx, 0, 0);
        wShadow.position.x = wx + W.body.position.x;
        wShadow.scale.setScalar(1 - Math.min(0.6, (wy + W.body.position.y) * 0.25));
        const lying = L.body.rotation.x < -1;
        lShadow.position.x = lx + (lying ? 2.4 : 0);
        lShadow.scale.set(lying ? 2.4 : 1, 1, 1);

        // ---- câmera: de lado durante a luta, depois gira ao redor do vencedor
        const orbit = easeInOut(phase(t, DANCE - 0.6, 1.2));
        const ang = lerp(0, 0.35, orbit) + (t > DANCE ? Math.sin((t - DANCE) * 0.5) * 0.45 : 0);
        // Durante a luta enquadra de x=-4 a x=9 (incluindo o rival caído); depois aproxima do vencedor.
        const fightDist = Math.min(24, 5.8 / (Math.tan((camera.fov * PI) / 360) * camera.aspect));
        // Na dança: largura suficiente para os braços e os números do 67 (±3,6) e altura até ~8.
        const tanHalf = Math.tan((camera.fov * PI) / 360);
        const danceDist = Math.max(11, 3.6 / (tanHalf * camera.aspect), 5 / tanHalf);
        const focusX = lerp(2.4, wx, orbit);
        const dist = lerp(fightDist, danceDist, orbit);
        camera.position.set(focusX + Math.sin(ang) * dist, lerp(4.6, 4.8, orbit), Math.cos(ang) * dist);
        camera.lookAt(focusX, lerp(2.4, 3.4, orbit), 0);
        if (shake > 0) {
          camera.position.x += (Math.random() - 0.5) * shake;
          camera.position.y += (Math.random() - 0.5) * shake;
          shake = Math.max(0, shake - dt * 1.5);
        }
        renderer.render(scene, camera);
      },
      dispose() {
        stage.dispose();
      },
    };
  };

export interface ShowcaseOptions {
  look: CharacterStyle;
  board: BoardStyle;
  bg: string;
  /** Se definido, o boneco fica dançando este movimento. */
  move?: string;
}

/** Vitrine: o boneco parado (respirando, acenando) ou dançando, com a câmera girando devagar. */
export const createShowcaseScene =
  ({ look, board, bg, move }: ShowcaseOptions): SceneFactory =>
  (renderer, width, height) => {
    const stage = buildStage(width, height, board, bg, 3.2);
    const { scene, camera } = stage;
    scene.fog = null;
    const A = buildAvatar(look);
    const shadow = blobShadow();
    scene.add(A.root, shadow);
    const crown = move === 'crown' ? buildCrown('#ffc107', 0) : null;
    if (crown) scene.add(crown);
    return {
      update(t) {
        A.resetPose();
        if (move) dance(A, move, t);
        else idle(A, t);
        if (crown) {
          const hp = new THREE.Vector3();
          A.head.getWorldPosition(hp);
          crown.position.set(hp.x, hp.y + 0.78, hp.z);
          crown.rotation.y = t;
        }
        shadow.position.x = A.body.position.x;
        const ang = Math.sin(t * 0.35) * 0.6;
        // Afasta a câmera em telas estreitas para os braços não saírem do quadro.
        const dist = Math.max(10.5, 2.9 / (Math.tan((camera.fov * PI) / 360) * camera.aspect));
        camera.position.set(Math.sin(ang) * dist, 4.2, Math.cos(ang) * dist);
        camera.lookAt(0, 2.7, 0);
        renderer.render(scene, camera);
      },
      dispose() {
        stage.dispose();
      },
    };
  };

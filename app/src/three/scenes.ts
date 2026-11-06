import * as THREE from 'three';
import type { BoardStyle, CharacterStyle } from '../lib/types';
import { Animator, applyPose, type Clip } from './anim';
import { buildAvatar, buildCrown, disposeTree } from './avatar';
import {
  DANCES,
  FLYING_KICK,
  GUARD_IDLE,
  HIT_FALL,
  IDLE,
  KO,
  KO_FAR,
  LAUNCHED,
  PUNCH,
  RUN,
  SHOCKED,
  SUMMON,
  WALK,
  WAVE,
} from './clips';
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

// ------------------------------------------------------------------ cenas
export interface FinaleOptions {
  winner: CharacterStyle;
  loser: CharacterStyle;
  move: string;
  board: BoardStyle;
  bg: string;
}

const tmpV = new THREE.Vector3();
const worldX = (o: THREE.Object3D) => o.getWorldPosition(tmpV).x;

/**
 * Finalização: os dois entram caminhando, o rival fica em guarda, o vencedor
 * ataca (soco, voadora ou raios, conforme o movimento), o rival cambaleia e cai,
 * e o vencedor se vira para a câmera e comemora com o movimento especial
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
    const wAnim = new Animator(WALK);
    const lAnim = new Animator(WALK, 0.31);

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

    const style = move === 'kick' ? 'kick' : move === 'lightning' ? 'lightning' : 'punch';
    const ARRIVE = 1.1;
    const ATTACK = 1.3;
    const DASH_END = 1.62;
    const IMPACT = style === 'kick' ? ATTACK + 0.55 : style === 'lightning' ? 1.75 : DASH_END + 0.34;
    const TURN = style === 'lightning' ? 2.9 : style === 'kick' ? 2.6 : 2.6;
    const DANCE = TURN + 0.45;
    const dance = DANCES[move] ?? DANCES.jamal;
    let shake = 0;
    const strikes = [1.75, 1.95, 2.15, 3.2, 4.1, 5.0, 5.9, 6.8];
    const headPos = new THREE.Vector3();

    // Agenda de cada boneco: [a partir de (s), clipe, duração da transição].
    type Slot = [number, Clip, number];
    const wPlan: Slot[] = [[0, WALK, 0], [ARRIVE, IDLE, 0.3]];
    const lPlan: Slot[] = [[0, WALK, 0], [ARRIVE, GUARD_IDLE, 0.3]];
    if (style === 'punch') {
      wPlan.push([ATTACK, RUN, 0.15], [DASH_END, PUNCH, 0.1]);
      lPlan.push([IMPACT - 0.02, HIT_FALL, 0.05], [IMPACT - 0.02 + HIT_FALL.duration, KO, 0.2]);
    } else if (style === 'kick') {
      wPlan.push([ATTACK, FLYING_KICK, 0.12]);
      lPlan.push([IMPACT, LAUNCHED, 0.05], [IMPACT + LAUNCHED.duration, KO_FAR, 0.2]);
    } else {
      wPlan.push([ATTACK, SUMMON, 0.2]);
      lPlan.push([IMPACT, SHOCKED, 0.08], [2.35, HIT_FALL, 0.12], [2.35 + HIT_FALL.duration, KO, 0.2]);
    }
    wPlan.push([TURN, IDLE, 0.35], [DANCE, dance, 0.4]);
    const follow = (anim: Animator, plan: Slot[], t: number) => {
      let slot = plan[0];
      for (const s of plan) if (t >= s[0]) slot = s;
      if (anim.current() !== slot[1]) anim.play(slot[1], slot[0], slot[2]);
    };

    return {
      update(t, dt) {
        follow(wAnim, wPlan, t);
        follow(lAnim, lPlan, t);

        // ---- deslocamentos no chão
        const intro = easeInOut(phase(t, 0, ARRIVE));
        const lx = lerp(10, 2.4, intro);
        let wx = lerp(-10, -2.4, intro);
        if (t >= ARRIVE) {
          if (style === 'punch') {
            wx = lerp(-2.4, 0.05, easeInOut(phase(t, ATTACK, DASH_END - ATTACK)));
            wx = lerp(wx, -1.4, easeInOut(phase(t, IMPACT + 0.45, 0.6)));
          } else if (style === 'kick') {
            wx = lerp(-2.4, 0.2, easeInOut(phase(t, ATTACK + 0.18, 0.5)));
            wx = lerp(wx, -1.2, easeInOut(phase(t, ATTACK + 1.1, 0.6)));
          } else {
            wx = lerp(-2.4, -1.6, easeInOut(phase(t, ATTACK, 0.8)));
          }
        }

        // ---- vira para a câmera e comemora
        let yaw = lerp(PI / 2, 0.25, easeInOut(phase(t, TURN, 0.45)));
        let wz = 0;
        if (move === 'airplane' && t >= DANCE) {
          // Voa em círculo em volta do ponto entre os dois, inclinando nas curvas.
          const a = (t - DANCE) * 1.6;
          const r = easeInOut(phase(t, DANCE, 0.6)) * 2.0;
          wx = -1.4 + 1.6 - Math.cos(a) * r;
          wz = Math.sin(a) * r;
          yaw = lerp(0.25, a + PI, easeInOut(phase(t, DANCE, 0.6)));
        }

        applyPose(W, wAnim.evaluate(t));
        applyPose(L, lAnim.evaluate(t));
        W.root.position.set(wx, 0, wz);
        W.root.rotation.y = yaw;
        L.root.position.set(lx, 0, 0);
        L.root.rotation.y = -PI / 2;
        scene.updateMatrixWorld();

        // ---- efeitos
        if (style === 'lightning') {
          const on = strikes.some((s) => t > s && t < s + 0.11);
          L.neck.getWorldPosition(headPos);
          bolt.strike(headPos.clone().setY(Math.max(1, headPos.y)), on);
          if (on) shake = Math.max(shake, 0.22);
        } else {
          bolt.strike(headPos, false);
        }
        L.neck.getWorldPosition(headPos);
        fx.group.position.set(headPos.x - 0.3, Math.max(1.5, headPos.y + 0.4), 0.6);
        fx.set(clamp01((t - IMPACT) / 0.45));
        if (t > IMPACT && t < IMPACT + 0.05) shake = style === 'kick' ? 0.6 : 0.45;

        if (t > DANCE) {
          party.group.visible = true;
          party.update(dt, t);
          if (crown) {
            const c = easeOutBounce(phase(t, DANCE + 0.2, 1.1));
            crown.visible = true;
            W.neck.getWorldPosition(headPos);
            crown.position.set(headPos.x, lerp(headPos.y + 7, headPos.y + 1.45, c), headPos.z);
            crown.rotation.y = t * 1.5;
          }
          if (six && seven) {
            const beat = Math.sin(((t - DANCE) / DANCES['67'].duration) * PI * 2);
            six.visible = seven.visible = true;
            six.position.set(wx - 1.7, 6.7, 0.6);
            seven.position.set(wx + 1.7, 6.7, 0.6);
            six.scale.setScalar(0.9 + Math.max(0, beat) * 0.45);
            seven.scale.setScalar(0.9 + Math.max(0, -beat) * 0.45);
            six.rotation.y = seven.rotation.y = Math.sin(t * 2) * 0.3;
          }
        }

        // ---- sombras acompanham o quadril (e se alongam com o rival deitado)
        W.pelvis.getWorldPosition(headPos);
        wShadow.position.set(headPos.x, 0.02, headPos.z);
        wShadow.scale.setScalar(Math.max(0.45, 1 - W.body.position.y * 0.18));
        L.spine.getWorldPosition(headPos);
        const lying = Math.abs(Math.sin(L.body.rotation.x)) > 0.8;
        lShadow.position.set(lying ? headPos.x : worldX(L.pelvis), 0.02, 0);
        lShadow.scale.set(lying ? 2.3 : 1, 1, 1);

        // ---- câmera: de lado durante a luta, depois gira ao redor do vencedor
        const orbit = easeInOut(phase(t, TURN - 0.2, 1.2));
        const tanHalf = Math.tan((camera.fov * PI) / 360);
        const fightDist = Math.min(24, 5.8 / (tanHalf * camera.aspect));
        const danceDist = Math.max(11, 3.6 / (tanHalf * camera.aspect), 5 / tanHalf);
        const ang = lerp(0, 0.35, orbit) + (t > DANCE ? Math.sin((t - DANCE) * 0.5) * 0.45 : 0);
        const focusX = lerp(2.0, move === 'airplane' ? 0.2 : wx, orbit);
        // No aviãozinho a câmera se afasta para o círculo inteiro caber no quadro.
        const dist = lerp(fightDist, danceDist + (move === 'airplane' ? 6 : 0), orbit);
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

/** Vitrine: o boneco parado (respirando, acenando de vez em quando) ou dançando, com a câmera girando devagar. */
export const createShowcaseScene =
  ({ look, board, bg, move }: ShowcaseOptions): SceneFactory =>
  (renderer, width, height) => {
    const stage = buildStage(width, height, board, bg, 3.2);
    const { scene, camera } = stage;
    scene.fog = null;
    const A = buildAvatar(look);
    const shadow = blobShadow();
    scene.add(A.root, shadow);
    const anim = new Animator(move ? (DANCES[move] ?? IDLE) : IDLE);
    let nextWave = 2.5;
    const crown = move === 'crown' ? buildCrown('#ffc107', 0) : null;
    if (crown) scene.add(crown);
    const p = new THREE.Vector3();
    return {
      update(t) {
        if (!move) {
          if (t >= nextWave) {
            anim.play(WAVE, t, 0.3);
            nextWave = t + 7;
          }
          if (anim.current() === WAVE && anim.finished(t)) anim.play(IDLE, t, 0.4);
        }
        applyPose(A, anim.evaluate(t));
        scene.updateMatrixWorld();
        if (crown) {
          A.neck.getWorldPosition(p);
          crown.position.set(p.x, p.y + 1.45, p.z);
          crown.rotation.y = t;
        }
        A.pelvis.getWorldPosition(p);
        shadow.position.set(p.x, 0.02, p.z);
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

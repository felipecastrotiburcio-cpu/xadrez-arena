import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FxLayer, Particles, Trail, knightGeo, noteGeo, starGeo, twinkles } from './fx';

/**
 * Itens especiais de cada boneco (comprados na loja). Cada item é preso a uma parte do
 * esqueleto (mão, antebraço, costas, cabeça) ou flutua ao lado do boneco, então acompanha
 * todas as animações. Itens longos se desviam sozinhos do corpo (bodyAvoider) e os que
 * flutuam seguem o boneco com um leve atraso. Os efeitos (rastros, partículas, brilhos)
 * rodam a cada quadro em tick().
 */
export type GearId =
  | 'gear_backpack'
  | 'gear_headphones'
  | 'gear_chain'
  | 'gear_fire_gloves'
  | 'gear_kunai'
  | 'gear_staff'
  | 'gear_gold_sword'
  | 'gear_jetpack'
  | 'gear_drone'
  | 'gear_shield';

export interface GearRig {
  root: THREE.Group;
  body: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  armT: number;
  front: number;
  chestW: number;
  HW: number;
  HD: number;
}

export interface GearFx {
  tick(t: number, dt: number): void;
  dispose(): void;
}

type Fx = (t: number, dt: number) => void;

const PI = Math.PI;
const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0, ...o });
const glowMat = (color: string, opacity = 0.85) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const emis = (color: string, intensity = 1, o: THREE.MeshStandardMaterialParameters = {}) =>
  mat(color, { emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.2, ...o });
const block = (w: number, h: number, d: number, r: number) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};
const gold = () => mat('#ffc83d', { metalness: 0.55, roughness: 0.26, emissive: new THREE.Color('#ffb300'), emissiveIntensity: 0.14 });
const darkGold = () => mat('#b8860b', { metalness: 0.5, roughness: 0.35 });
const steel = () => mat('#cfd8dc', { metalness: 0.55, roughness: 0.28 });
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Lâmina afinando até a ponta (ao longo de +y, base em y=0). */
function bladeGeo(w: number, len: number, thick: number, tip = 0.82) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, len * tip);
  s.lineTo(0, len);
  s.lineTo(-w / 2, len * tip);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.5, bevelSize: thick * 0.6, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Acompanha a velocidade de um ponto do boneco (para rastros e partículas que reagem ao movimento). */
function speedometer(obj: THREE.Object3D, local = V()) {
  const p = V();
  const last = V();
  const v = V();
  let first = true;
  return {
    pos: p,
    vel: v,
    update(dt: number) {
      obj.localToWorld(p.copy(local));
      if (first || dt <= 0) {
        last.copy(p);
        first = false;
      }
      v.subVectors(p, last).divideScalar(Math.max(dt, 1 / 120));
      last.copy(p);
      return v.length();
    },
  };
}

/** Item que flutua ao lado do boneco e o segue com um leve atraso. */
function floater(rig: GearRig, obj: THREE.Object3D, offset: THREE.Vector3, orbit?: { every: number; dur: number }): Fx {
  rig.root.add(obj);
  const p = V();
  const target = V();
  const up = V(0, 1, 0);
  let first = true;
  return (t, dt) => {
    rig.pelvis.getWorldPosition(p);
    rig.root.worldToLocal(p);
    let extra = 0;
    if (orbit) {
      const k = (t % orbit.every) / orbit.dur;
      if (k < 1) extra = (1 - Math.cos(k * PI)) * PI; // uma volta completa ao redor do boneco, suave
    }
    const off = offset.clone().applyAxisAngle(up, rig.body.rotation.y + extra);
    target.set(p.x + off.x, off.y + Math.max(0, p.y - 2.05) * 0.6 + Math.sin(t * 2.2) * 0.12, p.z + off.z);
    if (first || dt <= 0) {
      obj.position.copy(target);
      first = false;
    } else obj.position.lerp(target, 1 - Math.exp(-dt * 6));
    obj.rotation.y = rig.body.rotation.y + extra;
  };
}

/**
 * Mantém um item longo (preso à mão, construído ao longo de +y) fora do corpo e da cabeça:
 * parte da direção "natural" na mão e, se a lâmina entrar no tronco ou na cabeça, ou
 * apontar para dentro (cruzando o peito/rosto), empurra a direção para fora.
 * Funciona para qualquer animação, inclusive as que vierem no futuro.
 */
function bodyAvoider(rig: GearRig, hand: THREE.Group, item: THREE.Object3D, natural: THREE.Vector3, length: number) {
  const nat = natural.clone().normalize();
  const hq = new THREE.Quaternion();
  const hp = V();
  const d = V();
  const cur = V();
  const pelvis = V();
  const neck = V();
  const head = V();
  const p = V();
  const c = V();
  const seg = V();
  const up = V(0, 1, 0);
  const wq = new THREE.Quaternion();
  let first = true;
  const push = (center: THREE.Vector3, radius: number, s: number) => {
    const dist = p.distanceTo(center);
    if (dist < radius && dist > 1e-4) {
      const n = p.clone().sub(center).divideScalar(dist);
      d.addScaledVector(n, ((radius - dist) / s) * 1.1).normalize();
      return true;
    }
    return false;
  };
  return (dt: number) => {
    hand.getWorldQuaternion(hq);
    hand.getWorldPosition(hp);
    rig.pelvis.getWorldPosition(pelvis);
    rig.spine.localToWorld(neck.set(0, 1.95, 0));
    rig.head.getWorldPosition(head);
    d.copy(nat).applyQuaternion(hq);
    seg.subVectors(neck, pelvis);
    const segLen2 = seg.lengthSq();
    const u0 = Math.max(0, Math.min(1, hp.clone().sub(pelvis).dot(seg) / segLen2));
    const radial = hp.clone().sub(c.copy(pelvis).addScaledVector(seg, u0));
    radial.addScaledVector(seg, -radial.dot(seg) / segLen2);
    if (radial.lengthSq() > 1e-4) {
      radial.normalize();
      const k = d.dot(radial);
      if (k < 0.1) d.addScaledVector(radial, 0.1 - k).normalize();
    }
    for (let it = 0; it < 6; it++) {
      let hit = false;
      for (const s of [0.5, 1.0, 1.5, 2.0, length]) {
        p.copy(hp).addScaledVector(d, s);
        const u = Math.max(0, Math.min(1, p.clone().sub(pelvis).dot(seg) / segLen2));
        c.copy(pelvis).addScaledVector(seg, u);
        hit = push(c, rig.chestW / 2 + 0.45, s) || hit;
        hit = push(head, 1.05, s) || hit;
      }
      if (!hit) break;
    }
    if (first || dt <= 0) {
      cur.copy(d);
      first = false;
    } else cur.lerp(d, 1 - Math.exp(-dt * 18)).normalize();
    wq.setFromUnitVectors(up, cur);
    item.quaternion.copy(hq).invert().multiply(wq);
  };
}

/** Pêndulo simples (chaveiro, pingente) que reage ao movimento do ponto onde está preso. */
function pendulum(obj: THREE.Object3D, anchor: THREE.Object3D) {
  const sp = speedometer(anchor);
  let ax = 0;
  let az = 0;
  let vx = 0;
  let vz = 0;
  return (t: number, dt: number) => {
    sp.update(dt);
    const h = Math.min(dt, 0.05);
    vx += (-30 * ax - 4 * vx - sp.vel.z * 0.9) * h;
    vz += (-30 * az - 4 * vz + sp.vel.x * 0.9) * h;
    ax += vx * h;
    az += vz * h;
    obj.rotation.x = THREE.MathUtils.clamp(ax, -1, 1);
    obj.rotation.z = THREE.MathUtils.clamp(az + Math.sin(t * 2.3) * 0.08, -1, 1);
  };
}

export function addGear(rig: GearRig, id: GearId): GearFx | null {
  const layer = new FxLayer(rig.root);
  const fx: Fx[] = [];
  const out = (): GearFx => ({
    tick(t, dt) {
      layer.ensure();
      for (const f of fx) f(t, dt);
    },
    dispose: () => layer.dispose(),
  });
  const { armT, front } = rig;

  switch (id) {
    // ============================================================ ESPADA DOURADA (Rei)
    case 'gear_gold_sword': {
      const g = new THREE.Group();
      const ruby = emis('#e53935', 0.5, { roughness: 0.15 });
      // Cabo com tiras douradas, pomo com rubi
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.62, 12), mat('#6d1b1b', { roughness: 0.85 }), 0, 0.02, 0));
      for (const y of [-0.18, 0, 0.18]) g.add(mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 14), gold(), 0, y, 0).rotateX(PI / 2));
      g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), gold(), 0, -0.36, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.08), ruby, 0, -0.36, 0.12), mesh(new THREE.OctahedronGeometry(0.08), ruby, 0, -0.36, -0.12));
      // Guarda em forma de asas
      const wing = new THREE.Shape();
      wing.moveTo(0, -0.07);
      wing.quadraticCurveTo(0.35, -0.1, 0.55, 0.05);
      wing.quadraticCurveTo(0.68, 0.16, 0.62, 0.3);
      wing.quadraticCurveTo(0.5, 0.12, 0.3, 0.1);
      wing.quadraticCurveTo(0.12, 0.08, 0, 0.1);
      const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
      wingGeo.translate(0, 0, -0.05);
      const guard = new THREE.Group();
      guard.position.y = 0.36;
      guard.add(mesh(wingGeo, gold()), mesh(wingGeo.clone().scale(-1, 1, 1), gold()));
      guard.add(mesh(block(0.26, 0.24, 0.2, 0.07), gold()));
      guard.add(mesh(new THREE.OctahedronGeometry(0.1), ruby, 0, 0.02, 0.1), mesh(new THREE.OctahedronGeometry(0.1), ruby, 0, 0.02, -0.1));
      g.add(guard);
      // Lâmina com sulco central e aura
      const bladeMat = mat('#ffe9a6', { metalness: 0.75, roughness: 0.16, emissive: new THREE.Color('#ffb300'), emissiveIntensity: 0.25 });
      g.add(mesh(bladeGeo(0.27, 2.05, 0.05), bladeMat, 0, 0.46, 0));
      for (const z of [0.045, -0.045]) g.add(mesh(new THREE.BoxGeometry(0.05, 1.45, 0.02), darkGold(), 0, 1.25, z));
      const aura = mesh(bladeGeo(0.5, 2.35, 0.01), glowMat('#ffca28', 0.22), 0, 0.36, 0);
      g.add(aura);
      const shine = mesh(new THREE.PlaneGeometry(0.42, 0.42), glowMat('#fff3b0', 0), 0, 1.0, 0.06);
      g.add(shine);
      const glints = twinkles(g, [V(0, 1.9, 0.06), V(0.08, 1.2, -0.06), V(0, 0.55, 0.12)], '#fffde7', 0.32, 0.8);
      g.position.set(0, 0, 0.02);
      rig.handR.add(g);
      const avoid = bodyAvoider(rig, rig.handR, g, V(0.25, -0.1, 0.96), 2.45);
      const trail = new Trail(layer, 14, '#ffcc33', 0.2);
      const sparks = new Particles(layer, 40, new THREE.OctahedronGeometry(0.06), { gravity: -1.5, drag: 1.5 });
      const tip = V();
      const mid = V();
      const tipSpeed = speedometer(g, V(0, 2.3, 0));
      let acc = 0;
      fx.push((t, dt) => {
        avoid(dt);
        g.updateMatrixWorld();
        g.localToWorld(tip.set(0, 2.45, 0));
        g.localToWorld(mid.set(0, 1.0, 0));
        trail.push(mid, tip, t);
        const sp = tipSpeed.update(dt);
        acc += dt * (3 + Math.min(sp, 12) * 2.5);
        while (acc > 1) {
          acc -= 1;
          const u = Math.random();
          g.localToWorld(tip.set(0, 0.6 + u * 1.8, 0));
          sparks.spawn(tip, V(rand(-0.4, 0.4), rand(0.2, 1), rand(-0.4, 0.4)), rand(0.5, 0.9), rand(0.5, 1), Math.random() < 0.5 ? '#ffd54f' : '#fff8e1');
        }
        sparks.update(dt);
        const k = (t * 0.6) % 1;
        shine.position.y = 0.55 + k * 1.75;
        (shine.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * PI) * 0.6;
        shine.rotation.z = t * 4;
        (aura.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 3) * 0.06;
        glints(t);
      });
      return out();
    }

    // ============================================================ CAJADO ARCANO (Feiticeiro)
    case 'gear_staff': {
      const g = new THREE.Group();
      const wood = mat('#5d4037', { roughness: 0.85 });
      g.add(mesh(new THREE.CylinderGeometry(0.075, 0.1, 3.3, 12), wood, 0, -0.05, 0));
      // Fio dourado em espiral
      const helix = new THREE.CatmullRomCurve3(
        Array.from({ length: 40 }, (_, i) => {
          const u = i / 39;
          return V(Math.cos(u * PI * 10) * 0.1, -1.4 + u * 2.6, Math.sin(u * PI * 10) * 0.1);
        }),
      );
      g.add(mesh(new THREE.TubeGeometry(helix, 160, 0.022, 5), gold()));
      // Cristal na ponta de baixo
      const crystal = mesh(new THREE.OctahedronGeometry(0.16), emis('#b388ff', 0.6), 0, -1.78, 0);
      crystal.scale.y = 1.8;
      g.add(crystal);
      // Cabeça: lua crescente dourada segurando o orbe
      const crescent = mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 30, PI * 1.45), gold(), 0, 1.95, 0);
      crescent.rotation.z = -PI * 0.22 - PI / 2;
      g.add(crescent, mesh(new THREE.ConeGeometry(0.12, 0.3, 8), gold(), 0, 1.56, 0));
      const core = mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#f3e5ff' }), 0, 1.98, 0);
      const orb = mesh(new THREE.SphereGeometry(0.27, 20, 16), mat('#9c64ff', { emissive: new THREE.Color('#7c4dff'), emissiveIntensity: 0.9, roughness: 0.05, transparent: true, opacity: 0.7 }), 0, 1.98, 0);
      const halo = mesh(new THREE.SphereGeometry(0.5, 16, 12), glowMat('#b388ff', 0.2), 0, 1.98, 0);
      g.add(core, orb, halo);
      // Anéis de runas girando em volta do orbe
      const rings: THREE.Group[] = [];
      for (const [r, tilt] of [[0.62, 0.5], [0.78, -0.7]] as [number, number][]) {
        const ring = new THREE.Group();
        ring.position.y = 1.98;
        ring.rotation.x = tilt;
        ring.add(mesh(new THREE.TorusGeometry(r, 0.018, 6, 48), glowMat('#e1bee7', 0.8)));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          const rune = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), glowMat(i % 2 ? '#ffd54f' : '#e1bee7', 0.95), Math.cos(a) * r, 0, Math.sin(a) * r);
          rune.rotation.y = -a + PI / 4;
          ring.add(rune);
        }
        g.add(ring);
        rings.push(ring);
      }
      g.rotation.z = -0.12;
      const follow = floater(rig, g, V(1.55, 2.7, -1.25));
      // Círculo mágico no chão, sob o Feiticeiro
      const circle = new THREE.Group();
      circle.position.y = 0.035;
      const cm = (o: number) => glowMat('#a259ff', o);
      const flat = (geo: THREE.BufferGeometry, m: THREE.Material) => {
        const o = new THREE.Mesh(geo, m);
        o.rotation.x = -PI / 2;
        return o;
      };
      circle.add(flat(new THREE.RingGeometry(2.05, 2.15, 64), cm(0.65)), flat(new THREE.RingGeometry(1.55, 1.6, 64), cm(0.5)), flat(new THREE.CircleGeometry(2.15, 64), cm(0.07)));
      // Hexagrama
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        const b = a + (PI * 2) / 3;
        const p1 = V(Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55);
        const p2 = V(Math.cos(b) * 1.55, 0, Math.sin(b) * 1.55);
        const len = p1.distanceTo(p2);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), cm(0.55));
        line.rotation.set(-PI / 2, 0, -Math.atan2(p2.z - p1.z, p2.x - p1.x));
        line.position.set((p1.x + p2.x) / 2, 0, (p1.z + p2.z) / 2);
        circle.add(line);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        const tick = new THREE.Mesh(new THREE.PlaneGeometry(i % 2 ? 0.08 : 0.16, 0.3), cm(0.7));
        tick.rotation.set(-PI / 2, 0, -a);
        tick.position.set(Math.cos(a) * 1.85, 0, Math.sin(a) * 1.85);
        circle.add(tick);
      }
      rig.root.add(circle);
      const motes = new Particles(layer, 50, new THREE.OctahedronGeometry(0.05), { drag: 0.3, grow: -0.4 });
      const orbSparks = new Particles(layer, 30, starGeo(0.12), { drag: 1, grow: -0.8 });
      const pp = V();
      const orbW = V();
      let acc = 0;
      let acc2 = 0;
      fx.push((t, dt) => {
        follow(t, dt);
        rig.pelvis.getWorldPosition(pp);
        rig.root.worldToLocal(pp);
        circle.position.x = pp.x;
        circle.position.z = pp.z;
        circle.rotation.y = t * 0.35;
        circle.scale.setScalar(1 + Math.sin(t * 1.5) * 0.02);
        halo.scale.setScalar(1 + Math.sin(t * 5) * 0.14);
        rings[0].rotation.y = t * 1.4;
        rings[1].rotation.y = -t * 1.1;
        crystal.rotation.y = t * 2;
        acc += dt * 14;
        while (acc > 1) {
          acc -= 1;
          const a = Math.random() * PI * 2;
          const r = rand(1.5, 2.1);
          circle.localToWorld(pp.set(Math.cos(a) * r, 0.05, Math.sin(a) * r));
          motes.spawn(pp, V(0, rand(0.6, 1.4), 0), rand(1.2, 2), rand(0.6, 1.2), Math.random() < 0.6 ? '#b388ff' : '#ffd54f');
        }
        motes.update(dt);
        acc2 += dt * 6;
        orb.getWorldPosition(orbW);
        while (acc2 > 1) {
          acc2 -= 1;
          orbSparks.spawn(orbW, V(rand(-0.8, 0.8), rand(-0.3, 0.9), rand(-0.8, 0.8)), rand(0.5, 0.8), rand(0.6, 1), '#f3e5ff');
        }
        orbSparks.update(dt);
      });
      return out();
    }

    // ============================================================ KUNAIS DE ENERGIA (Ninja)
    case 'gear_kunai': {
      const trails: { g: THREE.Group; trail: Trail }[] = [];
      const sparks = new Particles(layer, 40, new THREE.OctahedronGeometry(0.035), { drag: 4, grow: -1 });
      const energy = emis('#18ffff', 1.2);
      for (const hand of [rig.handL, rig.handR]) {
        const g = new THREE.Group();
        // Cabo enrolado (faixas pretas e vermelhas) e argola
        for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.075, 10), mat(i % 2 ? '#c62828' : '#1b1b1f', { roughness: 0.8 }), 0, -0.2 - i * 0.075, 0));
        g.add(mesh(new THREE.TorusGeometry(0.11, 0.032, 8, 18), steel(), 0, -0.5, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.08, 10), steel(), 0, -0.13, 0));
        // Lâmina: núcleo de energia + bordas de aço + brilho
        const blade = new THREE.Group();
        blade.position.y = -0.62;
        blade.rotation.z = PI;
        blade.add(mesh(bladeGeo(0.28, 1.0, 0.05, 0.7), steel()));
        blade.add(mesh(bladeGeo(0.14, 0.86, 0.07, 0.7), energy, 0, 0.04, 0));
        blade.add(mesh(bladeGeo(0.5, 1.2, 0.01, 0.7), glowMat('#00e5ff', 0.25), 0, -0.05, 0));
        g.add(blade);
        g.rotation.x = 0.7;
        hand.add(g);
        trails.push({ g, trail: new Trail(layer, 12, '#00e5ff', 0.18) });
      }
      const a = V();
      const b = V();
      let acc = 0;
      fx.push((t, dt) => {
        energy.emissiveIntensity = 0.9 + Math.abs(Math.sin(t * 9)) * 0.6;
        acc += dt * 16;
        for (const { g, trail } of trails) {
          g.updateMatrixWorld();
          g.localToWorld(a.set(0, -0.9, 0));
          g.localToWorld(b.set(0, -1.62, 0));
          trail.push(a, b, t);
        }
        while (acc > 1) {
          acc -= 1;
          const { g } = trails[Math.random() < 0.5 ? 0 : 1];
          g.localToWorld(a.set(rand(-0.12, 0.12), -0.7 - Math.random() * 0.9, 0));
          sparks.spawn(a, V(rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-1.5, 1.5)), rand(0.1, 0.22), rand(0.8, 1.4), Math.random() < 0.7 ? '#84ffff' : '#ffffff');
        }
        sparks.update(dt);
      });
      return out();
    }

    // ============================================================ LUVAS DE FOGO (Lutador)
    case 'gear_fire_gloves': {
      const groups: { hand: THREE.Group; fire: THREE.Group; flames: THREE.Mesh[]; sp: ReturnType<typeof speedometer>; acc: number }[] = [];
      const flameGeo = (r: number, h: number) => {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          pts.push(new THREE.Vector2(r * Math.sin(PI * Math.min(1, u * 1.6)) * (1 - u) ** 0.6, u * h));
        }
        return new THREE.LatheGeometry(pts, 10);
      };
      const embers = new Particles(layer, 70, new THREE.OctahedronGeometry(0.05), { gravity: 1.2, drag: 1.2, grow: -0.7 });
      const puffs = new Particles(layer, 40, new THREE.SphereGeometry(0.2, 10, 8), { gravity: 2, drag: 2.5, grow: 0.4, spin: 0 });
      for (const hand of [rig.handL, rig.handR]) {
        // Luva com placas nos dedos e punho com listras
        hand.add(mesh(block(armT * 0.98, 0.6, armT * 1.02, 0.22), mat('#c62828', { roughness: 0.35 }), 0, 0.02, 0));
        for (let i = 0; i < 4; i++) hand.add(mesh(block(armT * 0.2, 0.14, 0.12, 0.05), mat('#37474f', { metalness: 0.6, roughness: 0.3 }), (i - 1.5) * armT * 0.22, -0.14, armT * 0.5 + 0.02));
        hand.add(mesh(block(armT * 1.06, 0.2, armT * 1.08, 0.07), mat('#212121', { roughness: 0.6 }), 0, 0.34, 0));
        hand.add(mesh(block(armT * 1.08, 0.05, armT * 1.1, 0.02), emis('#ff6d00', 0.8), 0, 0.34, 0));
        hand.add(mesh(new THREE.SphereGeometry(0.55, 16, 12), glowMat('#ff6d00', 0.16), 0, -0.05, 0));
        const fire = new THREE.Group();
        hand.add(fire);
        const flames: THREE.Mesh[] = [];
        const spec: [number, number, number, number, string, number][] = [
          [0, 0, 0.58, 1.55, '#ff3d00', 0.5],
          [0.3, 0.18, 0.34, 1.15, '#ff6d00', 0.65],
          [-0.32, 0.12, 0.32, 1.0, '#ff6d00', 0.65],
          [0.08, -0.32, 0.34, 1.1, '#ff9100', 0.65],
          [-0.1, 0.3, 0.3, 0.95, '#ff9100', 0.65],
          [0, 0.02, 0.36, 1.05, '#ffd600', 0.8],
          [0.06, -0.04, 0.2, 0.75, '#fffde7', 0.85],
        ];
        for (const [x, z, r, h, c, o] of spec) {
          const f = mesh(flameGeo(r, h), glowMat(c, o), x, -0.3, z);
          fire.add(f);
          flames.push(f);
        }
        groups.push({ hand, fire, flames, sp: speedometer(hand), acc: 0 });
      }
      const q = new THREE.Quaternion();
      const p = V();
      fx.push((t, dt) => {
        groups.forEach((G, gi) => {
          G.hand.getWorldQuaternion(q);
          G.fire.quaternion.copy(q).invert();
          G.flames.forEach((f, i) => {
            const k = t * 11 + i * 1.9 + gi * 3;
            f.scale.set(1 + Math.sin(k * 1.3) * 0.08, 0.8 + Math.abs(Math.sin(k)) * 0.45, 1 + Math.cos(k * 1.1) * 0.08);
            f.rotation.z = Math.sin(k * 0.7) * 0.12;
          });
          // Quanto mais rápido o soco, mais fogo fica para trás.
          const speed = G.sp.update(dt);
          G.acc += dt * (10 + Math.min(speed, 14) * 2.5);
          while (G.acc > 1) {
            G.acc -= 1;
            p.copy(G.sp.pos).add(V(rand(-0.3, 0.3), rand(-0.1, 0.4), rand(-0.3, 0.3)));
            embers.spawn(p, V(rand(-0.4, 0.4), rand(0.8, 2), rand(-0.4, 0.4)), rand(0.5, 1.1), rand(0.6, 1.3), ['#ffd600', '#ff9100', '#ff3d00'][Math.floor(Math.random() * 3)]);
            if (speed > 5 && Math.random() < 0.22) puffs.spawn(p, V(0, 0.4, 0), rand(0.2, 0.35), rand(0.8, 1.3), Math.random() < 0.5 ? '#ff6d00' : '#ff3d00');
          }
        });
        embers.update(dt);
        puffs.update(dt);
      });
      return out();
    }

    // ============================================================ ESCUDO DA TORRE (Guardião)
    case 'gear_shield': {
      const g = new THREE.Group();
      // Formato de escudo (reto em cima, ponta embaixo), em pé no plano YZ
      const shape = (w: number, h: number) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, h / 2);
        s.lineTo(w / 2, h / 2);
        s.lineTo(w / 2, -h * 0.1);
        s.quadraticCurveTo(w / 2, -h * 0.38, 0, -h / 2);
        s.quadraticCurveTo(-w / 2, -h * 0.38, -w / 2, -h * 0.1);
        s.closePath();
        return s;
      };
      const plate = (w: number, h: number, depth: number, m: THREE.Material, x: number) => {
        const geo = new THREE.ExtrudeGeometry(shape(w, h), { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
        geo.translate(0, 0, -depth / 2);
        geo.rotateY(PI / 2);
        return mesh(geo, m, x, 0, 0);
      };
      g.add(plate(1.3, 1.75, 0.1, steel(), 0.02));
      g.add(plate(1.12, 1.56, 0.1, mat('#1565c0', { roughness: 0.4 }), -0.04));
      g.add(plate(0.9, 1.3, 0.06, mat('#0d47a1', { roughness: 0.45 }), -0.09));
      g.add(plate(1.0, 1.42, 0.02, gold(), -0.08));
      // Rebites na borda
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), gold(), -0.09, Math.sin(a) * 0.72 + 0.05, Math.cos(a) * 0.56));
      }
      // Torre do xadrez em ouro com gema
      const rook = new THREE.Group();
      const gp = gold();
      rook.add(mesh(block(0.08, 0.16, 0.6, 0.03), gp, 0, -0.42, 0));
      rook.add(mesh(block(0.08, 0.12, 0.48, 0.03), gp, 0, -0.29, 0));
      rook.add(mesh(block(0.08, 0.5, 0.36, 0.03), gp, 0, 0.0, 0));
      rook.add(mesh(block(0.08, 0.14, 0.5, 0.03), gp, 0, 0.3, 0));
      for (const z of [-0.19, 0, 0.19]) rook.add(mesh(block(0.08, 0.16, 0.11, 0.02), gp, 0, 0.44, z));
      const gem = mesh(new THREE.OctahedronGeometry(0.09), emis('#40c4ff', 0.8), -0.06, 0.02, 0);
      rook.add(gem);
      rook.position.set(-0.14, 0.02, 0);
      g.add(rook);
      // Faixa de luz que passa pela frente
      const sweep = mesh(new THREE.PlaneGeometry(0.18, 1.6), glowMat('#ffffff', 0));
      sweep.rotation.y = -PI / 2;
      sweep.position.x = -0.16;
      g.add(sweep);
      // Barreira de energia hexagonal (pulsa de tempos em tempos)
      const barrier = new THREE.Group();
      barrier.position.x = -0.35;
      const hexM = glowMat('#40c4ff', 0.9);
      const hexFill = glowMat('#40c4ff', 0.12);
      const hex = (r: number, x: number, y: number, m = hexM, fill = false) => {
        if (fill) {
          const c = mesh(new THREE.CircleGeometry(r, 6), hexFill, 0, y, x);
          c.rotation.y = -PI / 2;
          c.rotation.z = PI / 6;
          barrier.add(c);
        }
        const ring = mesh(new THREE.RingGeometry(r * 0.9, r, 6), m, 0, y, x);
        ring.rotation.y = -PI / 2;
        ring.rotation.z = PI / 6;
        barrier.add(ring);
      };
      const R = 0.32;
      hex(R, 0, 0, hexM, true);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + PI / 6;
        hex(R, Math.cos(a) * R * 1.75, Math.sin(a) * R * 1.75, hexM, true);
      }
      g.add(barrier);
      g.position.set(-(armT / 2 + 0.17), -0.4, 0.05);
      rig.elbowL.add(g);
      const bits = new Particles(layer, 30, new THREE.OctahedronGeometry(0.05), { drag: 2, grow: -0.8 });
      const p = V();
      fx.push((t, dt) => {
        const k = (t * 0.45) % 1;
        sweep.position.z = -0.7 + k * 1.4;
        sweep.rotation.x = 0.4;
        (sweep.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * PI) * 0.45;
        gem.rotation.y = t * 2;
        // Barreira: aparece a cada 3,5 s, cresce e some.
        const b = (t % 3.5) / 0.9;
        const on = b < 1;
        barrier.visible = on;
        if (on) {
          barrier.scale.setScalar(0.5 + b * 0.9);
          hexM.opacity = (1 - b) * 0.9;
          hexFill.opacity = (1 - b) * 0.18;
          if (b < 0.15 && Math.random() < 0.6) {
            barrier.getWorldPosition(p);
            for (let i = 0; i < 2; i++) bits.spawn(p, V(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5)), rand(0.3, 0.6), rand(0.8, 1.3), '#80d8ff');
          }
        }
        bits.update(dt);
      });
      return out();
    }

    // ============================================================ JETPACK TURBO (Robô)
    case 'gear_jetpack': {
      const g = new THREE.Group();
      const dark = mat('#37474f', { metalness: 0.45, roughness: 0.4 });
      const st = steel();
      const red = mat('#e53935', { roughness: 0.3, metalness: 0.2 });
      g.add(mesh(block(1.3, 1.15, 0.32, 0.1), dark, 0, 0, 0.1));
      for (const y of [0.35, -0.35]) g.add(mesh(block(1.34, 0.06, 0.36, 0.02), st, 0, y, 0.1));
      // Manômetro no topo
      const gauge = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), st, 0, 0.3, -0.07);
      gauge.rotation.x = PI / 2;
      const needle = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), red, 0, 0.3, -0.11);
      g.add(gauge, mesh(new THREE.CircleGeometry(0.13, 20), mat('#fafafa'), 0, 0.3, -0.105).rotateY(PI), needle);
      const nozzleGlow: THREE.Mesh[] = [];
      const flames: THREE.Mesh[] = [];
      for (const x of [-0.42, 0.42]) {
        g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.25, 18), st, x, 0, -0.2));
        g.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 18), red, x, 0.3, -0.2));
        g.add(mesh(new THREE.SphereGeometry(0.28, 18, 8, 0, PI * 2, 0, PI / 2), red, x, 0.62, -0.2));
        g.add(mesh(new THREE.CylinderGeometry(0.21, 0.29, 0.28, 16, 1, true), dark, x, -0.76, -0.2));
        const glow = mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: '#ffab00' }), x, -0.89, -0.2);
        glow.rotation.x = PI / 2;
        g.add(glow);
        nozzleGlow.push(glow);
        // Aleta lateral
        const fin = new THREE.Shape();
        fin.moveTo(0, 0);
        fin.lineTo(0.3, -0.25);
        fin.lineTo(0.3, -0.55);
        fin.lineTo(0, -0.4);
        const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: false });
        const f = mesh(finGeo, red, x + Math.sign(x) * 0.26, -0.15, -0.22);
        if (x < 0) f.scale.x = -1;
        g.add(f);
        for (const [r, h, c, o] of [[0.22, 1.0, '#ff6d00', 0.6], [0.16, 0.75, '#ffd600', 0.8], [0.09, 0.5, '#ffffff', 0.95]] as [number, number, string, number][]) {
          const fl = mesh(new THREE.ConeGeometry(r, h, 12, 1, true), glowMat(c, o), x, -0.9 - h / 2, -0.2);
          fl.rotation.x = PI;
          fl.userData.h = h;
          g.add(fl);
          flames.push(fl);
        }
      }
      g.position.set(0, 1.25, -0.74);
      rig.spine.add(g);
      const smoke = new Particles(layer, 30, new THREE.SphereGeometry(0.2, 12, 8), { additive: false, opacity: 0.16, gravity: 0.8, drag: 2, grow: 1.6, spin: 0.5 });
      const sparks = new Particles(layer, 40, new THREE.OctahedronGeometry(0.04), { gravity: -6, drag: 0.5, grow: -0.5 });
      const p = V();
      const pel = V();
      const c0 = V();
      let acc = 0;
      fx.push((t, dt) => {
        rig.pelvis.getWorldPosition(pel);
        rig.root.worldToLocal(pel);
        const boost = THREE.MathUtils.clamp(1 + (pel.y - 2.05) * 0.8, 1, 2);
        flames.forEach((f, i) => {
          const s = (0.8 + Math.abs(Math.sin(t * 19 + i * 1.3)) * 0.4) * boost;
          f.scale.set(1, s, 1);
          f.position.y = -0.9 - (f.userData.h * s) / 2;
        });
        nozzleGlow.forEach((n) => ((n.material as THREE.MeshBasicMaterial).color.setHSL(0.1, 1, 0.55 + Math.sin(t * 25) * 0.1)));
        needle.rotation.z = Math.sin(t * 3) * 0.6 - 0.3 * boost;
        acc += dt * 10 * boost;
        g.updateMatrixWorld();
        while (acc > 1) {
          acc -= 1;
          const x = Math.random() < 0.5 ? -0.42 : 0.42;
          g.localToWorld(p.set(x, -1.6 * boost, -0.2));
          // Fumaça só quando o jato aponta para baixo (de cabeça para baixo, só faíscas).
          if (p.y < g.getWorldPosition(c0).y - 0.5 && Math.random() < 0.6) smoke.spawn(p, V(rand(-0.3, 0.3), rand(-1.2, -0.5), rand(-0.5, 0)), rand(0.6, 1), rand(0.7, 1.0), Math.random() < 0.5 ? '#9e9e9e' : '#cfd8dc');
          if (Math.random() < 0.6) {
            g.localToWorld(p.set(x, -1.1, -0.2));
            sparks.spawn(p, V(rand(-1, 1), rand(-3, -1), rand(-1, 1)), rand(0.3, 0.6), rand(0.8, 1.3), Math.random() < 0.5 ? '#ffd600' : '#ff9100');
          }
        }
        smoke.update(dt);
        sparks.update(dt);
      });
      return out();
    }

    // ============================================================ DRONE COMPANHEIRO (Astronauta)
    case 'gear_drone': {
      const g = new THREE.Group();
      const shell = mat('#eceff1', { roughness: 0.25, metalness: 0.1 });
      const darkM = mat('#37474f', { roughness: 0.4, metalness: 0.3 });
      g.add(mesh(new THREE.SphereGeometry(0.36, 22, 16), shell));
      g.add(mesh(new THREE.TorusGeometry(0.365, 0.04, 8, 30), mat('#ff7043'), 0, 0, 0).rotateX(PI / 2));
      const led = emis('#00e5ff', 1);
      g.add(mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 30), led, 0, -0.18, 0).rotateX(PI / 2));
      // Câmera (lente com íris brilhante)
      const lensHolder = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.14, 18), darkM, 0, -0.05, 0.3);
      lensHolder.rotation.x = PI / 2;
      const iris = mesh(new THREE.CircleGeometry(0.11, 18), new THREE.MeshBasicMaterial({ color: '#18ffff' }), 0, -0.05, 0.375);
      g.add(lensHolder, iris, mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: '#80deea', transparent: true, opacity: 0.35, roughness: 0.05 }), 0, -0.05, 0.37).rotateX(PI / 2));
      // Antena
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), darkM, 0.12, 0.5, -0.1));
      const tipLight = mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff1744' }), 0.12, 0.68, -0.1);
      g.add(tipLight);
      // Braços, motores e hélices (com disco de borrão)
      const rotors: THREE.Group[] = [];
      for (const [x, z] of [[-0.62, 0.36], [0.62, 0.36], [-0.62, -0.36], [0.62, -0.36]]) {
        const arm = mesh(block(0.62, 0.07, 0.1, 0.03), shell, x / 2, 0.08, z / 2);
        arm.rotation.y = -Math.atan2(z, x);
        g.add(arm, mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 12), darkM, x, 0.1, z));
        const r = new THREE.Group();
        r.position.set(x, 0.2, z);
        r.add(mesh(block(0.56, 0.02, 0.08, 0.01), darkM), mesh(block(0.08, 0.02, 0.56, 0.01), darkM));
        const blur = mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: '#b0bec5', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
        blur.rotation.x = -PI / 2;
        r.add(blur);
        g.add(r);
        rotors.push(r);
      }
      g.scale.setScalar(1.3);
      const follow = floater(rig, g, V(-2.0, 4.6, -0.3), { every: 9, dur: 2.2 });
      // Feixe de escaneamento até o chão
      const beam = mesh(new THREE.ConeGeometry(0.9, 1, 24, 1, true), glowMat('#18ffff', 0.16));
      beam.visible = false;
      const spot = new THREE.Group();
      const spotRing = mesh(new THREE.RingGeometry(0.75, 0.85, 40), glowMat('#18ffff', 0.8));
      spotRing.rotation.x = -PI / 2;
      const spotLine = mesh(new THREE.PlaneGeometry(1.7, 0.05), glowMat('#18ffff', 0.9));
      spotLine.rotation.x = -PI / 2;
      spot.add(spotRing, spotLine);
      spot.visible = false;
      rig.root.add(beam, spot);
      const pix = new Particles(layer, 30, new THREE.BoxGeometry(0.07, 0.07, 0.07), { drag: 1, grow: -0.9, spin: 0 });
      const dp = V();
      const lp = V();
      fx.push((t, dt) => {
        follow(t, dt);
        rotors.forEach((r, i) => (r.rotation.y = t * 45 * (i % 2 ? 1 : -1)));
        tipLight.visible = Math.sin(t * 6) > 0;
        led.emissive.setHSL((t * 0.15) % 1, 1, 0.5);
        led.color.copy(led.emissive);
        g.rotation.z = Math.sin(t * 1.7) * 0.1;
        // Escaneia por 1,6 s a cada 5 s
        const k = (t % 5) / 1.6;
        const scanning = k < 1;
        beam.visible = spot.visible = scanning;
        g.updateMatrixWorld();
        g.localToWorld(dp.set(0, -0.1, 0.25));
        rig.root.worldToLocal(dp);
        if (scanning) {
          const sx = dp.x + Math.sin(k * PI * 2) * 0.8;
          const sz = dp.z + 0.6 + Math.cos(k * PI * 2) * 0.4;
          const h = dp.y;
          beam.position.set((dp.x + sx) / 2, h / 2, (dp.z + sz) / 2);
          beam.scale.set(1, h, 1);
          beam.lookAt(V(sx, 0, sz).applyMatrix4(rig.root.matrixWorld));
          beam.rotateX(PI / 2);
          spot.position.set(sx, 0.04, sz);
          spotLine.position.z = Math.sin(k * PI * 6) * 0.7;
          const o = Math.sin(k * PI);
          (beam.material as THREE.MeshBasicMaterial).opacity = 0.16 * o;
          (spotRing.material as THREE.MeshBasicMaterial).opacity = 0.8 * o;
          if (Math.random() < 0.5) {
            lp.set(sx + rand(-0.7, 0.7), 0.1, sz + rand(-0.7, 0.7)).applyMatrix4(rig.root.matrixWorld);
            pix.spawn(lp, V(0, rand(0.8, 1.6), 0), rand(0.4, 0.8), rand(0.8, 1.3), Math.random() < 0.5 ? '#18ffff' : '#ffffff');
          }
        }
        pix.update(dt);
      });
      return out();
    }

    // ============================================================ CORRENTE DE OURO (Descolado)
    case 'gear_chain': {
      const g = new THREE.Group();
      const gp = gold();
      const links = 22;
      for (let i = 0; i < links; i++) {
        const u = i / (links - 1);
        const x = (u - 0.5) * 1.0;
        const y = 1.99 - (1 - (2 * u - 1) ** 2) * 0.66;
        const l = mesh(new THREE.TorusGeometry(0.07, 0.03, 8, 12), gp, x, y, front + 0.07);
        l.scale.set(1.25, 1, 1);
        l.rotation.set(i % 2 ? PI / 2 : 0, 0, Math.atan2(-(2 * u - 1) * 1.32, 1.0) + PI / 2);
        g.add(l);
      }
      // Medalhão: disco com borda de diamantes e cavalo do xadrez em relevo
      const med = new THREE.Group();
      med.position.set(0, 1.12, front + 0.1);
      med.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 28), gp).rotateX(PI / 2));
      med.add(mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 28), darkGold()));
      const ice = mat('#e0f7fa', { roughness: 0.05, metalness: 0.2, emissive: new THREE.Color('#b2ebf2'), emissiveIntensity: 0.5 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * PI * 2;
        med.add(mesh(new THREE.OctahedronGeometry(0.035), ice, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.04));
      }
      const kn = mesh(knightGeo(0.04), gp, 0, 0.02, 0.03);
      kn.scale.setScalar(0.34);
      med.add(kn, mesh(new THREE.OctahedronGeometry(0.06), mat('#00e5ff', { roughness: 0.05, emissive: new THREE.Color('#00b8d4'), emissiveIntensity: 0.7 }), 0.03, 0.05, 0.08));
      g.add(med);
      rig.spine.add(g);
      const flare = mesh(starGeo(1, 0.12), glowMat('#ffffff', 1), 0, 0.05, 0.14);
      med.add(flare);
      const tw = twinkles(g, [V(-0.42, 1.78, front + 0.12), V(0.4, 1.7, front + 0.12), V(-0.2, 1.42, front + 0.12), V(0.22, 1.4, front + 0.12)], '#fffde7', 0.18, 1.3);
      // Relógio de ouro no pulso esquerdo e anéis na mão direita
      const watch = new THREE.Group();
      watch.position.y = -0.62;
      watch.add(mesh(block(armT * 1.0, 0.16, armT * 1.0, 0.05), gp));
      const face = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), mat('#102027'), armT * 0.2, 0, armT * 0.5 + 0.02);
      face.rotation.x = PI / 2;
      watch.add(face, mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), ice, armT * 0.2, 0, armT * 0.5 + 0.05));
      rig.elbowL.add(watch);
      for (const x of [-0.12, 0.12]) rig.handR.add(mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14), gp, x, -0.08, armT * 0.47).rotateY(PI / 2));
      const shine = new Particles(layer, 20, starGeo(0.12), { drag: 2, grow: -0.9 });
      const mp = V();
      fx.push((t, dt) => {
        tw(t);
        const k = (t % 2.6) / 0.5;
        flare.scale.setScalar(k < 1 ? Math.sin(k * PI) * 0.45 + 0.0001 : 0.0001);
        flare.rotation.z = t;
        med.rotation.z = Math.sin(t * 2.1) * 0.08;
        if (k < 0.1 && Math.random() < 0.5) {
          med.getWorldPosition(mp);
          for (let i = 0; i < 2; i++) shine.spawn(mp, V(rand(-1, 1), rand(-0.5, 1), rand(0, 1)), rand(0.4, 0.7), rand(0.8, 1.2), '#ffffff');
        }
        shine.update(dt);
      });
      return out();
    }

    // ============================================================ FONE NEON (Estiloso)
    case 'gear_headphones': {
      const g = new THREE.Group();
      const body = mat('#1e1e24', { roughness: 0.35, metalness: 0.2 });
      const neon = emis('#00e676', 1);
      const cushion = mat('#424242', { roughness: 0.9 });
      const bars: THREE.Mesh[] = [];
      const cupX = rig.HW / 2 + 0.12;
      for (const s of [-1, 1]) {
        const cup = new THREE.Group();
        cup.position.set(s * cupX, -0.02, 0);
        cup.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 22), body).rotateZ(PI / 2));
        cup.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 22), cushion, -s * 0.12, 0, 0).rotateZ(PI / 2));
        cup.add(mesh(new THREE.TorusGeometry(0.29, 0.04, 8, 24), neon, s * 0.11, 0, 0).rotateY(PI / 2));
        // Equalizador animado na face de fora
        for (let i = 0; i < 5; i++) {
          const b = mesh(new THREE.BoxGeometry(0.02, 0.3, 0.06), neon, s * 0.115, 0, (i - 2) * 0.09);
          cup.add(b);
          bars.push(b);
        }
        g.add(cup);
      }
      // Arco por trás da cabeça com reguladores
      const band = mesh(new THREE.TorusGeometry(cupX, 0.08, 10, 30, PI), body, 0, -0.02, 0);
      band.rotation.x = -PI / 2;
      band.rotation.z = PI;
      band.scale.y = (rig.HD / 2 + 0.22) / cupX;
      g.add(band);
      for (const s of [-1, 1]) g.add(mesh(block(0.08, 0.12, 0.3, 0.03), mat('#9e9e9e', { metalness: 0.6, roughness: 0.3 }), s * (cupX + 0.02), -0.02, -0.25));
      // Microfone
      const micArm = new THREE.CatmullRomCurve3([V(-cupX - 0.1, -0.1, 0.1), V(-cupX + 0.05, -0.35, 0.45), V(-0.25, -0.42, rig.HD / 2 + 0.1)]);
      g.add(mesh(new THREE.TubeGeometry(micArm, 20, 0.025, 6), body));
      const micTip = mesh(new THREE.SphereGeometry(0.07, 10, 8), neon, -0.25, -0.42, rig.HD / 2 + 0.1);
      g.add(micTip);
      rig.head.add(g);
      // Ondas sonoras saindo das conchas
      const waves: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const w = mesh(new THREE.RingGeometry(0.3, 0.34, 32), glowMat('#00e676', 0));
        w.rotation.y = PI / 2;
        w.userData.side = i % 2 ? 1 : -1;
        w.userData.phase = Math.floor(i / 2) / 3;
        g.add(w);
        waves.push(w);
      }
      const notes = new Particles(layer, 16, noteGeo(), { drag: 0.6, grow: -0.3, spin: 0 });
      const np = V();
      let acc = 0;
      const col = new THREE.Color();
      fx.push((t, dt) => {
        col.setHSL((t * 0.12) % 1, 1, 0.55);
        neon.color.copy(col);
        neon.emissive.copy(col);
        bars.forEach((b, i) => (b.scale.y = 0.25 + Math.abs(Math.sin(t * (6 + (i % 5)) + i * 1.7)) * 0.9));
        waves.forEach((w) => {
          const k = (t * 0.8 + w.userData.phase) % 1;
          w.position.x = w.userData.side * (cupX + 0.15 + k * 0.6);
          w.scale.setScalar(1 + k * 1.4);
          (w.material as THREE.MeshBasicMaterial).color.copy(col);
          (w.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
        });
        acc += dt * 1.6;
        while (acc > 1) {
          acc -= 1;
          const s = Math.random() < 0.5 ? -1 : 1;
          rig.head.localToWorld(np.set(s * (cupX + 0.4), 0.2, 0));
          notes.spawn(np, V(s * rand(0.2, 0.5), rand(0.7, 1.1), rand(-0.2, 0.2)), rand(1.4, 2), rand(0.7, 1), col.clone().offsetHSL(rand(-0.15, 0.15), 0, 0));
        }
        notes.update(dt);
      });
      return out();
    }

    // ============================================================ MOCHILA DO CAMPEÃO (Novato)
    case 'gear_backpack': {
      const g = new THREE.Group();
      const bag = mat('#ffb300', { roughness: 0.6 });
      const dark = mat('#e65100', { roughness: 0.6 });
      const metalZ = mat('#cfd8dc', { metalness: 0.6, roughness: 0.3 });
      g.add(mesh(block(1.32, 1.42, 0.56, 0.24), bag));
      g.add(mesh(block(1.36, 0.5, 0.6, 0.2), dark, 0, 0.5, 0.0)); // tampa
      g.add(mesh(block(1.0, 0.04, 0.03, 0.01), metalZ, 0, 0.24, -0.3)); // zíper
      g.add(mesh(block(1.0, 0.62, 0.2, 0.12), dark, 0, -0.32, -0.34)); // bolso da frente
      g.add(mesh(block(0.9, 0.04, 0.03, 0.01), metalZ, 0, -0.06, -0.45));
      // Distintivo com o cavalo
      const badge = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), mat('#1e88e5'), 0, -0.34, -0.46);
      badge.rotation.x = PI / 2;
      const kn = mesh(knightGeo(), mat('#ffffff'), 0, -0.34, -0.485);
      kn.scale.setScalar(0.26);
      kn.rotation.y = PI;
      g.add(badge, kn);
      // Bolsos laterais com garrafinha
      for (const s of [-1, 1]) g.add(mesh(block(0.2, 0.6, 0.42, 0.08), dark, s * 0.72, -0.35, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 14), mat('#29b6f6', { roughness: 0.2, transparent: true, opacity: 0.85 }), 0.74, -0.05, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), mat('#212121'), 0.74, 0.27, 0));
      // Troféu saindo de cima
      const trophy = new THREE.Group();
      trophy.position.set(-0.28, 0.72, 0.05);
      const cupPts = [V(0, 0), V(0.14, 0), V(0.14, 0.04), V(0.05, 0.08), V(0.05, 0.2), V(0.2, 0.3), V(0.24, 0.55), V(0.22, 0.56)].map((p) => new THREE.Vector2(p.x, p.y));
      trophy.add(mesh(new THREE.LatheGeometry(cupPts, 18), gold()));
      for (const s of [-1, 1]) trophy.add(mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, PI), gold(), s * 0.24, 0.42, 0).rotateZ(-s * PI / 2));
      g.add(trophy);
      const tw = twinkles(trophy, [V(0.1, 0.5, 0.2), V(-0.15, 0.35, 0.2)], '#fffde7', 0.22, 1);
      // Chaveiro de peão que balança
      const charm = new THREE.Group();
      charm.position.set(0.45, 0.25, -0.32);
      charm.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), mat('#9e9e9e'), 0, -0.1, 0));
      const white = mat('#fafafa', { roughness: 0.3 });
      charm.add(mesh(new THREE.SphereGeometry(0.08, 12, 10), white, 0, -0.26, 0), mesh(new THREE.ConeGeometry(0.09, 0.16, 12), white, 0, -0.38, 0), mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), white, 0, -0.46, 0));
      g.add(charm);
      g.position.set(0, 1.18, -0.82);
      rig.spine.add(g);
      for (const s of [-1, 1]) {
        rig.spine.add(mesh(block(0.2, 1.3, 0.06, 0.03), dark, s * 0.6, 1.4, front + 0.02));
        rig.spine.add(mesh(block(0.2, 0.06, 1.2, 0.03), dark, s * 0.6, 2.06, -0.1));
        rig.spine.add(mesh(block(0.26, 0.14, 0.08, 0.03), metalZ, s * 0.6, 1.2, front + 0.05));
      }
      const swing = pendulum(charm, g);
      const confetti = new Particles(layer, 40, new THREE.PlaneGeometry(0.1, 0.06), { gravity: -3, drag: 1.2, grow: 0, spin: 8 });
      const cp = V();
      const COLORS = ['#ffc83d', '#2ee59d', '#2ec5ff', '#ff4d6d', '#b45cff'];
      fx.push((t, dt) => {
        swing(t, dt);
        tw(t);
        // Comemoração: o troféu solta confete a cada 4 s
        const k = t % 4;
        trophy.rotation.y = Math.sin(t * 1.5) * 0.3;
        trophy.position.y = 0.72 + (k < 0.3 ? Math.sin((k / 0.3) * PI) * 0.15 : 0);
        if (k < 0.12) {
          trophy.getWorldPosition(cp);
          cp.y += 0.6;
          for (let i = 0; i < 3; i++) confetti.spawn(cp, V(rand(-1.3, 1.3), rand(2, 3.5), rand(-1.3, 0.6)), rand(0.9, 1.4), rand(0.8, 1.3), COLORS[Math.floor(Math.random() * COLORS.length)]);
        }
        confetti.update(dt);
      });
      return out();
    }
  }
  return null;
}

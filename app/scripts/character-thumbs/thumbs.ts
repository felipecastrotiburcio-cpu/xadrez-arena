import * as THREE from 'three';
import { CATALOG } from '../../src/lib/catalog';
import { buildAvatar2 } from '../../src/three/avatar2';
import { Animator, applyPose } from '../../src/three/anim';
import * as C from '../../src/three/clips';

const W = 400, H = 500;
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const looks: Record<string, any> = {};
for (const i of CATALOG as any[]) if (i.type === 'character') looks[i.id] = { ...i.style };
for (const i of CATALOG as any[]) if (i.type === 'evolution') {
  looks[i.style.character + '_evo'] = { ...looks[i.style.character], ...i.style.colors, gear: [i.style.gear], evolution: i.style.outfit };
}
(window as any).keys = Object.keys(looks);
(window as any).thumb = (key: string, angle = 0.42, t = 1.3) => {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#f3e6d0', '#2a2016', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8); sun.position.set(5, 12, 9); scene.add(sun);
  const r1 = new THREE.DirectionalLight('#e6b95e', 1.1); r1.position.set(-8, 6, -8); scene.add(r1);
  const r2 = new THREE.DirectionalLight('#7aa7d6', 0.6); r2.position.set(8, 4, -6); scene.add(r2);
  const A = buildAvatar2(looks[key]);
  scene.add(A.root);
  const an = new Animator(C.IDLE);
  for (let k = 0; k <= 26; k++) { const tt = k * 0.05; applyPose(A, an.evaluate(tt)); scene.updateMatrixWorld(); A.tick(tt, k ? 0.05 : 0); }
  scene.updateMatrixWorld();
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  const d = 16.5;
  cam.position.set(Math.sin(angle) * d, 4.2, Math.cos(angle) * d);
  cam.lookAt(0, 3.05, 0);
  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/png');
  A.dispose();
  return url;
};
(window as any).ready = true;

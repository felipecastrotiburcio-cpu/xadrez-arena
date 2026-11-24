import * as THREE from 'three';

/**
 * Esqueleto do boneco 3D (o modelo é montado em avatar2.ts), articulado assim:
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

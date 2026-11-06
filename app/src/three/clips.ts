import { makeClip, merge, mirror, type Clip, type Pose } from './anim';

/**
 * Biblioteca de movimentos do boneco. Convenções (ver avatar.ts): ombro/quadril .x
 * negativo = para a frente; cotovelo .x negativo dobra o antebraço; joelho .x
 * positivo dobra; coluna .x positivo inclina para a frente; body .x negativo cai
 * de costas. Posições em "studs".
 */

const PI = Math.PI;

// ------------------------------------------------------------------ poses base
const STAND: Pose = {
  shoulderL: [0.05, 0, -0.1],
  shoulderR: [0.05, 0, 0.1],
  elbowL: [-0.2, 0, 0],
  elbowR: [-0.2, 0, 0],
};

const GUARD: Pose = {
  spine: [0.14, -0.15, 0],
  neck: [-0.05, 0.12, 0],
  shoulderL: [-0.95, 0, -0.25],
  elbowL: [-1.7, 0, 0],
  shoulderR: [-0.75, 0, 0.3],
  elbowR: [-1.85, 0, 0],
  hipL: [-0.3, 0, -0.1],
  kneeL: [0.4, 0, 0],
  hipR: [0.05, 0, 0.12],
  kneeR: [0.3, 0, 0],
  pelvisPos: [0, -0.14, 0],
};

// ------------------------------------------------------------------ parado
export const IDLE: Clip = makeClip(
  2.8,
  [
    [0, merge(STAND, { pelvisPos: [0.05, 0, 0], spine: [0, 0, 0.02], hipL: [0, 0, -0.03], hipR: [0, 0, 0.03] })],
    [
      1.4,
      merge(STAND, {
        pelvisPos: [-0.05, -0.04, 0],
        spine: [0.04, 0, -0.02],
        neck: [-0.04, 0.15, 0],
        shoulderL: [0.1, 0, -0.14],
        shoulderR: [0.1, 0, 0.14],
        hipL: [-0.04, 0, 0.03],
        kneeL: [0.08, 0, 0],
        hipR: [-0.04, 0, -0.03],
        kneeR: [0.08, 0, 0],
      }),
    ],
  ],
  'loop',
);

/** Parado acenando (vitrine). */
export const WAVE: Clip = makeClip(
  2.2,
  [
    [0, STAND],
    [0.35, merge(STAND, { shoulderR: [-0.2, 0, 2.6], elbowR: [0, 0, 0.5], spine: [0, 0, -0.06], neck: [0, 0, 0.08] })],
    [0.6, merge(STAND, { shoulderR: [-0.2, 0, 2.5], elbowR: [0, 0, -0.35], spine: [0, 0, -0.06] })],
    [0.85, merge(STAND, { shoulderR: [-0.2, 0, 2.6], elbowR: [0, 0, 0.5], spine: [0, 0, -0.06] })],
    [1.1, merge(STAND, { shoulderR: [-0.2, 0, 2.5], elbowR: [0, 0, -0.35], spine: [0, 0, -0.06] })],
    [1.5, STAND],
    [2.2, STAND],
  ],
  'once',
);

export const GUARD_IDLE: Clip = makeClip(
  1.0,
  [
    [0, GUARD],
    [0.5, merge(GUARD, { pelvisPos: [0, -0.24, 0], kneeL: [0.55, 0, 0], kneeR: [0.45, 0, 0], hipL: [-0.38, 0, -0.1] })],
  ],
  'loop',
);

// ------------------------------------------------------------------ caminhar e correr
function gait(stride: number, lean: number, elbow: number, bob: number, duration: number): Clip {
  const contact: Pose = {
    spine: [lean, 0.12 * stride, 0],
    pelvis: [0, -0.12 * stride, 0],
    hipL: [-0.55 * stride, 0, 0],
    kneeL: [0.1, 0, 0],
    hipR: [0.45 * stride, 0, 0],
    kneeR: [0.3 * stride, 0, 0],
    shoulderL: [0.45 * stride, 0, -0.08],
    elbowL: [-elbow * 0.5, 0, 0],
    shoulderR: [-0.5 * stride, 0, 0.08],
    elbowR: [-elbow, 0, 0],
    pelvisPos: [0, -bob, 0],
  };
  const passing: Pose = {
    spine: [lean, 0, 0],
    hipL: [-0.05, 0, 0],
    kneeL: [0.15, 0, 0],
    hipR: [-0.1 * stride, 0, 0],
    kneeR: [1.0 * stride, 0, 0],
    shoulderL: [0, 0, -0.08],
    elbowL: [-elbow * 0.7, 0, 0],
    shoulderR: [0, 0, 0.08],
    elbowR: [-elbow * 0.7, 0, 0],
    pelvisPos: [0, bob * 0.6, 0],
  };
  const q = duration / 4;
  return makeClip(
    duration,
    [
      [0, contact],
      [q, passing],
      [2 * q, mirror(contact)],
      [3 * q, mirror(passing)],
    ],
    'loop',
  );
}
export const WALK = gait(1, 0.05, 0.4, 0.08, 0.72);
export const RUN = gait(1.5, 0.32, 1.5, 0.16, 0.48);

// ------------------------------------------------------------------ ataques (vencedor)
/** Soco cruzado: recua (antecipação), gira o quadril, estica o braço e volta à guarda. */
export const PUNCH: Clip = makeClip(0.85, [
  [0, GUARD],
  [
    0.22,
    merge(GUARD, {
      spine: [0.05, -0.55, 0],
      pelvis: [0, -0.25, 0],
      shoulderR: [-0.4, 0, 0.55],
      elbowR: [-2.0, 0, 0],
      hipR: [0.2, 0, 0.1],
      kneeR: [0.45, 0, 0],
      pelvisPos: [0, -0.2, -0.15],
    }),
  ],
  [
    0.34,
    merge(GUARD, {
      spine: [0.22, 0.65, 0],
      pelvis: [0, 0.3, 0],
      neck: [0.05, -0.4, 0],
      shoulderR: [-1.62, 0, 0.02],
      elbowR: [-0.04, 0, 0],
      shoulderL: [-0.55, 0, -0.35],
      elbowL: [-2.0, 0, 0],
      hipL: [-0.65, 0, -0.1],
      kneeL: [0.6, 0, 0],
      hipR: [0.4, 0, 0.1],
      kneeR: [0.12, 0, 0],
      pelvisPos: [0, -0.24, 0.3],
    }),
  ],
  [
    0.46,
    merge(GUARD, {
      spine: [0.25, 0.72, 0],
      pelvis: [0, 0.32, 0],
      neck: [0.05, -0.45, 0],
      shoulderR: [-1.55, 0, 0.05],
      elbowR: [-0.12, 0, 0],
      shoulderL: [-0.55, 0, -0.35],
      elbowL: [-2.0, 0, 0],
      hipL: [-0.65, 0, -0.1],
      kneeL: [0.62, 0, 0],
      hipR: [0.4, 0, 0.1],
      kneeR: [0.15, 0, 0],
      pelvisPos: [0, -0.26, 0.32],
    }),
  ],
  [0.85, GUARD],
]);

/** Voadora: agacha, salta encolhido, estica a perna no ar e aterrissa amortecendo. */
export const FLYING_KICK: Clip = makeClip(1.05, [
  [0, GUARD],
  [
    0.2,
    {
      spine: [0.45, 0, 0],
      shoulderL: [0.9, 0, -0.3],
      shoulderR: [0.9, 0, 0.3],
      elbowL: [-0.4, 0, 0],
      elbowR: [-0.4, 0, 0],
      hipL: [-0.85, 0, 0],
      kneeL: [1.35, 0, 0],
      hipR: [-0.85, 0, 0],
      kneeR: [1.35, 0, 0],
      pelvisPos: [0, -0.7, 0],
    },
  ],
  [
    0.4,
    {
      spine: [0.15, 0, 0],
      shoulderL: [-1.9, 0, -0.5],
      shoulderR: [-1.9, 0, 0.5],
      hipL: [-1.6, 0, 0],
      kneeL: [2.1, 0, 0],
      hipR: [-1.3, 0, 0],
      kneeR: [1.8, 0, 0],
      bodyPos: [0, 2.0, 0],
    },
  ],
  [
    0.55,
    {
      spine: [-0.4, 0, 0],
      neck: [0.25, 0, 0],
      shoulderL: [-0.3, 0, -1.4],
      shoulderR: [-0.3, 0, 1.4],
      hipR: [-1.7, 0, 0],
      kneeR: [0, 0, 0],
      hipL: [0.35, 0, 0],
      kneeL: [1.5, 0, 0],
      body: [-0.2, 0, 0],
      bodyPos: [0, 2.1, 0],
    },
  ],
  [
    0.8,
    {
      spine: [0.1, 0, 0],
      shoulderL: [-0.6, 0, -1.0],
      shoulderR: [-0.6, 0, 1.0],
      hipL: [-0.6, 0, 0],
      kneeL: [0.9, 0, 0],
      hipR: [-0.4, 0, 0],
      kneeR: [0.6, 0, 0],
      bodyPos: [0, 0.6, 0],
    },
  ],
  [
    0.92,
    {
      spine: [0.4, 0, 0],
      shoulderL: [-0.5, 0, -0.8],
      shoulderR: [-0.5, 0, 0.8],
      hipL: [-0.95, 0, 0],
      kneeL: [1.5, 0, 0],
      hipR: [-0.7, 0, 0],
      kneeR: [1.3, 0, 0],
      pelvisPos: [0, -0.75, 0],
    },
  ],
  [1.05, merge(STAND, { pelvisPos: [0, -0.2, 0], kneeL: [0.4, 0, 0], kneeR: [0.4, 0, 0], hipL: [-0.2, 0, 0], hipR: [-0.2, 0, 0] })],
]);

/** Invocar os raios: abre os braços para o céu e segura. */
export const SUMMON: Clip = makeClip(0.9, [
  [0, STAND],
  [0.25, merge(STAND, { pelvisPos: [0, -0.3, 0], kneeL: [0.5, 0, 0], kneeR: [0.5, 0, 0], hipL: [-0.25, 0, 0], hipR: [-0.25, 0, 0], spine: [0.25, 0, 0] })],
  [
    0.55,
    {
      spine: [-0.3, 0, 0],
      neck: [-0.4, 0, 0],
      shoulderL: [-0.3, 0, -2.7],
      shoulderR: [-0.3, 0, 2.7],
      elbowL: [0, 0, -0.2],
      elbowR: [0, 0, 0.2],
    },
  ],
  [0.9, { spine: [-0.32, 0, 0], neck: [-0.45, 0, 0], shoulderL: [-0.25, 0, -2.8], shoulderR: [-0.25, 0, 2.8] }],
]);

// ------------------------------------------------------------------ reações (rival)
/** Recebe o golpe: cabeça vai para trás, cambaleia dois passos, os joelhos cedem e cai de costas. */
export const HIT_FALL: Clip = makeClip(1.7, [
  [0, GUARD],
  [
    0.09,
    {
      neck: [-0.55, 0.35, 0],
      spine: [-0.4, 0.2, 0.12],
      shoulderL: [-1.3, 0, -0.9],
      shoulderR: [-1.0, 0, 1.0],
      elbowL: [-0.3, 0, 0],
      elbowR: [-0.4, 0, 0],
      hipL: [-0.2, 0, 0],
      kneeL: [0.2, 0, 0],
      pelvisPos: [0, 0, -0.25],
    },
  ],
  [
    0.4,
    {
      neck: [-0.3, 0.2, 0],
      spine: [-0.3, 0, 0.1],
      shoulderL: [-0.9, 0, -1.2],
      shoulderR: [-0.7, 0, 1.3],
      hipL: [0.45, 0, 0],
      kneeL: [0.3, 0, 0],
      hipR: [-0.35, 0, 0],
      kneeR: [0.55, 0, 0],
      body: [-0.2, 0, 0.05],
      bodyPos: [0, 0, -0.7],
    },
  ],
  [
    0.68,
    {
      neck: [0.2, 0, 0],
      spine: [0.1, 0, -0.1],
      shoulderL: [-0.5, 0, -0.8],
      shoulderR: [-0.4, 0, 0.9],
      hipL: [-0.6, 0, 0],
      kneeL: [1.1, 0, 0],
      hipR: [-0.5, 0, 0],
      kneeR: [1.0, 0, 0],
      pelvisPos: [0, -0.55, 0],
      body: [-0.35, 0, 0],
      bodyPos: [0, 0, -1.05],
    },
  ],
  [
    1.05,
    {
      neck: [-0.3, 0, 0],
      spine: [-0.2, 0, 0],
      shoulderL: [-2.6, 0, -0.5],
      shoulderR: [-2.6, 0, 0.5],
      hipL: [-0.9, 0, 0],
      kneeL: [0.6, 0, 0],
      hipR: [-0.6, 0, 0],
      kneeR: [0.5, 0, 0],
      body: [-1.42, 0, 0],
      bodyPos: [0, 0.38, -1.35],
    },
  ],
  [
    1.2,
    {
      neck: [0.35, 0, 0],
      spine: [0.1, 0, 0],
      shoulderL: [-2.2, 0, -0.9],
      shoulderR: [-2.3, 0, 0.9],
      hipL: [-0.75, 0, 0],
      kneeL: [0.45, 0, 0],
      hipR: [-0.35, 0, 0],
      kneeR: [0.3, 0, 0],
      body: [-1.6, 0, 0],
      bodyPos: [0, 0.52, -1.45],
    },
  ],
  [
    1.7,
    {
      neck: [0, 0.4, 0],
      shoulderL: [-1.6, 0, -1.2],
      shoulderR: [-1.5, 0, 1.25],
      elbowL: [-0.3, 0, 0],
      elbowR: [-0.4, 0, 0],
      hipL: [-0.12, 0, -0.15],
      kneeL: [0.25, 0, 0],
      hipR: [-0.05, 0, 0.12],
      kneeR: [0.1, 0, 0],
      body: [-1.57, 0, 0],
      bodyPos: [0, 0.5, -1.45],
    },
  ],
]);

/** Arremessado pela voadora: voa girando para trás e cai estatelado. */
export const LAUNCHED: Clip = makeClip(1.3, [
  [0, GUARD],
  [0.1, { neck: [-0.6, 0, 0], spine: [-0.5, 0, 0], shoulderL: [-1.6, 0, -1.0], shoulderR: [-1.6, 0, 1.0], body: [-0.5, 0, 0], bodyPos: [0, 0.6, -0.9] }],
  [0.45, { shoulderL: [-2.8, 0, -0.6], shoulderR: [-2.8, 0, 0.6], hipL: [-1.0, 0, 0], kneeL: [1.2, 0, 0], hipR: [-0.8, 0, 0], kneeR: [1.0, 0, 0], body: [-2.6, 0, 0], bodyPos: [0, 2.6, -2.6] }],
  [0.8, { shoulderL: [-2.2, 0, -1.0], shoulderR: [-2.2, 0, 1.0], hipL: [-0.4, 0, 0], kneeL: [0.4, 0, 0], body: [-4.4, 0, 0], bodyPos: [0, 1.4, -3.8] }],
  [1.0, { shoulderL: [-1.8, 0, -1.2], shoulderR: [-1.7, 0, 1.2], hipL: [-0.5, 0, 0], kneeL: [0.4, 0, 0], body: [-4.75, 0, 0], bodyPos: [0, 0.52, -4.2] }],
  [1.3, { neck: [0, 0.4, 0], shoulderL: [-1.6, 0, -1.2], shoulderR: [-1.5, 0, 1.25], hipL: [-0.12, 0, -0.15], kneeL: [0.25, 0, 0], body: [-4.71, 0, 0], bodyPos: [0, 0.5, -4.3] }],
]);

/** Levando choque: tremedeira rápida, braços abertos. */
export const SHOCKED: Clip = makeClip(
  0.24,
  [
    [0, { neck: [-0.3, 0.2, 0], spine: [-0.15, 0.1, 0.06], shoulderL: [-0.3, 0, -1.3], shoulderR: [-0.3, 0, 1.3], elbowL: [-0.6, 0, 0], elbowR: [-0.3, 0, 0], kneeL: [0.3, 0, 0], kneeR: [0.1, 0, 0] }],
    [0.12, { neck: [-0.4, -0.2, 0], spine: [-0.2, -0.1, -0.06], shoulderL: [-0.2, 0, -1.5], shoulderR: [-0.4, 0, 1.2], elbowL: [-0.2, 0, 0], elbowR: [-0.7, 0, 0], kneeL: [0.1, 0, 0], kneeR: [0.35, 0, 0] }],
  ],
  'loop',
);

/** Nocauteado no chão, tonto (na posição e rotação em que a queda terminou). */
function koClip(bodyX: number, z: number): Clip {
  const base = { body: [bodyX, 0, 0] as const, bodyPos: [0, 0.5, z] as const };
  return makeClip(
    1.6,
    [
      [0, { ...base, neck: [0, 0.4, 0], shoulderL: [-1.6, 0, -1.2], shoulderR: [-1.5, 0, 1.25], elbowL: [-0.3, 0, 0], elbowR: [-0.4, 0, 0], hipL: [-0.12, 0, -0.15], kneeL: [0.25, 0, 0], hipR: [-0.05, 0, 0.12], kneeR: [0.1, 0, 0] }],
      [0.8, { ...base, neck: [0, -0.45, 0], shoulderL: [-1.6, 0, -1.15], shoulderR: [-1.55, 0, 1.3], elbowL: [-0.4, 0, 0], elbowR: [-0.3, 0, 0], hipL: [-0.2, 0, -0.15], kneeL: [0.4, 0, 0], hipR: [-0.05, 0, 0.12], kneeR: [0.1, 0, 0] }],
    ],
    'loop',
  );
}
export const KO = koClip(-1.57, -1.45);
export const KO_FAR = koClip(-4.71, -4.3);

// ------------------------------------------------------------------ danças / comemorações
/** Passinho do Jamal: passo para o lado cruzando o pé, quique nos joelhos, quadril e ombros no contratempo. */
const JAMAL_STEP: Pose = {
  pelvisPos: [0.38, -0.2, 0],
  pelvis: [0, 0.22, -0.08],
  spine: [0.08, -0.3, 0.1],
  neck: [0.05, 0.25, -0.1],
  hipR: [-0.1, 0, 0.15],
  kneeR: [0.3, 0, 0],
  hipL: [-0.5, 0, -0.18],
  kneeL: [1.0, 0, 0],
  shoulderL: [-0.6, 0, -0.35],
  elbowL: [-1.6, 0, 0],
  shoulderR: [0.4, 0, 0.35],
  elbowR: [-1.3, 0, 0],
};
const JAMAL_BOUNCE: Pose = {
  pelvisPos: [0, -0.36, 0],
  spine: [0.14, 0, 0],
  neck: [0.12, 0, 0],
  hipL: [-0.35, 0, -0.05],
  kneeL: [0.65, 0, 0],
  hipR: [-0.35, 0, 0.05],
  kneeR: [0.65, 0, 0],
  shoulderL: [-0.15, 0, -0.35],
  elbowL: [-1.35, 0, 0],
  shoulderR: [-0.15, 0, 0.35],
  elbowR: [-1.35, 0, 0],
};
export const DANCE_JAMAL: Clip = makeClip(
  1.0,
  [
    [0, JAMAL_STEP],
    [0.25, JAMAL_BOUNCE],
    [0.5, mirror(JAMAL_STEP)],
    [0.75, JAMAL_BOUNCE],
  ],
  'loop',
);

/** 67: antebraços à frente, palmas para cima, subindo e descendo alternados como uma balança. */
const SIX: Pose = {
  pelvisPos: [0, -0.14, 0],
  spine: [0.06, 0.12, -0.05],
  neck: [0.12, -0.22, 0.05],
  shoulderL: [-0.45, 0, -0.28],
  elbowL: [-2.05, 0, 0],
  shoulderR: [-0.02, 0, 0.28],
  elbowR: [-1.1, 0, 0],
  hipL: [-0.15, 0, -0.05],
  kneeL: [0.3, 0, 0],
  hipR: [-0.15, 0, 0.05],
  kneeR: [0.3, 0, 0],
};
const SIX_MID: Pose = merge(SIX, {
  pelvisPos: [0, -0.24, 0],
  spine: [0.1, 0, 0],
  neck: [0.2, 0, 0],
  shoulderL: [-0.25, 0, -0.28],
  elbowL: [-1.55, 0, 0],
  shoulderR: [-0.25, 0, 0.28],
  elbowR: [-1.55, 0, 0],
  kneeL: [0.45, 0, 0],
  kneeR: [0.45, 0, 0],
});
export const DANCE_67: Clip = makeClip(
  0.84,
  [
    [0, SIX],
    [0.21, SIX_MID],
    [0.42, mirror(SIX)],
    [0.63, SIX_MID],
  ],
  'loop',
);

/** Giro: agacha, gira 360° com os braços abertos e quica. */
export const DANCE_SPIN: Clip = makeClip(
  1.4,
  [
    [0, merge(STAND, { pelvisPos: [0, -0.3, 0], kneeL: [0.55, 0, 0], kneeR: [0.55, 0, 0], hipL: [-0.28, 0, 0], hipR: [-0.28, 0, 0], shoulderL: [0, 0, -0.6], shoulderR: [0, 0, 0.6] })],
    [0.35, { body: [0, PI * 0.5, 0], bodyPos: [0, 0.35, 0], shoulderL: [0, 0, -1.45], shoulderR: [0, 0, 1.45], elbowL: [0, 0, -0.15], elbowR: [0, 0, 0.15], hipL: [0, 0, -0.15], hipR: [0, 0, 0.15], neck: [-0.15, 0, 0] }],
    [0.6, { body: [0, PI, 0], bodyPos: [0, 0.5, 0], shoulderL: [0, 0, -1.5], shoulderR: [0, 0, 1.5], hipL: [0, 0, -0.2], hipR: [0, 0, 0.2], neck: [-0.2, 0, 0] }],
    [0.85, { body: [0, PI * 1.5, 0], bodyPos: [0, 0.35, 0], shoulderL: [0, 0, -1.45], shoulderR: [0, 0, 1.45], hipL: [0, 0, -0.15], hipR: [0, 0, 0.15] }],
    [1.1, merge(STAND, { body: [0, PI * 2, 0], pelvisPos: [0, -0.3, 0], kneeL: [0.55, 0, 0], kneeR: [0.55, 0, 0], hipL: [-0.28, 0, 0], hipR: [-0.28, 0, 0], shoulderL: [0, 0, -0.6], shoulderR: [0, 0, 0.6] })],
    [1.4, merge(STAND, { body: [0, PI * 2, 0], pelvisPos: [0, -0.3, 0], kneeL: [0.55, 0, 0], kneeR: [0.55, 0, 0], hipL: [-0.28, 0, 0], hipR: [-0.28, 0, 0], shoulderL: [0, 0, -0.6], shoulderR: [0, 0, 0.6] })],
  ],
  'cycle',
);

/** Muque: pose de bíceps duplo, peito estufado, "bombeando". */
const FLEX: Pose = {
  spine: [-0.12, 0, 0],
  neck: [-0.1, 0, 0],
  shoulderL: [0.1, 0, -1.5],
  elbowL: [0, 0, -1.85],
  shoulderR: [0.1, 0, 1.5],
  elbowR: [0, 0, 1.85],
  hipL: [0, 0, -0.18],
  hipR: [0, 0, 0.18],
};
export const DANCE_FLEX: Clip = makeClip(
  1.3,
  [
    [0, FLEX],
    [0.5, merge(FLEX, { spine: [0.15, 0, 0], neck: [0.15, 0, 0], elbowL: [0, 0, -2.35], elbowR: [0, 0, 2.35], shoulderL: [0.25, 0, -1.35], shoulderR: [0.25, 0, 1.35], pelvisPos: [0, -0.18, 0], kneeL: [0.3, 0, 0], kneeR: [0.3, 0, 0] })],
    [0.8, merge(FLEX, { spine: [0.15, 0, 0], neck: [0.15, 0, 0], elbowL: [0, 0, -2.35], elbowR: [0, 0, 2.35], shoulderL: [0.25, 0, -1.35], shoulderR: [0.25, 0, 1.35], pelvisPos: [0, -0.18, 0], kneeL: [0.3, 0, 0], kneeR: [0.3, 0, 0] })],
  ],
  'loop',
);

/** Comemoração com pulinhos e soco no ar (voadora e trovão). */
export const DANCE_JUMP: Clip = makeClip(
  0.9,
  [
    [0, { pelvisPos: [0, -0.45, 0], spine: [0.3, 0, 0], hipL: [-0.45, 0, 0], kneeL: [0.85, 0, 0], hipR: [-0.45, 0, 0], kneeR: [0.85, 0, 0], shoulderR: [-0.3, 0, 0.6], elbowR: [-1.8, 0, 0], shoulderL: [0.2, 0, -0.3], elbowL: [-0.8, 0, 0] }],
    [0.32, { bodyPos: [0, 0.9, 0], spine: [-0.15, 0, 0], neck: [-0.2, 0, 0], shoulderR: [-0.4, 0, 2.7], elbowR: [0, 0, 0.1], shoulderL: [0.1, 0, -0.5], elbowL: [-1.0, 0, 0], hipL: [-0.2, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.15, 0, 0], kneeR: [0.4, 0, 0] }],
    [0.55, { bodyPos: [0, 0.4, 0], shoulderR: [-0.3, 0, 2.6], elbowR: [0, 0, 0.2], shoulderL: [0.1, 0, -0.4], elbowL: [-1.0, 0, 0], kneeL: [0.3, 0, 0], kneeR: [0.3, 0, 0] }],
  ],
  'loop',
);

/** Coroação: braços para o céu, balançando de alegria. */
export const DANCE_CROWN: Clip = makeClip(
  1.2,
  [
    [0, { spine: [-0.15, 0.2, 0.05], neck: [-0.25, 0, 0], shoulderL: [-0.3, 0, -2.65], shoulderR: [-0.3, 0, 2.65], elbowL: [0, 0, -0.3], elbowR: [0, 0, 0.3], pelvisPos: [0.15, -0.1, 0], pelvis: [0, 0, -0.06] }],
    [0.3, { spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], shoulderL: [-0.3, 0, -2.3], shoulderR: [-0.3, 0, 2.3], elbowL: [0, 0, -0.7], elbowR: [0, 0, 0.7], pelvisPos: [0, -0.28, 0], kneeL: [0.45, 0, 0], kneeR: [0.45, 0, 0], hipL: [-0.22, 0, 0], hipR: [-0.22, 0, 0] }],
    [0.6, { spine: [-0.15, -0.2, -0.05], neck: [-0.25, 0, 0], shoulderL: [-0.3, 0, -2.65], shoulderR: [-0.3, 0, 2.65], elbowL: [0, 0, -0.3], elbowR: [0, 0, 0.3], pelvisPos: [-0.15, -0.1, 0], pelvis: [0, 0, 0.06] }],
    [0.9, { spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], shoulderL: [-0.3, 0, -2.3], shoulderR: [-0.3, 0, 2.3], elbowL: [0, 0, -0.7], elbowR: [0, 0, 0.7], pelvisPos: [0, -0.28, 0], kneeL: [0.45, 0, 0], kneeR: [0.45, 0, 0], hipL: [-0.22, 0, 0], hipR: [-0.22, 0, 0] }],
  ],
  'loop',
);

/** Aviãozinho: braços abertos como asas, inclinando nas curvas (o caminho em círculo é feito na cena). */
const PLANE: Pose = { spine: [0.35, 0, 0.32], neck: [-0.3, 0, -0.2], shoulderL: [0, 0, -1.5], shoulderR: [0, 0, 1.5], elbowL: [0, 0, -0.1], elbowR: [0, 0, 0.1] };
export const DANCE_AIRPLANE: Clip = makeClip(
  0.48,
  [
    [0, merge(PLANE, { hipL: [-0.75, 0, 0], kneeL: [0.2, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.6, 0, 0], pelvisPos: [0, -0.15, 0] })],
    [0.12, merge(PLANE, { hipL: [-0.1, 0, 0], kneeL: [0.2, 0, 0], hipR: [-0.1, 0, 0], kneeR: [1.4, 0, 0], pelvisPos: [0, 0.12, 0] })],
    [0.24, merge(PLANE, { hipR: [-0.75, 0, 0], kneeR: [0.2, 0, 0], hipL: [0.6, 0, 0], kneeL: [0.6, 0, 0], pelvisPos: [0, -0.15, 0] })],
    [0.36, merge(PLANE, { hipR: [-0.1, 0, 0], kneeR: [0.2, 0, 0], hipL: [-0.1, 0, 0], kneeL: [1.4, 0, 0], pelvisPos: [0, 0.12, 0] })],
  ],
  'loop',
);

/** Dança do robô: poses travadas, mudando de uma vez e segurando. */
export const DANCE_ROBOT: Clip = makeClip(
  2.4,
  [
    [0, { shoulderL: [-1.57, 0, 0], elbowL: [0, 0, 0], shoulderR: [0, 0, 0.15], elbowR: [-1.57, 0, 0], neck: [0, 0.7, 0], spine: [0, 0.3, 0] }],
    [0.4, { shoulderL: [0, 0, -0.15], elbowL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowR: [0, 0, 0], neck: [0, -0.7, 0], spine: [0, -0.3, 0], pelvisPos: [0, -0.2, 0], kneeL: [0.4, 0, 0], kneeR: [0.4, 0, 0], hipL: [-0.2, 0, 0], hipR: [-0.2, 0, 0] }],
    [0.8, { shoulderL: [0, 0, -1.57], elbowL: [0, 0, -1.57], shoulderR: [0, 0, 1.57], elbowR: [0, 0, 1.57], neck: [0.3, 0, 0] }],
    [1.2, { shoulderL: [0, 0, -1.57], elbowL: [0, 0, 1.57], shoulderR: [0, 0, 1.57], elbowR: [0, 0, -1.57], neck: [-0.2, 0, 0], pelvisPos: [0, -0.2, 0], kneeL: [0.4, 0, 0], kneeR: [0.4, 0, 0], hipL: [-0.2, 0, 0], hipR: [-0.2, 0, 0] }],
    [1.6, { shoulderL: [-1.57, 0, -0.4], elbowL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0.4], elbowR: [-1.57, 0, 0], spine: [0, 0.6, 0], neck: [0, 0.5, 0] }],
    [2.0, { shoulderL: [-1.57, 0, -0.4], elbowL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0.4], elbowR: [-1.57, 0, 0], spine: [0, -0.6, 0], neck: [0, -0.5, 0] }],
  ],
  'loop',
  { snap: true },
);

/** Mortal para trás: agacha, salta, gira 360° encolhido e aterrissa com os braços para cima. */
const CROUCH: Pose = { pelvisPos: [0, -0.75, 0], spine: [0.45, 0, 0], hipL: [-0.9, 0, 0], kneeL: [1.4, 0, 0], hipR: [-0.9, 0, 0], kneeR: [1.4, 0, 0], shoulderL: [0.9, 0, -0.3], shoulderR: [0.9, 0, 0.3], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0] };
const VICTORY: Pose = { spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], shoulderL: [-0.2, 0, -2.5], shoulderR: [-0.2, 0, 2.5], elbowL: [0, 0, -0.2], elbowR: [0, 0, 0.2] };
export const DANCE_FLIP: Clip = makeClip(
  2.2,
  [
    [0, VICTORY],
    [0.35, CROUCH],
    [0.5, { pelvisPos: [0, 1.3, 0], spine: [-0.25, 0, 0], neck: [-0.3, 0, 0], shoulderL: [-2.9, 0, -0.3], shoulderR: [-2.9, 0, 0.3], hipL: [0.1, 0, 0], hipR: [0.1, 0, 0] }],
    [0.66, { pelvis: [-1.9, 0, 0], pelvisPos: [0, 2.5, 0], spine: [0.3, 0, 0], hipL: [-1.8, 0, 0], kneeL: [2.0, 0, 0], hipR: [-1.8, 0, 0], kneeR: [2.0, 0, 0], shoulderL: [-1.2, 0, -0.4], shoulderR: [-1.2, 0, 0.4], elbowL: [-1.4, 0, 0], elbowR: [-1.4, 0, 0] }],
    [0.82, { pelvis: [-3.9, 0, 0], pelvisPos: [0, 2.3, 0], spine: [0.3, 0, 0], hipL: [-1.8, 0, 0], kneeL: [2.0, 0, 0], hipR: [-1.8, 0, 0], kneeR: [2.0, 0, 0], shoulderL: [-1.2, 0, -0.4], shoulderR: [-1.2, 0, 0.4], elbowL: [-1.4, 0, 0], elbowR: [-1.4, 0, 0] }],
    [0.98, { pelvis: [-5.7, 0, 0], pelvisPos: [0, 1.1, 0], hipL: [-0.6, 0, 0], kneeL: [0.5, 0, 0], hipR: [-0.6, 0, 0], kneeR: [0.5, 0, 0], shoulderL: [-1.6, 0, -0.8], shoulderR: [-1.6, 0, 0.8] }],
    [1.1, merge(CROUCH, { pelvis: [-2 * PI, 0, 0], shoulderL: [-1.4, 0, -0.9], shoulderR: [-1.4, 0, 0.9] })],
    [1.45, merge(VICTORY, { pelvis: [-2 * PI, 0, 0] })],
    [2.2, merge(VICTORY, { pelvis: [-2 * PI, 0, 0] })],
  ],
  'cycle',
);

export const DANCES: Record<string, Clip> = {
  jamal: DANCE_JAMAL,
  '67': DANCE_67,
  spin: DANCE_SPIN,
  flex: DANCE_FLEX,
  kick: DANCE_JUMP,
  lightning: DANCE_JUMP,
  crown: DANCE_CROWN,
  airplane: DANCE_AIRPLANE,
  robot: DANCE_ROBOT,
  flip: DANCE_FLIP,
};

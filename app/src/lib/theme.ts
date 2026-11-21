/**
 * Identidade visual "clube de xadrez à noite": fundo quase preto e quente, texto marfim,
 * latão (dourado envelhecido) como única cor de destaque — para a ação principal, moedas,
 * rating e itens lendários. Cores fortes só onde carregam significado (vitória, erro, raridade).
 */
export const colors = {
  bg: '#0f0e0c',
  surface: '#181613',
  surfaceAlt: '#211e1a',
  raised: '#2a2621',
  border: '#2e2a24',
  borderStrong: '#3d3830',
  text: '#f3ede3',
  textMuted: '#a49c8f',
  textFaint: '#6e675d',
  accent: '#dcab4f',
  accentSoft: 'rgba(220, 171, 79, 0.12)',
  accentText: '#1b1306',
  primary: '#dcab4f',
  success: '#5fbf8a',
  danger: '#e25a52',
  info: '#7aa7d6',
  boardLight: '#efd9b4',
  boardDark: '#b5835a',
  highlight: 'rgba(240, 210, 60, 0.55)',
  selected: 'rgba(80, 160, 230, 0.6)',
  check: 'rgba(230, 50, 50, 0.75)',
  hint: 'rgba(95, 191, 138, 0.6)',
};

/** Gradientes discretos (quase monocromáticos): profundidade, não arco-íris. */
export const gradients = {
  primary: ['#e6b95e', '#c8913a'],
  play: ['#e6b95e', '#c8913a'],
  ai: ['#24211c', '#1a1814'],
  friends: ['#24211c', '#1a1814'],
  ranking: ['#24211c', '#1a1814'],
  shop: ['#24211c', '#1a1814'],
  gold: ['#e6b95e', '#c8913a'],
  hero: ['#1f1c17', '#141210'],
} as const satisfies Record<string, readonly [string, string]>;

export const fonts = {
  /** Títulos e números grandes (serifada, ar de clube clássico). */
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  regular: 'Manrope_500Medium',
  bold: 'Manrope_700Bold',
  black: 'Manrope_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20 };
export const spacing = (n: number) => n * 4;

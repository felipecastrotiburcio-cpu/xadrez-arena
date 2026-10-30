/**
 * Visual jovem: fundo índigo profundo, cores neon e gradientes.
 * `accent` (dourado) fica para moedas, rating e conquistas.
 */
export const colors = {
  bg: '#110d2e',
  surface: '#1d1748',
  surfaceAlt: '#2a2263',
  border: '#3b3285',
  text: '#ffffff',
  textMuted: '#aaa3dc',
  accent: '#ffc83d',
  accentText: '#2a1a00',
  primary: '#8b5cff',
  success: '#2ee59d',
  danger: '#ff4d6d',
  info: '#2ec5ff',
  boardLight: '#efd9b4',
  boardDark: '#b5835a',
  highlight: 'rgba(240, 210, 60, 0.55)',
  selected: 'rgba(80, 160, 230, 0.6)',
  check: 'rgba(230, 50, 50, 0.75)',
  hint: 'rgba(46, 229, 157, 0.6)',
};

/** Gradientes (início → fim) usados em botões e cartões. */
export const gradients = {
  primary: ['#8b5cff', '#ff4fd8'],
  play: ['#ff4f7b', '#ff9a3d'],
  ai: ['#2ec5ff', '#5b6cff'],
  friends: ['#2ee59d', '#13a8a8'],
  ranking: ['#ffc83d', '#ff8a3d'],
  shop: ['#b45cff', '#5b3dff'],
  gold: ['#ffe27a', '#ffb800'],
  hero: ['#2a1f6e', '#4a1f7a'],
} as const satisfies Record<string, readonly [string, string]>;

export const fonts = {
  regular: 'Fredoka_500Medium',
  bold: 'Fredoka_600SemiBold',
  black: 'Fredoka_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 24 };
export const spacing = (n: number) => n * 4;

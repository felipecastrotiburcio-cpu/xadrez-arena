/**
 * Identidade visual "Clube Noturno Divertido": o clube de xadrez à noite (céu azul-noite com
 * estrelas, lua, dourado, tabuleiro de madeira, nome do app em letra clássica) com um jeito
 * brincalhão para crianças: botões grandes e "fofinhos" (com sombra embaixo, parecem afundar ao
 * tocar), letras arredondadas e uma cor para cada área do app.
 */
export const colors = {
  bg: '#121a33',
  surface: '#1b2547',
  surfaceAlt: '#223063',
  raised: '#2a3870',
  border: '#2e3b68',
  borderStrong: '#3d4c80',
  /** Sombra sólida embaixo dos cartões e botões (o efeito "fofinho"). */
  shadow: '#0b1124',
  text: '#f6f1e7',
  textMuted: '#aab4d4',
  textFaint: '#7380a8',
  accent: '#f4b942',
  accentDark: '#c98a1e',
  accentSoft: 'rgba(244, 185, 66, 0.16)',
  accentText: '#2a1a00',
  primary: '#f4b942',
  /** Cores das áreas do app (ícones e detalhes). */
  teal: '#36d1b5',
  coral: '#ff7f7f',
  violet: '#a68bff',
  success: '#36d1b5',
  danger: '#ff6b6b',
  info: '#6fb8ff',
  boardLight: '#efd9b4',
  boardDark: '#b5835a',
  highlight: 'rgba(244, 185, 66, 0.5)',
  selected: 'rgba(80, 160, 230, 0.6)',
  check: 'rgba(230, 50, 50, 0.75)',
  hint: 'rgba(54, 209, 181, 0.6)',
};

/** Gradientes suaves (céu noturno). */
export const gradients = {
  primary: ['#f6c45a', '#f4b942'],
  play: ['#f6c45a', '#f4b942'],
  ai: ['#223063', '#1b2547'],
  friends: ['#223063', '#1b2547'],
  ranking: ['#223063', '#1b2547'],
  shop: ['#223063', '#1b2547'],
  gold: ['#f6c45a', '#f4b942'],
  hero: ['#223063', '#1b2547'],
} as const satisfies Record<string, readonly [string, string]>;

export const fonts = {
  /** Nome do app (letra clássica do clube de xadrez). */
  logo: 'Fraunces_700Bold',
  /** Títulos e números grandes (arredondada, brincalhona). */
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  /** Textos (redonda e fácil de ler). */
  regular: 'Nunito_700Bold',
  bold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const radius = { sm: 12, md: 16, lg: 22 };
export const spacing = (n: number) => n * 4;

/** Sombra "fofinha" (borda sólida embaixo) para cartões. */
export const chunky = { borderBottomWidth: 5, borderBottomColor: colors.shadow } as const;

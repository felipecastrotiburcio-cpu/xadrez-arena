import { Text, type StyleProp, type TextStyle } from 'react-native';

/** Código ISO do país (ex.: "BR") → emoji da bandeira (🇧🇷). */
export function flagEmoji(code?: string | null) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => base + c.charCodeAt(0)));
}

/** Nome do país no idioma do app (quando o aparelho sabe traduzir). */
export function countryName(code: string, locale: string) {
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string } }).DisplayNames;
    return DN ? new DN([locale], { type: 'region' }).of(code.toUpperCase()) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Bandeira pequena ao lado do nome do jogador (some quando o país não é conhecido). */
export function Flag({ code, size = 16, style }: { code?: string | null; size?: number; style?: StyleProp<TextStyle> }) {
  const emoji = flagEmoji(code);
  if (!emoji) return null;
  return (
    <Text style={[{ fontSize: size, lineHeight: size * 1.25 }, style]} accessibilityLabel={code!.toUpperCase()}>
      {emoji}
    </Text>
  );
}

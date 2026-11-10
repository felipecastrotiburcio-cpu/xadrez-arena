import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { itemNameFromPt } from './catalogI18n';
import { en } from './i18n/en';
import { pt, type TranslationKey } from './i18n/pt';

export type Lang = 'pt' | 'en';
/** Preferência salva: um idioma fixo ou 'auto' (segue o idioma do aparelho). */
export type LangPref = Lang | 'auto';
export type { TranslationKey };
export type TParams = Record<string, string | number>;

const STORAGE_KEY = 'xadrez.lang';
const DICTS: Record<Lang, Record<string, string>> = { pt, en };

/** Idioma do aparelho: português se for 'pt', inglês para qualquer outro. */
export function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'pt' ? 'pt' : 'en';
  } catch {
    return 'pt';
  }
}

// Idioma atual em nível de módulo, para código fora do React (toasts, resultText…).
let current: Lang = deviceLang();

export const getLang = (): Lang => current;

function translate(lang: Lang, key: TranslationKey, params?: TParams): string {
  const dict = DICTS[lang];
  let text = (params && Number(params.count) === 1 && dict[`${key}_one`]) || dict[key] || pt[key] || key;
  if (params) text = text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  return text;
}

/** Tradução fora de componentes (usa o idioma atual). */
export function tStatic(key: TranslationKey, params?: TParams): string {
  return translate(current, key, params);
}

/** Locale para números e datas. */
export const localeFor = (lang: Lang) => (lang === 'en' ? 'en-US' : 'pt-BR');

/** Nome do nível (1–10) no idioma atual; em português usa o nome recebido do servidor. */
export function levelName(level: number, ptName?: string): string {
  if (current === 'pt' && ptName !== undefined) return ptName;
  const key = `level.${level}` as TranslationKey;
  return key in pt ? tStatic(key) : ptName ?? '';
}

/** Rótulo do ritmo de jogo pelo id (em português, o rótulo original). */
export function timeControlLabel(tc: { id: string; label: string }): string {
  if (current === 'pt') return tc.label;
  const key = `tc.${tc.id}` as TranslationKey;
  return key in pt ? tStatic(key) : tc.label;
}

/** Motivo de fim de partida ("xeque-mate", "desistência"…) no idioma atual. */
export function reasonText(reason: string): string {
  const key = `reason.${reason}` as TranslationKey;
  return key in pt ? tStatic(key) : reason;
}

// ---------------------------------------------------------------- textos do servidor

/** Nomes em português (níveis, IA, itens da loja) → inglês. */
function nameEn(name: string): string {
  for (const key of Object.keys(pt) as TranslationKey[]) {
    if ((key.startsWith('level.') || /^ai\.\d+\.name$/.test(key)) && pt[key] === name) return en[key];
  }
  return itemNameFromPt(name) ?? name;
}

/** Mensagens fixas do servidor (online e do aparelho) e do cliente da API. */
const SERVER_FIXED: Record<string, string> = {
  'Nome de usuário deve ter 3 a 20 letras, números ou _.': 'Username must be 3 to 20 letters, numbers or _.',
  'A senha precisa ter de 8 a 128 caracteres.': 'Password must be 8 to 128 characters long.',
  'Esse nome de usuário já existe neste aparelho.': 'That username already exists on this device.',
  'Esse nome de usuário já existe.': 'That username is already taken.',
  'Usuário ou senha incorretos.': 'Wrong username or password.',
  'Item não encontrado.': 'Item not found.',
  'Você já possui este item.': 'You already own this item.',
  'Compre o item antes de equipar.': 'Buy the item before equipping it.',
  'Você já resgatou o bônus de hoje. Volte amanhã!': "You already claimed today's bonus. Come back tomorrow!",
  'Resultado inválido.': 'Invalid result.',
  'Jogador não encontrado.': 'Player not found.',
  'Amigos, convites e partidas online precisam do servidor online, que ainda não está disponível.':
    "Friends, invites and online games need the online server, which isn't available yet.",
  'Recurso indisponível sem o servidor online.': 'Not available without the online server.',
  'Sessão expirada. Entre novamente.': 'Session expired. Please log in again.',
  'Muitas tentativas. Aguarde alguns minutos e tente novamente.': 'Too many attempts. Wait a few minutes and try again.',
  'Você não pode adicionar a si mesmo.': "You can't add yourself.",
  'Vocês já são amigos.': "You're already friends.",
  'Pedido já enviado.': 'Request already sent.',
  'Pedido não encontrado.': 'Request not found.',
  'Partida não encontrada.': 'Game not found.',
  'Partida não está ativa.': 'This game is not active.',
  'Você não está nesta partida.': "You're not in this game.",
  'Não é a sua vez.': "It's not your turn.",
  'Seu tempo acabou.': 'Your time ran out.',
  'Lance ilegal.': 'Illegal move.',
  'Não há proposta de empate.': 'There is no draw offer.',
  'Ritmo de jogo inválido.': 'Invalid time control.',
  'Você só pode convidar amigos.': 'You can only invite friends.',
  'Termine sua partida atual primeiro.': 'Finish your current game first.',
  'Convite não encontrado ou expirado.': 'Invite not found or expired.',
  'Um dos jogadores já está em outra partida.': 'One of the players is already in another game.',
  'Quem convidou ficou offline.': 'The player who invited you went offline.',
  'Convite não encontrado.': 'Invite not found.',
  'Erro interno.': 'Internal error.',
  'Você já está em uma partida.': "You're already in a game.",
  'Erro inesperado.': 'Unexpected error.',
  'Endereço inválido. Use http(s)://host:porta': 'Invalid address. Use http(s)://host:port',
  'Por segurança, use um endereço https://': 'For security, use an https:// address',
  'O modo online ainda não está disponível: nenhum servidor foi configurado nesta versão. Você pode jogar contra a IA normalmente.':
    "Online mode isn't available yet: no server is set up in this version. You can still play against the AI.",
  // Títulos de notificações
  'Bem-vindo à Xadrez Arena!': 'Welcome to Xadrez Arena!',
  'Bônus diário resgatado': 'Daily bonus claimed',
  'Desafio perdido': 'Missed challenge',
  'Nova amizade': 'New friend',
  'Pedido de amizade': 'Friend request',
};

function reasonEn(reason: string): string {
  const key = `reason.${reason}` as TranslationKey;
  return key in pt ? en[key] : reason;
}

const VERDICT_EN: Record<string, string> = { Vitória: 'Win', Derrota: 'Loss', Empate: 'Draw' };

/** Mensagens com partes variáveis (nomes, números). */
const SERVER_PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^Não foi possível conectar ao servidor \((.*)\)\.$/s, (url) => `Couldn't connect to the server (${url}).`],
  [/^Faltam (\d+) moedas para comprar (.+)\.$/s, (n, item) => `You need ${n} more coins to buy ${nameEn(item)}.`],
  [/^(.+) está offline\.$/s, (name) => `${name} is offline.`],
  [/^(.+) está em uma partida\.$/s, (name) => `${name} is in a game.`],
  [
    /^Você ganhou (\d+) moedas para gastar na loja\. Vença a IA para ganhar mais!$/s,
    (n) => `You got ${n} coins to spend in the shop. Beat the AI to earn more!`,
  ],
  [
    /^Você ganhou (\d+) moedas para gastar na loja\. Boa sorte nas partidas!$/s,
    (n) => `You got ${n} coins to spend in the shop. Good luck in your games!`,
  ],
  [/^\+(\d+) moedas\. Volte amanhã para mais!$/s, (n) => `+${n} coins. Come back tomorrow for more!`],
  [
    /^(.+) te desafiou para uma partida (\S+)\. Que tal chamar de volta\?$/s,
    (name, tc) => `${name} challenged you to a ${tc} game. Why not challenge them back?`,
  ],
  [/^(.+) aceitou seu pedido de amizade\.$/s, (name) => `${name} accepted your friend request.`],
  [/^(.+) quer ser seu amigo\.$/s, (name) => `${name} wants to be your friend.`],
  [/^(Vitória|Derrota|Empate) contra (.+)$/s, (v, name) => `${VERDICT_EN[v]} vs ${nameEn(name)}`],
  [/^Você subiu para o Nível (\d+)!$/s, (n) => `You reached Level ${n}!`],
  [/^Agora você é (.+)\. Bônus de (\d+) moedas!$/s, (lvl, n) => `You're now ${nameEn(lvl)}. ${n} coin bonus!`],
  [
    /^(?:([+-]?\d+) de rating · )?\+(\d+) moedas(?: \((.+?)\))?(?: · 🔥 (\d+) vitórias seguidas!)?$/s,
    (delta, coins, reason, streak) =>
      `${delta ? `${delta} rating · ` : ''}+${coins} coins${reason ? ` (${reasonEn(reason)})` : ''}${
        streak ? ` · 🔥 ${streak} wins in a row!` : ''
      }`,
  ],
  [/^(.+) \(IA\)$/s, (name) => `${nameEn(name)} (AI)`],
];

/**
 * Traduz mensagens que chegam em português do servidor (erros, notificações,
 * nomes de níveis/IA/itens). Em português devolve o texto sem mudança.
 */
export function translateServerText(text: string): string;
export function translateServerText(text: string | null | undefined): string | null | undefined;
export function translateServerText(text: string | null | undefined) {
  if (current === 'pt' || !text) return text;
  const fixed = SERVER_FIXED[text];
  if (fixed) return fixed;
  for (const [re, fn] of SERVER_PATTERNS) {
    const m = re.exec(text);
    if (m) return fn(...m.slice(1));
  }
  const reason = reasonEn(text);
  if (reason !== text) return reason;
  return nameEn(text);
}

// ---------------------------------------------------------------- React

interface I18nValue {
  t: (key: TranslationKey, params?: TParams) => string;
  lang: Lang;
  /** Preferência escolhida nas configurações ('auto' segue o aparelho). */
  pref: LangPref;
  setLang: (pref: LangPref) => void;
  /** 'pt-BR' ou 'en-US', para toLocaleString/toLocaleDateString. */
  locale: string;
}

const I18nContext = createContext<I18nValue>({
  t: tStatic,
  lang: current,
  pref: 'auto',
  setLang: () => {},
  locale: localeFor(current),
});

export function I18nProvider({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [pref, setPref] = useState<LangPref>('auto');
  const [lang, setLangState] = useState<Lang>(current);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'pt' || saved === 'en') {
          current = saved;
          setPref(saved);
          setLangState(saved);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setLang = useCallback((p: LangPref) => {
    const next = p === 'auto' ? deviceLang() : p;
    current = next;
    setPref(p);
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      t: (key, params) => translate(lang, key, params),
      lang,
      pref,
      setLang,
      locale: localeFor(lang),
    }),
    [lang, pref, setLang],
  );

  // Espera ler a preferência salva para não mostrar o idioma errado por um instante.
  if (!loaded) return <>{fallback}</>;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);

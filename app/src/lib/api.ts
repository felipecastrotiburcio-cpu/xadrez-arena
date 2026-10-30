import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_KEY = 'xadrez.serverUrl';

/**
 * URL padrão do servidor. Em desenvolvimento usamos o IP da máquina que roda o
 * Metro (assim funciona direto no celular com Expo Go); em produção defina
 * EXPO_PUBLIC_SERVER_URL.
 */
function defaultServerUrl() {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3001`;
  // APK publicado sem servidor definido: o modo online fica desligado até o jogador informar um endereço.
  return __DEV__ ? 'http://localhost:3001' : '';
}

/**
 * Builds de produção só conversam com o servidor via HTTPS/WSS: o token JWT
 * nunca trafega em texto puro. Em desenvolvimento HTTP é liberado para a rede local.
 */
export const REQUIRE_HTTPS = !__DEV__;

export function validateServerUrl(url: string): string | null {
  if (!/^https?:\/\/[^\s/]+/.test(url)) return 'Endereço inválido. Use http(s)://host:porta';
  if (REQUIRE_HTTPS && !url.startsWith('https://')) return 'Por segurança, use um endereço https://';
  return null;
}

let serverUrl = defaultServerUrl();
let authToken: string | null = null;

export async function loadServerUrl() {
  const saved = await AsyncStorage.getItem(SERVER_KEY);
  if (saved && !validateServerUrl(saved)) serverUrl = saved;
  return serverUrl;
}

export async function setServerUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '') || defaultServerUrl();
  const error = clean ? validateServerUrl(clean) : null;
  if (error) throw new Error(error);
  serverUrl = clean;
  await AsyncStorage.setItem(SERVER_KEY, serverUrl);
}

export const getServerUrl = () => serverUrl;
/** Há um servidor online configurado? (sem ele, só o modo contra a IA funciona) */
export const isServerConfigured = () => serverUrl !== '';
export const SERVER_NOT_CONFIGURED =
  'O modo online ainda não está disponível: nenhum servidor foi configurado nesta versão. Você pode jogar contra a IA normalmente.';
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!serverUrl) throw new ApiError(SERVER_NOT_CONFIGURED, 0);
  const insecure = validateServerUrl(serverUrl);
  if (insecure) throw new ApiError(insecure, 0);
  let res: Response;
  try {
    res = await fetch(`${serverUrl}/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(`Não foi possível conectar ao servidor (${serverUrl}).`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Erro inesperado.', res.status);
  return data as T;
}

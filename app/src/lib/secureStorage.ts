import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Guarda segredos (o token JWT) no Keychain (iOS) / Keystore (Android).
 * Na web não há armazenamento seguro equivalente, então cai no AsyncStorage.
 */
const native = Platform.OS !== 'web';

/**
 * Se o Keychain/Keystore falhar (ex.: app sem assinatura no simulador do iOS),
 * usa o AsyncStorage para o app continuar funcionando.
 */
async function safe<T>(secure: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!native) return fallback();
  try {
    return await secure();
  } catch {
    return fallback();
  }
}

export const secureStorage = {
  get: (key: string) =>
    safe(
      async () => (await SecureStore.getItemAsync(key)) ?? (await AsyncStorage.getItem(key)),
      () => AsyncStorage.getItem(key),
    ),
  set: (key: string, value: string) =>
    safe(
      () => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
      () => AsyncStorage.setItem(key, value),
    ),
  remove: async (key: string) => {
    await AsyncStorage.removeItem(key).catch(() => {});
    if (native) await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

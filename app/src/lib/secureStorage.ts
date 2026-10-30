import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Guarda segredos (o token JWT) no Keychain (iOS) / Keystore (Android).
 * Na web não há armazenamento seguro equivalente, então cai no AsyncStorage.
 */
const native = Platform.OS !== 'web';

export const secureStorage = {
  get: (key: string) => (native ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key)),
  set: (key: string, value: string) =>
    native
      ? SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
      : AsyncStorage.setItem(key, value),
  remove: (key: string) => (native ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key)),
};

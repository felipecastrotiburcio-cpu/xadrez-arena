import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { configureLocalBackend } from './localBackend';

// Liga o servidor local ao armazenamento do aparelho e ao gerador aleatório seguro do sistema.
configureLocalBackend({
  storage: AsyncStorage,
  randomBytes: (n) => Crypto.getRandomBytes(n),
});

export { localApi, localEvents, ONLINE_ONLY } from './localBackend';

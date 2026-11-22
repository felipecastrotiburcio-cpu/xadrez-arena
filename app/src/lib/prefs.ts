import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Preferências do aparelho (Configurações). Hoje: mostrar para onde a peça tocada pode ir.
 * Fica salvo no aparelho e vale na hora para todos os tabuleiros abertos.
 */
const KEY = 'xadrez.moveHints';
let moveHints = true;
const listeners = new Set<(on: boolean) => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'off') setLocal(false);
  })
  .catch(() => {});

function setLocal(on: boolean) {
  moveHints = on;
  for (const l of listeners) l(on);
}

export const isMoveHintsOn = () => moveHints;

export async function setMoveHints(on: boolean) {
  setLocal(on);
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
}

/** Liga/desliga a prévia dos movimentos (padrão: ligada). */
export function useMoveHints(): boolean {
  const [on, setOn] = useState(moveHints);
  useEffect(() => {
    listeners.add(setOn);
    setOn(moveHints);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { AvatarStyle, BoardStyle, CharacterStyle, ItemType, PieceStyle, ShopItem } from './types';

// v2: bonecos em blocos (acessórios 3D em vez de emoji).
const CACHE_KEY = 'xadrez.catalog.v3';

/**
 * Itens gratuitos embutidos no app: garantem que tudo seja desenhado mesmo
 * offline (partidas contra a IA) antes do catálogo do servidor chegar.
 */
const FALLBACK: ShopItem[] = [
  {
    id: 'board_classic', type: 'board', name: 'Madeira Clássica', description: '', price: 0, rarity: 'comum',
    style: {
      light: '#efd9b4', dark: '#b5835a', border: '#7a5232', frame: 8, coord: { light: '#b5835a', dark: '#efd9b4' },
      pattern: 'none', patternColor: 'transparent', highlight: 'rgba(240, 210, 60, 0.55)', shape: 'flat', frameStyle: 'wood',
    },
  },
  {
    id: 'pieces_classic', type: 'pieces', name: 'Clássicas', description: '', price: 0, rarity: 'comum',
    style: { whiteFill: '#fbf8f1', whiteOutline: '#2a1d10', blackFill: '#1d1a17', blackOutline: 'rgba(255,255,255,0.35)', glow: 0 },
  },
  { id: 'avatar_letter', type: 'avatar', name: 'Inicial', description: '', price: 0, rarity: 'comum', style: { emoji: '', background: '', ring: 'transparent' } },
  {
    id: 'char_rookie', type: 'character', name: 'Novato', description: '', price: 0, rarity: 'comum',
    style: { skin: '#f8d34a', shirt: '#1e88e5', pants: '#7cb342', shoes: '#4e7a27', hat: 'none', hatColor: '#000000', face: 'smile' },
  },
  { id: 'move_jamal', type: 'move', name: 'Passinho do Jamal', description: '', price: 0, rarity: 'comum', style: { animation: 'jamal', emoji: '🕺' } },
  { id: 'move_67', type: 'move', name: 'Movimento do 67', description: '', price: 0, rarity: 'comum', style: { animation: '67', emoji: '🤲' } },
];

export const DEFAULT_LOOK: Record<ItemType, string> = {
  board: 'board_classic',
  pieces: 'pieces_classic',
  avatar: 'avatar_letter',
  character: 'char_rookie',
  move: 'move_jamal',
};

/** Boneco usado pela IA nas finalizações. */
export const AI_CHARACTER: CharacterStyle = {
  skin: '#b0bec5', shirt: '#546e7a', pants: '#37474f', shoes: '#263238', hat: 'none', hatColor: '#000000', face: 'visor',
};

export const RARITY = {
  comum: { label: 'Comum', color: '#aaa3dc' },
  raro: { label: 'Raro', color: '#2ec5ff' },
  epico: { label: 'Épico', color: '#c17bff' },
  lendario: { label: 'Lendário', color: '#ffc83d' },
} as const;

interface CosmeticsValue {
  items: ShopItem[];
  get: (id: string | undefined) => ShopItem | undefined;
  reload: () => Promise<void>;
}

const CosmeticsContext = createContext<CosmeticsValue | null>(null);

export function CosmeticsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShopItem[]>(FALLBACK);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ items: ShopItem[] }>('/shop/catalog');
      setItems(r.items);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(r.items));
    } catch {
      // offline: fica com o cache / itens embutidos
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => raw && setItems(JSON.parse(raw)))
      .catch(() => {})
      .finally(reload);
  }, [reload]);

  const value = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i]));
    return { items, get: (id: string | undefined) => (id ? map.get(id) : undefined), reload };
  }, [items, reload]);

  return <CosmeticsContext.Provider value={value}>{children}</CosmeticsContext.Provider>;
}

export function useCosmetics() {
  const ctx = useContext(CosmeticsContext);
  if (!ctx) throw new Error('useCosmetics precisa estar dentro de <CosmeticsProvider>');
  return ctx;
}

function styleOf<T extends ItemType>(ctx: CosmeticsValue, type: T, id: string | undefined) {
  const item = ctx.get(id) ?? ctx.get(DEFAULT_LOOK[type]) ?? FALLBACK.find((i) => i.id === DEFAULT_LOOK[type]);
  return item!.style as Extract<ShopItem, { type: T }>['style'];
}

export function useBoardStyle(id?: string): BoardStyle {
  return styleOf(useCosmetics(), 'board', id);
}
export function usePieceStyle(id?: string): PieceStyle {
  return styleOf(useCosmetics(), 'pieces', id);
}
export function useAvatarStyle(id?: string): AvatarStyle {
  return styleOf(useCosmetics(), 'avatar', id);
}
export function useCharacterStyle(id?: string): CharacterStyle {
  return styleOf(useCosmetics(), 'character', id);
}

/** Aparência equipada do usuário logado (ou padrão para visitantes). */
export function useMyLook() {
  const { user } = useAuth();
  const eq = user?.equipped ?? DEFAULT_LOOK;
  return {
    equipped: eq,
    board: useBoardStyle(eq.board),
    pieces: usePieceStyle(eq.pieces),
  };
}

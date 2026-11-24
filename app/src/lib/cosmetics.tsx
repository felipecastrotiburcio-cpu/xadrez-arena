import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { GearId } from '../three/gear';
import type { EvoId } from '../three/evolve';
import type { AvatarStyle, BoardStyle, CharacterStyle, EntranceStyle, EvolutionStyle, ItemType, PieceStyle, ShopItem } from './types';

// v5: bonecos no visual novo (roupas, cabelo e mãos) e evoluções.
const CACHE_KEY = 'xadrez.catalog.v5';

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
    style: {
      skin: '#f2c18f', hair: 'swoop', hairColor: '#5d3a1a', outfit: 'tee', top: '#1e88e5', accent: '#ffffff', logo: true,
      pants: '#3b5f8a', shoes: '#e53935', headwear: 'none', headwearColor: '#000000', face: 'smile',
    },
  },
  { id: 'move_jamal', type: 'move', name: 'Passinho do Jamal', description: '', price: 0, rarity: 'comum', style: { animation: 'jamal', emoji: '🕺' } },
  { id: 'move_67', type: 'move', name: 'Movimento do 67', description: '', price: 0, rarity: 'comum', style: { animation: '67', emoji: '🤲' } },
  { id: 'entrance_pop', type: 'entrance', name: 'Pop', description: '', price: 0, rarity: 'comum', style: { effect: 'pop', emoji: '🫧', color: '#ffffff' } },
];

export const DEFAULT_LOOK: Record<ItemType, string> = {
  board: 'board_classic',
  pieces: 'pieces_classic',
  avatar: 'avatar_letter',
  character: 'char_rookie',
  move: 'move_jamal',
  entrance: 'entrance_pop',
  evolution: '',
};

/** Boneco usado pela IA nas finalizações (um robô prateado). */
export const AI_CHARACTER: CharacterStyle = {
  skin: '#b0bec5', hair: 'none', hairColor: '#000000', outfit: 'robot', top: '#78909c', accent: '#ff3d00',
  pants: '#546e7a', shoes: '#37474f', headwear: 'none', headwearColor: '#000000', face: 'visor',
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

/** Aparência completa do boneco para o 3D: estilo + roupa evoluída e item especial (se houver). */
export type FullLook = CharacterStyle & { gear?: GearId[]; evolution?: EvoId; /** Id do boneco (para a foto em miniatura). */ id?: string };

/** Junta o boneco com a evolução — só se a evolução for deste boneco. */
export function resolveLook(get: CosmeticsValue['get'], characterId?: string, evolutionId?: string): FullLook {
  const ch = get(characterId) ?? get(DEFAULT_LOOK.character) ?? FALLBACK.find((i) => i.id === DEFAULT_LOOK.character)!;
  const base: FullLook = { ...(ch.style as CharacterStyle), id: ch.id };
  const evo = get(evolutionId);
  if (evo?.type !== 'evolution' || evo.style.character !== ch.id) return base;
  return evolvedLook(base, evo.style);
}

/** Aplica uma evolução (cores novas, roupa evoluída e item especial) sobre o boneco. */
export function evolvedLook(base: FullLook, evo: EvolutionStyle): FullLook {
  return { ...base, ...evo.colors, gear: [evo.gear as GearId], evolution: evo.outfit as EvoId };
}

/** Aparência completa (boneco + evolução) de um jogador. */
export function useFullLook(characterId?: string, evolutionId?: string): FullLook {
  const { get } = useCosmetics();
  return useMemo(() => resolveLook(get, characterId, evolutionId), [get, characterId, evolutionId]);
}
export function useEntranceStyle(id?: string): EntranceStyle {
  return styleOf(useCosmetics(), 'entrance', id);
}

/** Aparência equipada do usuário logado (ou padrão para visitantes). */
export function useMyLook() {
  const { user } = useAuth();
  const eq = user?.equipped ?? DEFAULT_LOOK;
  return {
    equipped: eq,
    board: useBoardStyle(eq.board),
    pieces: usePieceStyle(eq.pieces),
    // Contas antigas não têm surgimento equipado: usa o padrão.
    entrance: useEntranceStyle(eq.entrance ?? DEFAULT_LOOK.entrance),
  };
}

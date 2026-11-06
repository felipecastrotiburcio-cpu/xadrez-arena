import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/** Sons do tabuleiro: lance, captura, xeque e xeque-mate (gerados por scripts/gen-sounds.mjs). */
export type BoardSound = 'move' | 'capture' | 'check' | 'mate';

const SOURCES: Record<BoardSound, number> = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  check: require('../../assets/sounds/check.wav'),
  mate: require('../../assets/sounds/mate.wav'),
};

const KEY = 'xadrez.sound';
let enabled = true;
let players: Partial<Record<BoardSound, AudioPlayer>> = {};
let modeSet = false;

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'off') enabled = false;
  })
  .catch(() => {});

export const isSoundEnabled = () => enabled;

export async function setSoundEnabled(on: boolean) {
  enabled = on;
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
}

function player(name: BoardSound) {
  let p = players[name];
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    p.volume = name === 'move' ? 0.8 : 1;
    players[name] = p;
  }
  return p;
}

/** Carrega os sons antes do primeiro lance (evita atraso no primeiro toque). */
export function preloadSounds() {
  try {
    if (!modeSet) {
      modeSet = true;
      // Respeita o modo silencioso e não interrompe a música de outros apps.
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
    }
    (Object.keys(SOURCES) as BoardSound[]).forEach(player);
  } catch {
    // sem áudio neste aparelho: o jogo segue em silêncio
  }
}

export function playSound(name: BoardSound) {
  if (!enabled) return;
  try {
    const p = player(name);
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    players = { ...players, [name]: undefined };
  }
}

// ------------------------------------------------------------------ músicas das finalizações

/** Música de cada movimento especial (composições originais em scripts/gen-sounds.mjs). */
const MUSIC = {
  '67': require('../../assets/sounds/music_67.wav'),
  jamal: require('../../assets/sounds/music_jamal.wav'),
  victory: require('../../assets/sounds/music_victory.wav'),
} as const;

let music: AudioPlayer | null = null;

/** Toca (em loop) a música do movimento; os que não têm música própria usam a fanfarra. */
export function playMusic(move: string) {
  stopMusic();
  if (!enabled) return;
  try {
    const src = MUSIC[move as keyof typeof MUSIC] ?? MUSIC.victory;
    music = createAudioPlayer(src);
    music.loop = true;
    music.volume = 0.85;
    music.play();
  } catch {
    music = null;
  }
}

export function stopMusic() {
  const m = music;
  music = null;
  if (!m) return;
  try {
    m.pause();
    m.remove();
  } catch {
    // já liberado
  }
}

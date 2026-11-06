import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { ChessBoard, SLIDE_MS, type BoardMove } from '../../components/ChessBoard';
import { Finale } from '../../components/Finale';
import { GameOverModal } from '../../components/GameOverModal';
import { MoveList } from '../../components/MoveList';
import { PlayerBar } from '../../components/PlayerBar';
import { Button, Screen } from '../../components/ui';
import { AI_LEVELS, findBestMoveAsync, suggestMoveAsync } from '../../ai';
import { recordAiResult } from '../../lib/aiStats';
import { api, isLocalMode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AI_CHARACTER, useCharacterStyle, useCosmetics, useMyLook } from '../../lib/cosmetics';
import { materialInfo, resultText } from '../../lib/chessUtils';
import { colors } from '../../lib/theme';
import type { PrivateUser, Side } from '../../lib/types';

interface Reward {
  coins: number;
  ratingChange: number;
  newRating: number;
  levelUp: string | null;
}

function gameResult(chess: Chess): { result: string; reason: string } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'xeque-mate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'afogamento' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'material insuficiente' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'repetição tripla' };
  if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'regra dos 50 lances' };
  return null;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const tap = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export default function AiGame() {
  const params = useLocalSearchParams<{ level: string; color: Side }>();
  const level = AI_LEVELS.find((l) => l.id === Number(params.level)) ?? AI_LEVELS[1];
  const playerSide: Side = params.color === 'b' ? 'b' : 'w';
  const { user, setUser } = useAuth();
  const [reward, setReward] = useState<Reward | null>(null);
  // Cada partida dá recompensa uma única vez (desfazer e vencer de novo não paga outra vez).
  const rewarded = useRef(false);
  const look = useMyLook();
  const { get } = useCosmetics();
  const myCharacter = useCharacterStyle(look.equipped.character);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 520);

  const chessRef = useRef(new Chess());
  const fenHistory = useRef<string[]>([]);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [over, setOver] = useState<{ result: string; reason: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [finale, setFinale] = useState(false);
  /** Resultado decisivo: primeiro a finalização com os bonecos, depois o resumo. */
  const announce = useCallback((result: string) => {
    if (result === '1/2-1/2') setShowModal(true);
    else setFinale(true);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: `vs ${level.name}` });
  }, [navigation, level.name]);

  const sync = useCallback(() => {
    const c = chessRef.current;
    setFen(c.fen());
    const h = c.history({ verbose: true });
    const last = h[h.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setHint(null);
  }, []);

  const report = useCallback(
    (outcome: 'win' | 'loss' | 'draw', reason: string) => {
      recordAiResult(level.id, outcome);
      // Conta do aparelho: moedas e rating (no modo online a IA não paga, pois o servidor não confere a partida).
      if (!user || !isLocalMode() || rewarded.current) return;
      rewarded.current = true;
      const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
      api<{ user: PrivateUser; coins: number; ratingChange: number; levelUp: boolean }>('/ai/result', {
        body: { level: level.id, score, reason, color: playerSide === 'w' ? 'white' : 'black' },
      })
        .then((r) => {
          setUser(r.user);
          setReward({
            coins: r.coins,
            ratingChange: r.ratingChange,
            newRating: r.user.rating,
            levelUp: r.levelUp ? r.user.levelName : null,
          });
        })
        .catch(() => {});
    },
    [level.id, playerSide, user, setUser],
  );

  const finishIfOver = useCallback(() => {
    const r = gameResult(chessRef.current);
    if (!r) return false;
    setOver(r);
    announce(r.result);
    report(resultText(r.result, r.reason, playerSide).outcome, r.reason);
    return true;
  }, [playerSide, announce, report]);

  const applyMove = useCallback(
    (m: BoardMove) => {
      const c = chessRef.current;
      const before = c.fen();
      try {
        c.move(m);
      } catch {
        return false;
      }
      fenHistory.current.push(before);
      tap();
      sync();
      return true;
    },
    [sync],
  );

  // Vez da IA. Ela "pensa" por um intervalo natural (0,9–1,6 s, variando a cada lance)
  // e calcula em trechos, para a tela e as animações continuarem fluidas.
  useEffect(() => {
    const c = chessRef.current;
    if (over || c.turn() === playerSide || c.isGameOver()) return;
    let cancelled = false;
    setThinking(true);
    const started = Date.now();
    const minThink = 900 + Math.random() * 700;
    (async () => {
      // Deixa a peça do jogador terminar de deslizar antes de começar a calcular.
      await wait(SLIDE_MS + 60);
      const r = await findBestMoveAsync(c.fen(), { level: level.id, history: fenHistory.current });
      const rest = minThink - (Date.now() - started);
      if (rest > 0) await wait(rest);
      if (cancelled) return;
      if (r.move) applyMove(r.move);
      setThinking(false);
      finishIfOver();
    })();
    return () => {
      cancelled = true;
    };
  }, [fen, over, playerSide, level.id, applyMove, finishIfOver]);

  const onPlayerMove = (m: BoardMove) => {
    if (thinking || over) return;
    if (applyMove(m)) finishIfOver();
  };

  const undo = () => {
    const c = chessRef.current;
    if (thinking || c.history().length === 0) return;
    // Desfaz o lance da IA e o do jogador.
    const plies = c.turn() === playerSide ? 2 : 1;
    for (let i = 0; i < plies && c.history().length > 0; i++) {
      c.undo();
      fenHistory.current.pop();
    }
    setOver(null);
    sync();
  };

  const [hinting, setHinting] = useState(false);
  const showHint = async () => {
    if (thinking || over || hinting) return;
    setHinting(true);
    const fenNow = chessRef.current.fen();
    const m = await suggestMoveAsync(fenNow, fenHistory.current);
    setHinting(false);
    // Só mostra se a posição não mudou enquanto calculava.
    if (m && chessRef.current.fen() === fenNow) setHint({ from: m.from, to: m.to });
  };

  const restart = () => {
    chessRef.current = new Chess();
    fenHistory.current = [];
    rewarded.current = false;
    setReward(null);
    setOver(null);
    setShowModal(false);
    setFinale(false);
    setThinking(false);
    sync();
  };

  const resign = () => {
    const confirm = () => {
      const r = { result: playerSide === 'w' ? '0-1' : '1-0', reason: 'desistência' };
      setOver(r);
      announce(r.result);
      report('loss', 'desistência');
    };
    if (Platform.OS === 'web') confirm();
    else Alert.alert('Desistir?', 'A partida contará como derrota.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desistir', style: 'destructive', onPress: confirm },
    ]);
  };

  const material = useMemo(() => materialInfo(fen), [fen]);
  const turn = fen.split(' ')[1] as Side;
  const aiSide: Side = playerSide === 'w' ? 'b' : 'w';
  const adv = (side: Side) => Math.max(0, side === 'w' ? material.advantage : -material.advantage);
  const text = over ? resultText(over.result, over.reason, playerSide) : null;

  return (
    <Screen scroll style={{ gap: 8, paddingHorizontal: 12 }}>
      <PlayerBar
        name={level.name}
        subtitle={`~${level.elo}`}
        captured={material.captured[playerSide]}
        capturedColor={playerSide}
        advantage={adv(aiSide)}
        active={turn === aiSide && !over}
        thinking={thinking}
      />
      <ChessBoard
        fen={fen}
        size={boardSize}
        orientation={playerSide}
        movableColor={over || thinking ? null : playerSide}
        lastMove={lastMove}
        hint={hint}
        onMove={onPlayerMove}
        boardStyle={look.board}
        pieceStyle={look.pieces}
      />
      <PlayerBar
        name={user?.username ?? 'Você'}
        avatar={user?.equipped.avatar}
        captured={material.captured[aiSide]}
        capturedColor={aiSide}
        advantage={adv(playerSide)}
        active={turn === playerSide && !over}
      />
      <MoveList moves={chessRef.current.history()} />
      {over && !showModal && text && (
        <Text style={styles.status}>
          {text.title} — {text.subtitle}
        </Text>
      )}
      <View style={styles.actions}>
        <Button small variant="secondary" title="Desfazer" icon="↶" style={styles.action} onPress={undo} disabled={thinking} />
        <Button small variant="secondary" title="Dica" icon="💡" style={styles.action} onPress={showHint} disabled={thinking || hinting || !!over} loading={hinting} />
        {over ? (
          <Button small title="Nova" icon="↻" style={styles.action} onPress={restart} />
        ) : (
          <Button small variant="secondary" title="Desistir" icon="⚑" style={styles.action} onPress={resign} />
        )}
      </View>

      {over && text && text.outcome !== 'draw' && (
        <Finale
          visible={finale}
          winner={
            text.outcome === 'win'
              ? { name: user?.username ?? 'Você', look: myCharacter }
              : { name: level.name, look: AI_CHARACTER }
          }
          loser={
            text.outcome === 'win'
              ? { name: level.name, look: AI_CHARACTER }
              : { name: user?.username ?? 'Você', look: myCharacter }
          }
          move={text.outcome === 'win' ? (get(look.equipped.move)?.style as { animation: string } | undefined)?.animation ?? 'jamal' : '67'}
          moveName={text.outcome === 'win' ? get(look.equipped.move)?.name : 'Movimento do 67'}
          title={text.title}
          subtitle={text.subtitle}
          onDone={() => {
            setFinale(false);
            setShowModal(true);
          }}
        />
      )}
      {text && (
        <GameOverModal
          visible={showModal}
          outcome={text.outcome}
          title={text.title}
          subtitle={text.subtitle}
          ratingChange={reward?.ratingChange}
          newRating={reward?.newRating}
          coins={reward?.coins}
          levelUp={reward?.levelUp}
        >
          {!user && (
            <Button title="Criar conta e ganhar moedas" variant="gold" onPress={() => router.push('/login')} />
          )}
          <Button title="Jogar novamente" onPress={restart} />
          <Button title="Analisar tabuleiro" variant="secondary" onPress={() => setShowModal(false)} />
          <Button title="Trocar adversário" variant="ghost" onPress={() => router.back()} />
        </GameOverModal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  status: { color: colors.accent, textAlign: 'center', fontWeight: '700' },
});

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
import { AI_LEVELS, evaluateAsync, findBestMoveAsync, suggestMoveAsync } from '../../ai';
import { recordAiResult } from '../../lib/aiStats';
import { api, isLocalMode } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AI_CHARACTER, useCharacterStyle, useCosmetics, useMyLook } from '../../lib/cosmetics';
import { hasMatingMaterial, materialInfo, resultText } from '../../lib/chessUtils';
import { itemName } from '../../lib/catalogI18n';
import { translateServerText, useT, type TranslationKey } from '../../lib/i18n';
import { useToast } from '../../lib/toast';
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
  const params = useLocalSearchParams<{ level: string; color: Side; time?: string }>();
  const level = AI_LEVELS.find((l) => l.id === Number(params.level)) ?? AI_LEVELS[1];
  const playerSide: Side = params.color === 'b' ? 'b' : 'w';
  const aiSide: Side = playerSide === 'w' ? 'b' : 'w';
  // Relógio (10, 5 ou 3 min). Começa a correr depois do primeiro lance, como nas partidas online.
  const initialMs = Math.max(0, Number(params.time) || 0) * 60_000;
  const timed = initialMs > 0;
  const clocks = useRef({ w: initialMs, b: initialMs });
  const turnStart = useRef(0);
  const [, setTick] = useState(0);
  const toast = useToast();
  const { t, lang } = useT();
  const aiName = t(`ai.${level.id}.name` as TranslationKey);
  const [drawBusy, setDrawBusy] = useState(false);
  const { user, setUser } = useAuth();
  const [reward, setReward] = useState<Reward | null>(null);
  // Cada partida dá recompensa uma única vez (desfazer e vencer de novo não paga outra vez).
  const rewarded = useRef(false);
  const look = useMyLook();
  const { get } = useCosmetics();
  const myCharacter = useCharacterStyle(look.equipped.character);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  // Tabuleiro de ponta a ponta na tela do celular.
  const boardSize = Math.min(width, 640);

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
    navigation.setOptions({ title: t('aiPlay.title', { name: aiName }) });
  }, [navigation, aiName, t]);

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

  const endGame = useCallback(
    (r: { result: string; reason: string }) => {
      setOver(r);
      announce(r.result);
      report(resultText(r.result, r.reason, playerSide).outcome, r.reason);
    },
    [playerSide, announce, report],
  );

  const finishIfOver = useCallback(() => {
    const r = gameResult(chessRef.current);
    if (!r) return false;
    endGame(r);
    return true;
  }, [endGame]);

  /** Tempo restante de um lado agora (o relógio de quem joga está correndo). */
  const clockNow = (side: Side) => {
    const c = chessRef.current;
    const base = clocks.current[side];
    const running = timed && !over && c.history().length > 0 && c.turn() === side;
    return Math.max(0, running ? base - (Date.now() - turnStart.current) : base);
  };

  const applyMove = useCallback(
    (m: BoardMove) => {
      const c = chessRef.current;
      const before = c.fen();
      const mover = c.turn();
      const plies = c.history().length;
      try {
        c.move(m);
      } catch {
        return false;
      }
      if (timed) {
        const now = Date.now();
        if (plies > 0) clocks.current[mover] = Math.max(0, clocks.current[mover] - (now - turnStart.current));
        turnStart.current = now;
      }
      fenHistory.current.push(before);
      tap();
      sync();
      return true;
    },
    [sync, timed],
  );

  // Vez da IA. Ela "pensa" por um intervalo natural (0,9–1,6 s, variando a cada lance)
  // e calcula em trechos, para a tela e as animações continuarem fluidas.
  useEffect(() => {
    const c = chessRef.current;
    if (over || c.turn() === playerSide || c.isGameOver()) return;
    let cancelled = false;
    setThinking(true);
    const started = Date.now();
    // Com relógio, a IA gasta no máximo ~1/40 do tempo que lhe resta em cada lance.
    const left = clocks.current[aiSide] - (c.history().length > 0 ? Date.now() - turnStart.current : 0);
    const minThink = Math.min(900 + Math.random() * 700, timed ? left / 60 : Infinity);
    const maxTimeMs = timed ? Math.max(80, left / 40) : undefined;
    (async () => {
      // Deixa a peça do jogador terminar de deslizar antes de começar a calcular.
      await wait(SLIDE_MS + 60);
      const r = await findBestMoveAsync(c.fen(), { level: level.id, history: fenHistory.current, maxTimeMs });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, over, playerSide, level.id, applyMove, finishIfOver]);

  // Relógio: redesenha a cada 100 ms e encerra a partida quando o tempo de alguém acaba.
  const clockRunning = timed && !over && chessRef.current.history().length > 0;
  useEffect(() => {
    if (!clockRunning) return;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      const c = chessRef.current;
      const side = c.turn();
      if (clocks.current[side] - (Date.now() - turnStart.current) > 0) return;
      clocks.current[side] = 0;
      const winner: Side = side === 'w' ? 'b' : 'w';
      // Quem ainda tem tempo só vence se tiver material para dar mate (senão é empate).
      endGame(
        hasMatingMaterial(c.fen(), winner)
          ? { result: winner === 'w' ? '1-0' : '0-1', reason: 'tempo' }
          : { result: '1/2-1/2', reason: 'tempo esgotado sem material' },
      );
    }, 100);
    return () => clearInterval(t);
  }, [clockRunning, endGame]);

  // Proposta de empate: a IA aceita se não estiver melhor na posição (avaliação ≤ +0,3 peão para ela).
  const offerDraw = async () => {
    const c = chessRef.current;
    if (thinking || over || drawBusy) return;
    if (c.history().length < 20) {
      toast(t('aiPlay.drawTooEarly'), 'info');
      return;
    }
    setDrawBusy(true);
    const fenNow = c.fen();
    const score = await evaluateAsync(fenNow, fenHistory.current);
    setDrawBusy(false);
    if (chessRef.current.fen() !== fenNow || over) return;
    const aiScore = c.turn() === aiSide ? score : -score;
    if (aiScore <= 30) {
      endGame({ result: '1/2-1/2', reason: 'acordo' });
    } else {
      toast(t('aiPlay.drawDeclined', { name: aiName }), 'info');
    }
  };

  const onPlayerMove = (m: BoardMove) => {
    if (thinking || over) return;
    if (applyMove(m)) finishIfOver();
  };

  const undo = () => {
    const c = chessRef.current;
    if (thinking || timed || c.history().length === 0) return;
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
    clocks.current = { w: initialMs, b: initialMs };
    turnStart.current = 0;
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
    else Alert.alert(t('aiPlay.resignTitle'), t('aiPlay.resignBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.resign'), style: 'destructive', onPress: confirm },
    ]);
  };

  const material = useMemo(() => materialInfo(fen), [fen]);
  const turn = fen.split(' ')[1] as Side;
  const adv = (side: Side) => Math.max(0, side === 'w' ? material.advantage : -material.advantage);
  const text = over ? resultText(over.result, over.reason, playerSide) : null;

  return (
    <Screen scroll style={{ gap: 8, paddingHorizontal: 4 }}>
      <PlayerBar
        name={aiName}
        subtitle={`~${level.elo}`}
        captured={material.captured[playerSide]}
        capturedColor={playerSide}
        advantage={adv(aiSide)}
        active={turn === aiSide && !over}
        thinking={thinking}
        clockMs={timed ? clockNow(aiSide) : undefined}
      />
      <View style={{ marginHorizontal: -4, alignItems: 'center' }}>
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
        premoveColor={over ? null : playerSide}
      />
      </View>
      <PlayerBar
        name={user?.username ?? t('common.you')}
        country={user?.country}
        avatar={user?.equipped.avatar}
        captured={material.captured[aiSide]}
        capturedColor={aiSide}
        advantage={adv(playerSide)}
        active={turn === playerSide && !over}
        clockMs={timed ? clockNow(playerSide) : undefined}
      />
      <MoveList moves={chessRef.current.history()} />
      {over && !showModal && text && (
        <Text style={styles.status}>
          {text.title} — {text.subtitle}
        </Text>
      )}
      <View style={styles.actions}>
        {!timed && <Button small variant="secondary" title={t('aiPlay.undo')} icon="↶" style={styles.action} onPress={undo} disabled={thinking} />}
        <Button small variant="secondary" title={t('aiPlay.hint')} icon="💡" style={styles.action} onPress={showHint} disabled={thinking || hinting || !!over} loading={hinting} />
        {over ? (
          <Button small title={t('aiPlay.new')} icon="↻" style={styles.action} onPress={restart} />
        ) : (
          <>
            <Button small variant="secondary" title={t('common.draw')} icon="½" style={styles.action} onPress={offerDraw} disabled={thinking} loading={drawBusy} />
            <Button small variant="secondary" title={t('common.resign')} icon="⚑" style={styles.action} onPress={resign} />
          </>
        )}
      </View>

      {over && text && text.outcome !== 'draw' && (
        <Finale
          visible={finale}
          winner={
            text.outcome === 'win'
              ? { name: user?.username ?? t('common.you'), look: myCharacter }
              : { name: aiName, look: AI_CHARACTER }
          }
          loser={
            text.outcome === 'win'
              ? { name: aiName, look: AI_CHARACTER }
              : { name: user?.username ?? t('common.you'), look: myCharacter }
          }
          move={text.outcome === 'win' ? (get(look.equipped.move)?.style as { animation: string } | undefined)?.animation ?? 'jamal' : '67'}
          moveName={
            text.outcome === 'win'
              ? (() => {
                  const m = get(look.equipped.move);
                  return m ? itemName(m, lang) : undefined;
                })()
              : itemName({ id: 'move_67', name: 'Movimento do 67' }, lang)
          }
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
          levelUp={translateServerText(reward?.levelUp)}
        >
          {!user && (
            <Button title={t('aiPlay.signUpCoins')} variant="gold" onPress={() => router.push('/login')} />
          )}
          <Button title={t('aiPlay.playAgain')} onPress={restart} />
          <Button title={t('aiPlay.analyze')} variant="secondary" onPress={() => setShowModal(false)} />
          <Button title={t('aiPlay.changeOpponent')} variant="ghost" onPress={() => router.back()} />
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

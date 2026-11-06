import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { ChessBoard, type BoardMove } from '../../components/ChessBoard';
import { Finale } from '../../components/Finale';
import { GameOverModal } from '../../components/GameOverModal';
import { MoveList } from '../../components/MoveList';
import { PlayerBar } from '../../components/PlayerBar';
import { Button, Card, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { confirmAction } from '../../lib/confirm';
import { useCharacterStyle, useCosmetics, useMyLook } from '../../lib/cosmetics';
import { materialInfo, resultText } from '../../lib/chessUtils';
import { useSocket } from '../../lib/socket';
import { colors } from '../../lib/theme';
import { useToast } from '../../lib/toast';
import type { GameOver, GameState, Side } from '../../lib/types';

const isOver = (s: GameState | GameOver | null): s is GameOver => !!s && 'reason' in s;

export default function OnlineGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { socket, emit, gameCache, connected } = useSocket();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 8, 600);

  const [state, setState] = useState<GameState | GameOver | null>(gameCache.get(id) ?? null);
  const [showModal, setShowModal] = useState(isOver(gameCache.get(id) ?? null));
  const [finale, setFinale] = useState(false);
  const look = useMyLook();
  const { get } = useCosmetics();
  const [opponentOffline, setOpponentOffline] = useState(false);
  const [rematchSent, setRematchSent] = useState(false);
  const receivedAt = useRef(Date.now());
  const [, setTick] = useState(0);

  const apply = useCallback((s: GameState | GameOver) => {
    receivedAt.current = Date.now();
    setState(s);
    if (isOver(s)) {
      // Vitória/derrota: primeiro a finalização dos bonecos; empate/cancelada: direto ao resumo.
      if (s.result === '1-0' || s.result === '0-1') setFinale(true);
      else setShowModal(true);
    }
  }, []);

  const resync = useCallback(async () => {
    const r = await emit('game:sync', { gameId: id });
    if (r.state) apply(r.state as GameState);
    else if (!isOver(gameCache.get(id) ?? null)) toast(r.error ?? 'Partida não encontrada.', 'error');
  }, [emit, id, apply, gameCache, toast]);

  useEffect(() => {
    if (!socket) return;
    const onState = (s: GameState) => {
      if (s.id !== id) return;
      apply(s);
      if (s.moves.length && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    };
    const onOver = (s: GameOver) => {
      if (s.id !== id) return;
      apply(s);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    const onConn = ({ userId, connected: c }: { userId: string; connected: boolean }) => {
      if (userId !== user?.id) setOpponentOffline(!c);
    };
    socket.on('game:state', onState);
    socket.on('game:over', onOver);
    socket.on('game:opponentConnection', onConn);
    return () => {
      socket.off('game:state', onState);
      socket.off('game:over', onOver);
      socket.off('game:opponentConnection', onConn);
    };
  }, [socket, id, apply, user?.id]);

  // Ao (re)conectar, busca o estado atual da partida.
  useEffect(() => {
    if (connected && !isOver(state)) resync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Relógio local: atualiza a tela a cada 100ms enquanto a partida corre.
  const running = !!state && !isOver(state) && state.clocksRunning;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [running]);

  const mySide: Side | null = !state || !user ? null : state.white.id === user.id ? 'w' : state.black.id === user.id ? 'b' : null;
  const material = useMemo(() => materialInfo(state?.fen ?? new Chess().fen()), [state?.fen]);
  const whiteLook = useCharacterStyle(state?.white.cosmetics?.character);
  const blackLook = useCharacterStyle(state?.black.cosmetics?.character);

  if (!state || !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const over = isOver(state) ? state : null;
  const orientation: Side = mySide ?? 'w';
  const oppSide: Side = orientation === 'w' ? 'b' : 'w';
  const players = { w: state.white, b: state.black };

  const clockFor = (side: Side) => {
    const base = side === 'w' ? state.clocks.white : state.clocks.black;
    if (running && state.turn === side) return Math.max(0, base - (Date.now() - receivedAt.current));
    return base;
  };

  const onMove = async (m: BoardMove) => {
    // Atualização otimista: mostra o lance antes da confirmação do servidor.
    const c = new Chess(state.fen);
    try {
      c.move(m);
    } catch {
      return;
    }
    const prev = state;
    setState({ ...state, fen: c.fen(), turn: c.turn(), lastMove: { from: m.from, to: m.to }, moves: [...state.moves, c.history()[0]] });
    const r = await emit('game:move', { gameId: id, ...m });
    if (r.error) {
      toast(r.error, 'error');
      setState(prev);
      resync();
    }
  };

  const resign = () =>
    confirmAction(
      state.moves.length < 2 ? 'Cancelar partida?' : 'Desistir?',
      state.moves.length < 2 ? 'Sem lances, a partida não vale pontos.' : 'Você perderá pontos de rating.',
      async () => {
        const r = await emit('game:resign', { gameId: id });
        if (r.error) toast(r.error, 'error');
      },
    );

  const offerDraw = async () => {
    const r = await emit('game:offerDraw', { gameId: id });
    if (r.error) toast(r.error, 'error');
    else toast('Proposta de empate enviada.');
  };

  const respondDraw = async (accept: boolean) => {
    const r = await emit('game:respondDraw', { gameId: id, accept });
    if (r.error) toast(r.error, 'error');
  };

  const rematch = async () => {
    if (!mySide) return;
    const opponent = players[oppSide];
    const r = await emit('invite:send', {
      toUserId: opponent.id,
      timeControl: state.timeControl.id,
      rated: state.rated,
      color: mySide === 'w' ? 'black' : 'white',
      rematchOf: id,
    });
    if (r.error) toast(r.error, 'error');
    else {
      setRematchSent(true);
      toast(`Revanche proposta a ${opponent.username}.`, 'success');
    }
  };

  const text = over ? resultText(over.result, over.reason, mySide) : null;
  const myChange = over && mySide ? (mySide === 'w' ? over.ratingChanges.white : over.ratingChanges.black) : undefined;
  const me = mySide ? players[mySide] : null;
  const drawOfferedToMe = !over && state.drawOffer && state.drawOffer !== mySide;
  const adv = (side: Side) => Math.max(0, side === 'w' ? material.advantage : -material.advantage);

  return (
    <Screen style={{ gap: 8, paddingHorizontal: 4 }}>
      <Text style={styles.meta}>
        {state.timeControl.label} · {state.rated ? 'Ranqueada' : 'Amistosa'}
        {!state.clocksRunning && !over ? ' · relógio começa após o 1º lance de cada lado' : ''}
      </Text>
      <PlayerBar
        name={players[oppSide].username}
        avatar={players[oppSide].cosmetics?.avatar}
        subtitle={String(players[oppSide].rating)}
        captured={material.captured[orientation]}
        capturedColor={orientation}
        advantage={adv(oppSide)}
        clockMs={clockFor(oppSide)}
        active={!over && state.turn === oppSide}
        offline={opponentOffline}
      />
      <ChessBoard
        fen={state.fen}
        size={boardSize}
        orientation={orientation}
        movableColor={over ? null : mySide}
        lastMove={state.lastMove}
        onMove={onMove}
        boardStyle={look.board}
        pieceStyle={look.pieces}
      />
      <PlayerBar
        name={players[orientation].username}
        avatar={players[orientation].cosmetics?.avatar}
        subtitle={String(players[orientation].rating)}
        captured={material.captured[oppSide]}
        capturedColor={oppSide}
        advantage={adv(orientation)}
        clockMs={clockFor(orientation)}
        active={!over && state.turn === orientation}
      />

      {drawOfferedToMe && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.drawText}>{players[oppSide].username} propôs empate.</Text>
          <View style={styles.actions}>
            <Button small variant="secondary" title="Recusar" style={styles.action} onPress={() => respondDraw(false)} />
            <Button small title="Aceitar empate" style={styles.action} onPress={() => respondDraw(true)} />
          </View>
        </Card>
      )}

      <MoveList moves={state.moves} />

      {over ? (
        <View style={styles.actions}>
          <Button small variant="secondary" title="Resultado" style={styles.action} onPress={() => setShowModal(true)} />
          <Button small title="Início" style={styles.action} onPress={() => router.dismissTo('/')} />
        </View>
      ) : (
        mySide && (
          <View style={styles.actions}>
            <Button
              small
              variant="secondary"
              title={state.drawOffer === mySide ? 'Empate proposto' : 'Empate'}
              icon="½"
              style={styles.action}
              disabled={state.drawOffer === mySide || state.moves.length < 2}
              onPress={offerDraw}
            />
            <Button small variant="secondary" title={state.moves.length < 2 ? 'Cancelar' : 'Desistir'} icon="⚑" style={styles.action} onPress={resign} />
          </View>
        )
      )}

      {over && (over.result === '1-0' || over.result === '0-1') && (() => {
        const winSide: Side = over.result === '1-0' ? 'w' : 'b';
        const winner = players[winSide];
        const loser = players[winSide === 'w' ? 'b' : 'w'];
        const moveItem = get(winner.cosmetics?.move);
        return (
          <Finale
            visible={finale}
            winner={{ name: winner.username, look: winSide === 'w' ? whiteLook : blackLook }}
            loser={{ name: loser.username, look: winSide === 'w' ? blackLook : whiteLook }}
            move={moveItem?.type === 'move' ? moveItem.style.animation : 'jamal'}
            moveName={moveItem?.name ?? 'Passinho do Jamal'}
            title={text?.title}
            subtitle={text?.subtitle}
            onDone={() => {
              setFinale(false);
              setShowModal(true);
            }}
          />
        );
      })()}

      {over && text && (
        <GameOverModal
          coins={mySide && over.coinRewards ? over.coinRewards[mySide === 'w' ? 'white' : 'black'] : undefined}
          visible={showModal && !finale}
          outcome={text.outcome}
          title={text.title}
          subtitle={text.subtitle}
          ratingChange={over.rated && over.result ? myChange : undefined}
          newRating={me?.rating}
          levelUp={mySide && over.levelUp[mySide === 'w' ? 'white' : 'black'] ? me?.levelName : null}
        >
          {over.result && (
            <Button title={rematchSent ? 'Revanche proposta' : 'Revanche'} icon="↻" onPress={rematch} disabled={rematchSent} />
          )}
          <Button title="Nova partida" variant="secondary" onPress={() => router.replace('/play')} />
          <Button title="Ver tabuleiro" variant="ghost" onPress={() => setShowModal(false)} />
        </GameOverModal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  meta: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  drawText: { color: colors.text, fontWeight: '700', textAlign: 'center' },
});

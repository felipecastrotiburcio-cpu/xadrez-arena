import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { ChessBoard, type BoardMove } from '../../components/ChessBoard';
import { Icon } from '../../components/Icon';
import { Button, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useMyLook } from '../../lib/cosmetics';
import { useT } from '../../lib/i18n';
import { colors, fonts } from '../../lib/theme';
import { goalText, lessonFor, tierName } from '../../lib/trainingText';
import { getPuzzle, markSolved, puzzlesOfTier, useTraining } from '../../lib/training';

type Status = 'idle' | 'wrong' | 'good' | 'solved';

/** Um desafio de treino: lição, tabuleiro, dicas e comemoração ao resolver. */
export default function PuzzleScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const puzzle = getPuzzle(id);
  const { user } = useAuth();
  const tr = useTraining(user);
  const look = useMyLook();
  const { t, lang } = useT();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width, 640);

  const [fen, setFen] = useState(puzzle?.fen ?? new Chess().fen());
  const [step, setStep] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [hintLevel, setHintLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Recomeça ao trocar de desafio ("Próximo desafio").
  useEffect(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setStep(0);
    setLastMove(null);
    setStatus('idle');
    setHintLevel(0);
    setBusy(false);
  }, [puzzle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useMemo(() => {
    if (!puzzle) return null;
    if (mode === 'daily') return tr.today.find((p) => p.id !== puzzle.id && !tr.doneToday.has(p.id)) ?? null;
    const list = puzzlesOfTier(puzzle.tier);
    const after = list.slice(list.findIndex((p) => p.id === puzzle.id) + 1);
    return after.find((p) => !tr.solved.has(p.id)) ?? after[0] ?? null;
  }, [puzzle, mode, tr.today, tr.doneToday, tr.solved]);

  if (!puzzle) {
    return (
      <Screen>
        <Text style={styles.text}>{t('train.notFound')}</Text>
      </Screen>
    );
  }

  const lesson = lessonFor(puzzle.theme, lang);
  const expected = puzzle.moves[step];
  const hint = hintLevel === 0 || status === 'solved' || !expected ? null : { from: expected.slice(0, 2), to: hintLevel >= 2 ? expected.slice(2, 4) : expected.slice(0, 2) };

  const finish = () => {
    setStatus('solved');
    markSolved(tr.profileKey, puzzle, tr.tier);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onMove = (m: BoardMove) => {
    if (busy || status === 'solved' || !expected) return;
    const chess = new Chess(fen);
    let played;
    try {
      played = chess.move({ from: m.from, to: m.to, promotion: m.promotion ?? 'q' });
    } catch {
      return;
    }
    const uci = played.from + played.to + (played.promotion ?? '');
    const correct = uci === expected || uci.slice(0, 4) === expected.slice(0, 4) && !expected[4];
    // Nos desafios de mate, qualquer lance que dê xeque-mate também vale.
    if (!correct && !(puzzle.goal === 'mate' && chess.isCheckmate())) {
      setStatus('wrong');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setFen(chess.fen());
    setLastMove({ from: played.from, to: played.to });
    setHintLevel(0);
    if (chess.isCheckmate() || step + 1 >= puzzle.moves.length) {
      finish();
      return;
    }
    // Resposta do adversário (da solução), depois de uma pausa para ver o lance.
    setStatus('good');
    setBusy(true);
    const reply = puzzle.moves[step + 1];
    timer.current = setTimeout(() => {
      const c2 = new Chess(chess.fen());
      c2.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: (reply[4] as 'q') ?? undefined });
      setFen(c2.fen());
      setLastMove({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      setStep(step + 2);
      setBusy(false);
    }, 650);
  };

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setFen(puzzle.fen);
    setStep(0);
    setLastMove(null);
    setStatus('idle');
    setHintLevel(0);
    setBusy(false);
  };

  const message =
    status === 'wrong' ? t('train.wrong') : status === 'good' ? t('train.good') : status === 'solved' ? t('train.solved') : goalText(puzzle, lang);

  return (
    <Screen style={{ gap: 12, paddingHorizontal: 4 }}>
      <View style={styles.lesson}>
        <Text style={styles.tierChip}>{tierName(puzzle.tier, lang).name}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.text}>{lesson.text}</Text>
      </View>

      <View style={[styles.goal, status === 'wrong' && styles.goalWrong, (status === 'good' || status === 'solved') && styles.goalGood]}>
        <Icon
          name={status === 'wrong' ? 'close' : status === 'solved' ? 'starFill' : status === 'good' ? 'check' : 'targetFill'}
          size={18}
          color={status === 'wrong' ? colors.coral : status === 'idle' ? colors.accent : colors.teal}
          strokeWidth={2.6}
        />
        <Text style={styles.goalText}>{message}</Text>
      </View>

      <View style={{ marginHorizontal: -4, alignItems: 'center' }}>
        <ChessBoard
          fen={fen}
          size={boardSize}
          orientation="w"
          movableColor={status === 'solved' || busy ? null : 'w'}
          lastMove={lastMove}
          hint={hint}
          onMove={onMove}
          boardStyle={look.board}
          pieceStyle={look.pieces}
        />
      </View>

      {hintLevel > 0 && status !== 'solved' && (
        <View style={styles.hintBox}>
          <Icon name="bulbFill" size={18} color={colors.accent} />
          <Text style={styles.hintText}>{lesson.hint}</Text>
        </View>
      )}

      {status === 'solved' ? (
        <View style={{ gap: 10 }}>
          {next ? (
            <Button title={t('train.next')} iconName="play" onPress={() => router.replace({ pathname: '/train/[id]', params: { id: next.id, mode: mode ?? 'tier' } })} />
          ) : null}
          <Button title={t('train.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button small variant="secondary" title={t('aiPlay.hint')} iconName="bulbFill" style={{ flex: 1 }} onPress={() => setHintLevel((h) => Math.min(2, h + 1))} />
          <Button small variant="secondary" title={t('train.restart')} iconName="refresh" style={{ flex: 1 }} onPress={restart} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lesson: { gap: 4, paddingHorizontal: 12 },
  tierChip: { alignSelf: 'flex-start', color: colors.teal, backgroundColor: 'rgba(54, 209, 181, 0.14)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, fontFamily: fonts.black, fontSize: 11.5, overflow: 'hidden' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  goalWrong: { borderColor: 'rgba(255,127,127,0.6)', backgroundColor: 'rgba(255,127,127,0.1)' },
  goalGood: { borderColor: 'rgba(54,209,181,0.6)', backgroundColor: 'rgba(54,209,181,0.1)' },
  goalText: { flex: 1, color: colors.text, fontFamily: fonts.black, fontSize: 15 },
  hintBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginHorizontal: 8, padding: 12, borderRadius: 16, backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: 'rgba(244,185,66,0.35)' },
  hintText: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 8 },
});

import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { TimeControlPicker } from '../components/TimeControlPicker';
import { Button, Card, LevelBadge, Screen, SectionTitle } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { colors } from '../lib/theme';
import { useToast } from '../lib/toast';

export default function Play() {
  const { user } = useAuth();
  const { emit, connected, queueStatus, setQueueStatus, activeGame } = useSocket();
  const toast = useToast();
  const [timeControl, setTimeControl] = useState('5+0');
  const [searching, setSearching] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const searchingRef = useRef(false);
  searchingRef.current = searching;

  useEffect(() => {
    if (!searching) return;
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [searching, spin]);

  // Sai da fila ao deixar a tela.
  useEffect(
    () => () => {
      if (searchingRef.current) emit('queue:leave');
      setQueueStatus(null);
    },
    [emit, setQueueStatus],
  );

  // A partida começou (o SocketProvider já navegou): para de procurar.
  useEffect(() => {
    if (activeGame) setSearching(false);
  }, [activeGame]);

  if (!user) return null;

  const start = async () => {
    const r = await emit('queue:join', { timeControl });
    if (r.error) toast(r.error, 'error');
    else setSearching(true);
  };

  const cancel = async () => {
    await emit('queue:leave');
    setSearching(false);
    setQueueStatus(null);
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>{user.username}</Text>
          <LevelBadge level={user.level} name={user.levelName} />
        </View>
        <Text style={styles.rating}>{user.rating}</Text>
      </Card>

      {activeGame ? (
        <Button title="Voltar para a partida em andamento" onPress={() => router.push(`/game/${activeGame.id}`)} />
      ) : searching ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 14 }}>
          <Animated.Text style={[styles.knight, { transform: [{ rotate }] }]}>♞</Animated.Text>
          <Text style={styles.title}>Procurando adversário…</Text>
          <Text style={styles.muted}>Ritmo {timeControl} · ranqueada</Text>
          {queueStatus && (
            <Text style={styles.muted}>
              {Math.floor(queueStatus.waitedMs / 1000)}s · faixa ±{queueStatus.range} pontos ·{' '}
              {queueStatus.playersSearching} na fila
            </Text>
          )}
          <Button title="Cancelar" variant="secondary" onPress={cancel} style={{ alignSelf: 'stretch' }} />
        </Card>
      ) : (
        <>
          <SectionTitle>Ritmo de jogo</SectionTitle>
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
          <Text style={styles.muted}>
            Você será pareado com alguém de rating próximo. A faixa aumenta enquanto você espera.
          </Text>
          {connected ? (
            <Button title="Procurar partida" icon="⚔️" onPress={start} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>Conectando ao servidor…</Text>
            </View>
          )}
          <Button
            title="Desafiar um amigo"
            icon="👥"
            variant="secondary"
            onPress={() => router.push('/friends')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  rating: { color: colors.accent, fontSize: 28, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  knight: { fontSize: 64, color: colors.accent },
});

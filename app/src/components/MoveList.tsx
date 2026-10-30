import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors } from '../lib/theme';

export function MoveList({ moves }: { moves: string[] }) {
  const ref = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    ref.current?.scrollToEnd({ animated: true });
  }, [moves.length]);

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={styles.list}>
      {pairs.length === 0 && <Text style={styles.empty}>Nenhum lance ainda</Text>}
      {pairs.map(([w, b], i) => (
        <View key={i} style={styles.pair}>
          <Text style={styles.num}>{i + 1}.</Text>
          <Text style={styles.move}>{w}</Text>
          {b && <Text style={styles.move}>{b}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8 },
  pair: { flexDirection: 'row', gap: 5, marginRight: 12 },
  num: { color: colors.textMuted, fontSize: 14 },
  move: { color: colors.text, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 14 },
});

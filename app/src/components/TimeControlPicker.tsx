import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, fonts } from '../lib/theme';
import { timeControlLabel, useT } from '../lib/i18n';
import { TIME_CONTROLS } from '../lib/timeControls';

export function TimeControlPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  useT(); // redesenha ao trocar de idioma
  return (
    <View style={styles.grid}>
      {TIME_CONTROLS.map((tc) => {
        const active = tc.id === value;
        return (
          <Pressable
            key={tc.id}
            onPress={() => onChange(tc.id)}
            style={[styles.option, active && styles.active]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.id, active && { color: colors.accent }]}>{tc.id}</Text>
            <Text style={styles.label}>{timeControlLabel(tc)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          testID={`seg-${o.value}`}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, o.value === value && { color: colors.accentText }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  id: { color: colors.text, fontSize: 22, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  label: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.text },
  segmentText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 14 },
});

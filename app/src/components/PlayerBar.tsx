import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMyLook } from '../lib/cosmetics';
import { useT } from '../lib/i18n';
import { ChessPiece, type PieceType } from './ChessPiece';
import { colors } from '../lib/theme';
import { formatClock } from '../lib/timeControls';
import { Avatar } from './ui';

interface Props {
  name: string;
  subtitle?: string;
  /** Peças do adversário que este jogador capturou. */
  captured: string[];
  /** Cor das peças capturadas. */
  capturedColor: 'w' | 'b';
  advantage: number;
  clockMs?: number;
  active: boolean;
  thinking?: boolean;
  offline?: boolean;
  avatar?: string;
}

export function PlayerBar({ name, subtitle, captured, capturedColor, advantage, clockMs, active, thinking, offline, avatar }: Props) {
  const { pieces } = useMyLook();
  const { t } = useT();
  const low = clockMs !== undefined && clockMs < 20_000;
  return (
    <View style={styles.bar}>
      <Avatar name={name} size={36} icon={avatar} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {thinking && <ActivityIndicator size="small" color={colors.accent} />}
          {offline && <Text style={styles.offline}>{t('player.offline')}</Text>}
        </View>
        <View style={styles.capturedRow}>
          {captured.map((p, i) => (
            <View key={i} style={{ marginRight: -7 }}>
              <ChessPiece type={p as PieceType} color={capturedColor} style={pieces} size={20} />
            </View>
          ))}
          {advantage > 0 && <Text style={styles.captured}>  +{advantage}</Text>}
        </View>
      </View>
      {clockMs !== undefined && (
        <View style={[styles.clock, active && styles.clockActive, active && low && styles.clockLow]}>
          <Text style={[styles.clockText, active && { color: colors.accentText }]}>{formatClock(clockMs)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  offline: { color: colors.danger, fontSize: 12 },
  captured: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  capturedRow: { flexDirection: 'row', alignItems: 'center', minHeight: 20 },
  clock: {
    minWidth: 86,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  clockActive: { backgroundColor: colors.accent },
  clockLow: { backgroundColor: colors.danger },
  clockText: { color: colors.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { timeControlLabel, translateServerText, useT } from '../lib/i18n';
import { useSocket } from '../lib/socket';
import { colors, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
import type { Invite } from '../lib/types';
import { Avatar, Button } from './ui';

/** Banner global com os convites de partida recebidos. */
export function InviteBanner() {
  const { user } = useAuth();
  const { invites, activeGame } = useSocket();
  const insets = useSafeAreaInsets();
  const incoming = invites.filter((i) => i.to.id === user?.id);
  if (!incoming.length || activeGame) return null;
  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      {incoming.slice(-2).map((inv) => (
        <InviteCard key={inv.id} invite={inv} />
      ))}
    </View>
  );
}

function InviteCard({ invite }: { invite: Invite }) {
  const { emit } = useSocket();
  const toast = useToast();
  const { t } = useT();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [left, setLeft] = useState(Math.max(0, invite.expiresAt - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, invite.expiresAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [invite.expiresAt]);

  const respond = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    const r = await emit(accept ? 'invite:accept' : 'invite:decline', { inviteId: invite.id });
    setBusy(null);
    if (r.error) toast(translateServerText(r.error), 'error');
  };

  const colorText =
    invite.color === 'random' ? t('invite.randomColors') : invite.color === 'white' ? t('invite.youBlack') : t('invite.youWhite');

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Avatar name={invite.from.username} size={38} icon={invite.from.cosmetics?.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {t('invite.challengedYou', { name: invite.from.username, rating: invite.from.rating })}
          </Text>
          <Text style={styles.sub}>
            {timeControlLabel(invite.timeControl)} · {invite.rated ? t('common.ratedLower') : t('common.casualLower')} · {colorText} ·{' '}
            {Math.ceil(left / 1000)}s
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          small
          title={t('common.decline')}
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy === 'decline'}
          onPress={() => respond(false)}
        />
        <Button small title={t('common.accept')} style={{ flex: 1 }} loading={busy === 'accept'} onPress={() => respond(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 12, right: 12, gap: 8, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sub: { color: colors.textMuted, fontSize: 13 },
});

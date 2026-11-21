import { useRef, useState } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Segmented } from '../components/TimeControlPicker';
import { Button, Card, Screen, SectionTitle } from '../components/ui';
import { api, getServerUrl, setServerUrl, usingSupabase } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { translateServerText, useT, type LangPref } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { colors, radius, fonts } from '../lib/theme';
import { useToast } from '../lib/toast';
import { Flag, countryName } from '../components/Flag';
import { deviceCountry } from '../lib/supabase';
import type { PrivateUser } from '../lib/types';
import { isSoundEnabled, playSound, setSoundEnabled } from '../lib/sound';

export default function Settings() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { t, pref, setLang } = useT();
  const [url, setUrl] = useState(getServerUrl());
  const [sound, setSound] = useState(isSoundEnabled());

  return (
    <Screen>
      <SectionTitle>{t('settings.sounds')}</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={[styles.text, { flex: 1 }]}>{t('settings.soundsDesc')}</Text>
          <Switch
            value={sound}
            onValueChange={async (on) => {
              setSound(on);
              await setSoundEnabled(on);
              if (on) playSound('move');
            }}
            trackColor={{ true: colors.accent, false: colors.raised }}
            thumbColor={colors.text}
            // web: cor da bolinha ligada
            {...({ activeThumbColor: colors.text } as object)}
          />
        </View>
      </Card>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <Segmented<LangPref>
        value={pref}
        onChange={setLang}
        options={[
          { value: 'auto', label: t('settings.langAuto') },
          { value: 'pt', label: 'Português' },
          { value: 'en', label: 'English' },
        ]}
      />

      <SectionTitle>{t('settings.server')}</SectionTitle>
      <Card>
        <Text style={styles.muted}>{t('settings.serverDesc')}</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button
          title={t('settings.save')}
          onPress={async () => {
            try {
              await setServerUrl(url);
              setUrl(getServerUrl());
              toast(t('settings.serverUpdated'), 'success');
            } catch (e) {
              toast(translateServerText((e as Error).message), 'error');
            }
          }}
        />
      </Card>

      {user && (
        <>
          {usingSupabase() && <CountryCard />}
          <SectionTitle>{t('settings.account')}</SectionTitle>
          <Card>
            <Text style={styles.text}>{t('settings.loggedInAs', { name: user.username })}</Text>
            <Button
              title={t('settings.logoutAll')}
              variant="secondary"
              onPress={() =>
                confirmAction(t('settings.logoutAllQ'), t('settings.logoutAllBody'), async () => {
                  try {
                    await api('/auth/logout-all', { body: {} });
                  } finally {
                    await logout();
                    router.dismissAll();
                  }
                })
              }
            />
            <Button
              title={t('settings.logout')}
              variant="danger"
              onPress={async () => {
                await logout();
                router.dismissAll();
              }}
            />
          </Card>
        </>
      )}

      <DeveloperMode />
    </Screen>
  );
}

const DEV_TAPS = 7;

/**
 * Modo desenvolvedor, escondido: aparece depois de tocar 7 vezes na versão do app (como no
 * Android). Ativar pede a senha, conferida pelo servidor (ou pelo aparelho, nas contas locais).
 */
function DeveloperMode() {
  const { user, setUser } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const [taps, setTaps] = useState(0);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const visible = taps >= DEV_TAPS || !!user?.devMode;

  const tap = () => {
    const now = Date.now();
    // toques espaçados demais recomeçam a contagem
    const n = now - last.current > 1500 ? 1 : taps + 1;
    last.current = now;
    setTaps(n);
    if (n >= 3 && n < DEV_TAPS) toast(t('settings.devTapsLeft', { n: DEV_TAPS - n }), 'info');
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      const r = await api<{ user: PrivateUser }>(on ? '/dev/unlock' : '/dev/lock', { body: on ? { password } : {} });
      setUser(r.user);
      setPassword('');
      toast(t(on ? 'settings.devActivated' : 'settings.devDeactivated'), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {visible && (
        <>
          <SectionTitle>{t('settings.dev')}</SectionTitle>
          <Card>
            {!user ? (
              <Text style={styles.muted}>{t('settings.devLogin')}</Text>
            ) : user.devMode ? (
              <>
                <Text style={styles.text}>{t('settings.devOn')}</Text>
                <Button title={t('settings.devDeactivate')} variant="secondary" loading={busy} onPress={() => toggle(false)} />
              </>
            ) : (
              <>
                <Text style={styles.muted}>{t('settings.devDesc')}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('settings.devPassword')}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => password && toggle(true)}
                  testID="dev-password"
                />
                <Button title={t('settings.devActivate')} iconName="wrench" loading={busy} disabled={!password} onPress={() => toggle(true)} />
              </>
            )}
          </Card>
        </>
      )}
      <Pressable onPress={tap} accessibilityRole="text" testID="app-version" style={styles.version}>
        <Text style={styles.muted}>{t('settings.version', { v: Constants.expoConfig?.version ?? '?' })}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  version: { alignItems: 'center', paddingVertical: 18 },
  muted: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  text: { color: colors.text, fontFamily: fonts.regular, fontSize: 16 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

/** País da bandeira (só no modo online com Supabase). */
function CountryCard() {
  const { user, setUser } = useAuth();
  const { t, locale } = useT();
  const toast = useToast();
  const [code, setCode] = useState(user?.country ?? '');
  const save = async (value: string) => {
    const c = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) {
      toast(t('settings.countryInvalid'), 'error');
      return;
    }
    try {
      const r = await api<{ user: PrivateUser }>('/me/country', { body: { country: c } });
      setUser(r.user);
      setCode(c);
      toast(t('settings.countrySaved'), 'success');
    } catch (e) {
      toast(translateServerText((e as Error).message), 'error');
    }
  };
  return (
    <>
      <SectionTitle>{t('settings.country')}</SectionTitle>
      <Card>
        <Text style={styles.text}>
          <Flag code={user?.country} size={20} /> {user?.country ? countryName(user.country, locale) : '—'}
        </Text>
        <Text style={styles.muted}>{t('settings.countryDesc')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={2}
          placeholder="BR"
          placeholderTextColor={colors.textMuted}
        />
        <Button title={t('settings.save')} onPress={() => save(code)} />
        {deviceCountry() && deviceCountry() !== user?.country ? (
          <Button
            variant="secondary"
            title={`${t('settings.countryDevice')} (${deviceCountry()})`}
            onPress={() => save(deviceCountry()!)}
          />
        ) : null}
      </Card>
    </>
  );
}

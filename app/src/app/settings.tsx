import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Segmented } from '../components/TimeControlPicker';
import { Button, Card, Screen, SectionTitle } from '../components/ui';
import { api, getServerUrl, setServerUrl } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { translateServerText, useT, type LangPref } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
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
            trackColor={{ true: colors.primary, false: colors.border }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muted: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text, fontSize: 16 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

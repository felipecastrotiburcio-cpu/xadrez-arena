import type React from 'react';
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { Segmented } from '../components/TimeControlPicker';
import { Button, Card, Screen } from '../components/ui';
import { isLocalMode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { translateServerText, useT } from '../lib/i18n';
import { colors, radius } from '../lib/theme';

export default function Login() {
  const { login, register } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? translateServerText(e.message) : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    // iOS: a rolagem da tela se ajusta ao teclado (Screen usa automaticallyAdjustKeyboardInsets);
    // Android: o sistema redimensiona a janela. O KeyboardAvoidingView fica só como reforço no Android.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'height' : undefined} enabled={Platform.OS === 'android'}>
      <Screen>
        <Text style={styles.title}>{t('login.welcome')}</Text>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { value: 'login', label: t('common.login') },
            { value: 'register', label: t('common.createAccount') },
          ]}
        />
        {isLocalMode() && (
          <Card style={{ borderColor: colors.primary }}>
            <Text style={styles.notice}>
              {t('login.noticeA')}
              <Text style={{ fontWeight: '800' }}>{t('login.noticeBold')}</Text>
              {t('login.noticeB')}
            </Text>
            <Text style={styles.noticeMuted}>{t('login.noticeMuted')}</Text>
          </Card>
        )}
        <Card>
          <Text style={styles.label}>{t('login.username')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('login.usernamePh')}
            testID="login-username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            textContentType="username"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>{t('login.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('login.passwordPh')}
            testID="login-password"
            ref={passwordRef}
            returnKeyType="go"
            textContentType={mode === 'register' ? 'newPassword' : 'password'}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={mode === 'login' ? t('common.login') : t('common.createAccount')}
            onPress={submit}
            loading={loading}
            disabled={!username || !password}
            testID="login-submit"
          />
        </Card>
        {mode === 'register' && (
          <Text style={styles.hint}>{t('login.registerHint')}</Text>
        )}
        <Button title={t('login.configureServer')} variant="ghost" small onPress={() => router.push('/settings')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center', marginVertical: 8 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
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
  error: { color: colors.danger, fontSize: 14 },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  notice: { color: colors.text, fontSize: 15, lineHeight: 21 },
  noticeMuted: { color: colors.textMuted, fontSize: 13 },
});

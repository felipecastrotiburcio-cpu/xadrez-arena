import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { Segmented } from '../components/TimeControlPicker';
import { Button, Card, Screen } from '../components/ui';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../lib/theme';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Text style={styles.title}>♞ Bem-vindo à Arena</Text>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { value: 'login', label: 'Entrar' },
            { value: 'register', label: 'Criar conta' },
          ]}
        />
        <Card>
          <Text style={styles.label}>Nome de usuário</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ex: rei_do_xadrez"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="mínimo 8 caracteres"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={mode === 'login' ? 'Entrar' : 'Criar conta'}
            onPress={submit}
            loading={loading}
            disabled={!username || !password}
          />
        </Card>
        {mode === 'register' && (
          <Text style={styles.hint}>
            Você começa com 1000 pontos (Nível 3 · Amador). Vença partidas ranqueadas para subir até Grande Mestre!
          </Text>
        )}
        <Button title="Configurar servidor" variant="ghost" small onPress={() => router.push('/settings')} />
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
});

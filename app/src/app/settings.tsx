import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Screen, SectionTitle } from '../components/ui';
import { api, getServerUrl, setServerUrl } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { useAuth } from '../lib/auth';
import { colors, radius } from '../lib/theme';
import { useToast } from '../lib/toast';
import { isSoundEnabled, playSound, setSoundEnabled } from '../lib/sound';

export default function Settings() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState(getServerUrl());
  const [sound, setSound] = useState(isSoundEnabled());

  return (
    <Screen>
      <SectionTitle>Sons</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={[styles.text, { flex: 1 }]}>Sons das jogadas (lance, captura, xeque e xeque-mate)</Text>
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

      <SectionTitle>Servidor</SectionTitle>
      <Card>
        <Text style={styles.muted}>
          Endereço do servidor de partidas online. No celular, use o IP do computador que roda o servidor (ex:
          http://192.168.0.10:3001). Versões publicadas exigem https://.
        </Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button
          title="Salvar"
          onPress={async () => {
            try {
              await setServerUrl(url);
              setUrl(getServerUrl());
              toast('Servidor atualizado. Entre novamente se necessário.', 'success');
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        />
      </Card>

      {user && (
        <>
          <SectionTitle>Conta</SectionTitle>
          <Card>
            <Text style={styles.text}>Conectado como {user.username}</Text>
            <Button
              title="Sair de todos os aparelhos"
              variant="secondary"
              onPress={() =>
                confirmAction('Sair de todos os aparelhos?', 'Todas as sessões abertas serão encerradas, inclusive esta.', async () => {
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
              title="Sair da conta"
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

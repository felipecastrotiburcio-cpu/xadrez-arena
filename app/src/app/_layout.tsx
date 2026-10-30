import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InviteBanner } from '../components/InviteBanner';
import { AuthProvider } from '../lib/auth';
import { CosmeticsProvider } from '../lib/cosmetics';
import { SocketProvider } from '../lib/socket';
import { colors, fonts } from '../lib/theme';
import { ToastProvider } from '../lib/toast';

// Garante que a tela inicial fique por baixo ao abrir um link direto (ex: /login).
export const unstable_settings = { anchor: 'index' };

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  // Sem a fonte o app continua funcionando com a fonte do sistema.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <ToastProvider>
          <AuthProvider>
            <CosmeticsProvider>
            <SocketProvider>
              <View style={{ flex: 1, backgroundColor: colors.bg }}>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: colors.bg },
                    headerTintColor: colors.text,
                    headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20 },
                    headerShadowVisible: false,
                    contentStyle: { backgroundColor: colors.bg },
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ title: 'Entrar', presentation: 'modal' }} />
                  <Stack.Screen name="ai/index" options={{ title: 'Jogar contra a IA' }} />
                  <Stack.Screen name="ai/play" options={{ title: 'Partida contra IA' }} />
                  <Stack.Screen name="play" options={{ title: 'Partida online' }} />
                  <Stack.Screen name="game/[id]" options={{ title: 'Partida', gestureEnabled: false }} />
                  <Stack.Screen name="friends" options={{ title: 'Amigos' }} />
                  <Stack.Screen name="leaderboard" options={{ title: 'Ranking' }} />
                  <Stack.Screen name="profile/[id]" options={{ title: 'Perfil' }} />
                  <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
                  <Stack.Screen name="shop" options={{ title: 'Loja' }} />
                  <Stack.Screen name="notifications" options={{ title: 'Notificações' }} />
                </Stack>
                <InviteBanner />
              </View>
            </SocketProvider>
            </CosmeticsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

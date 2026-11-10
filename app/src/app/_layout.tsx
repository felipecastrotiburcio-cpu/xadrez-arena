import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InviteBanner } from '../components/InviteBanner';
import { AuthProvider } from '../lib/auth';
import { CosmeticsProvider } from '../lib/cosmetics';
import { I18nProvider, useT } from '../lib/i18n';
import { SocketProvider } from '../lib/socket';
import { colors, fonts } from '../lib/theme';
import { ToastProvider } from '../lib/toast';

// Garante que a tela inicial fique por baixo ao abrir um link direto (ex: /login).
export const unstable_settings = { anchor: 'index' };

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text },
};

const blank = <View style={{ flex: 1, backgroundColor: colors.bg }} />;

export default function RootLayout() {
  // O idioma envolve tudo (inclusive os toasts).
  return (
    <I18nProvider fallback={blank}>
      <AppShell />
    </I18nProvider>
  );
}

function AppShell() {
  const { t } = useT();
  const [fontsLoaded, fontError] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  // Sem a fonte o app continua funcionando com a fonte do sistema.
  if (!fontsLoaded && !fontError) return blank;
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
                  <Stack.Screen name="index" options={{ headerShown: false, title: t('nav.home') }} />
                  <Stack.Screen name="login" options={{ title: t('nav.login'), presentation: 'modal' }} />
                  <Stack.Screen name="ai/index" options={{ title: t('nav.ai') }} />
                  <Stack.Screen name="ai/play" options={{ title: t('nav.aiPlay') }} />
                  <Stack.Screen name="play" options={{ title: t('nav.play') }} />
                  <Stack.Screen name="game/[id]" options={{ title: t('nav.game'), gestureEnabled: false }} />
                  <Stack.Screen name="friends" options={{ title: t('nav.friends') }} />
                  <Stack.Screen name="leaderboard" options={{ title: t('nav.leaderboard') }} />
                  <Stack.Screen name="profile/[id]" options={{ title: t('nav.profile') }} />
                  <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
                  <Stack.Screen name="shop" options={{ title: t('nav.shop') }} />
                  <Stack.Screen name="notifications" options={{ title: t('nav.notifications') }} />
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

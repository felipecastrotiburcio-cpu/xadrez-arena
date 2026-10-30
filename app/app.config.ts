import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * APP_ENV=production (use no perfil de build do EAS) remove as exceções de
 * tráfego HTTP: iOS (ATS) e Android passam a bloquear qualquer conexão sem TLS.
 * Em desenvolvimento HTTP é permitido para falar com o servidor na rede local.
 */
const isProd = process.env.APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Xadrez Arena',
  slug: 'xadrez-arena',
  scheme: 'xadrezarena',
  version: '1.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#110d2e',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.xadrezarena',
    ...(isProd ? {} : { infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } }),
  },
  android: {
    package: 'app.xadrezarena',
    // Cada compilação no GitHub Actions recebe um número maior, para o Android aceitar atualizar por cima.
    versionCode: Number(process.env.APP_VERSION_CODE ?? 1),
    // Só o necessário: internet (modo online) e vibração (toque ao mover peças).
    permissions: ['INTERNET', 'VIBRATE'],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    adaptiveIcon: {
      backgroundColor: '#8b5cff',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 220, resizeMode: 'contain', backgroundColor: '#110d2e' },
    ],
    './plugins/withReleaseSigning',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: !isProd,
          // O otimizador (R8) do build de release apaga construtores usados por reflexão.
          // O GLView do expo-gl (área 3D) herda de TextureView e não é coberto pelas regras da Expo.
          extraProguardRules: [
            '-keepclassmembers class * extends android.view.View {',
            '  public <init>(android.content.Context, expo.modules.kotlin.AppContext);',
            '}',
            '-keep class expo.modules.gl.** { *; }',
          ].join('\n'),
        },
      },
    ],
  ],
});

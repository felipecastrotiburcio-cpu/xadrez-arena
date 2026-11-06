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
    bundleIdentifier: 'app.xadrezarena',
    // Cada compilação no GitHub Actions recebe um número maior (exigência do TestFlight/App Store).
    buildNumber: process.env.APP_VERSION_CODE ?? '1',
    // iPad: roda em tela cheia, só em pé (a App Store exige isso para apps só em retrato).
    supportsTablet: true,
    requireFullScreen: true,
    infoPlist: {
      // Só usa HTTPS padrão do sistema: isento da declaração de criptografia.
      ITSAppUsesNonExemptEncryption: false,
      // Em desenvolvimento, permite HTTP para falar com o servidor na rede local.
      ...(isProd ? {} : { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } }),
    },
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
      // Trazidas pelo expo-secure-store para login por digital, recurso que o app não usa.
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      // O app só toca sons curtos; não grava áudio.
      'android.permission.RECORD_AUDIO',
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
    // Sem Face ID / digital: o app só guarda o login de forma segura.
    ['expo-secure-store', { faceIDPermission: false }],
    // Sons das jogadas: sem microfone e sem tocar em segundo plano (Android e iOS).
    [
      'expo-audio',
      { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false },
    ],
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

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
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#14161b',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.xadrezarena',
    ...(isProd ? {} : { infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } }),
  },
  android: {
    package: 'app.xadrezarena',
    adaptiveIcon: {
      backgroundColor: '#14161b',
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
    ['expo-build-properties', { android: { usesCleartextTraffic: !isProd } }],
  ],
});

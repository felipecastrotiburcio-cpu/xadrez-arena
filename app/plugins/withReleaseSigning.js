/**
 * Assina o APK/AAB de release com uma chave própria quando as variáveis
 * XA_UPLOAD_STORE_FILE, XA_UPLOAD_STORE_PASSWORD, XA_UPLOAD_KEY_ALIAS e
 * XA_UPLOAD_KEY_PASSWORD estão definidas (no GitHub Actions vêm dos Secrets).
 * Sem elas, mantém a assinatura padrão do modelo (chave de teste do React Native).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (System.getenv('XA_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('XA_UPLOAD_STORE_FILE'))
                storePassword System.getenv('XA_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('XA_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('XA_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes("System.getenv('XA_UPLOAD_STORE_FILE')")) {
      // Adiciona a configuração "release" logo após a "debug" dentro de signingConfigs.
      gradle = gradle.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${SIGNING}`);
      // O buildType release passa a usar a chave própria quando ela existir.
      gradle = gradle.replace(
        /(release\s*\{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
        "$1signingConfig System.getenv('XA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};

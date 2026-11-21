// Desliga o GWP-ASan (detector de memória por amostragem que o Android 14 liga sozinho em
// algumas aberturas do app). Ao registrar a pilha de uma liberação feita dentro do Hermes, ele
// lê fora da pilha e derruba o app (SIGSEGV em android_unsafe_frame_pointer_chase), visto no
// teste do emulador. Não muda nada no funcionamento normal do app.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoGwpAsan(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:gwpAsanMode'] = 'never';
    return cfg;
  });
};

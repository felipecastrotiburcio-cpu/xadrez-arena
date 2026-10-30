import http from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';

let config;
try {
  config = loadConfig();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`✖ Configuração inválida: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

const { server, close } = createApp({ dbFile: config.dbFile, config });
const scheme = config.tls ? 'https' : 'http';

server.listen(config.port, config.host, () => {
  console.log(`♟  Servidor de xadrez rodando em ${scheme}://localhost:${config.port}`);
  if (config.isProd && !config.tls && !config.trustProxy) {
    console.warn('⚠  Produção sem TLS e sem TRUST_PROXY: coloque um proxy HTTPS (Caddy/Nginx) na frente.');
  }
});

// TLS direto no Node: uma porta HTTP extra só para redirecionar para HTTPS.
let redirect: http.Server | null = null;
if (config.tls && config.httpRedirectPort) {
  const httpsPort = config.port;
  redirect = http
    .createServer((req, res) => {
      const host = config.publicHost ?? (req.headers.host ?? 'localhost').split(':')[0];
      const port = httpsPort === 443 ? '' : `:${httpsPort}`;
      res.writeHead(308, { Location: `https://${host}${port}${req.url ?? '/'}` }).end();
    })
    .listen(config.httpRedirectPort, config.host);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    redirect?.close();
    await close();
    process.exit(0);
  });
}

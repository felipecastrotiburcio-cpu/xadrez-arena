import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Configuração do servidor a partir de variáveis de ambiente (veja .env.example).
 *
 * Segurança:
 * - Em produção o servidor NÃO inicia sem um JWT_SECRET forte (>= 32 bytes).
 * - Em desenvolvimento um segredo aleatório é gerado e salvo em data/.jwt-secret
 *   (permissão 600), assim nenhum segredo fica fixo no código.
 * - HTTPS: TLS direto (TLS_CERT_FILE/TLS_KEY_FILE) ou atrás de proxy reverso
 *   (TRUST_PROXY=1, ex: Caddy/Nginx). Em produção HTTP é redirecionado para HTTPS.
 */

// Carrega .env se existir (Node >= 21.7).
try {
  process.loadEnvFile?.(process.env.ENV_FILE ?? '.env');
} catch {
  // sem .env: usa só as variáveis do ambiente
}

export class ConfigError extends Error {}

const MIN_SECRET_BYTES = 32;

export function resolveJwtSecret(env: NodeJS.ProcessEnv, secretFile: string | null): string {
  const isProd = env.NODE_ENV === 'production';
  const fromEnv = env.JWT_SECRET?.trim();
  if (fromEnv) {
    if (Buffer.byteLength(fromEnv) < MIN_SECRET_BYTES) {
      throw new ConfigError(
        `JWT_SECRET muito curto (mínimo ${MIN_SECRET_BYTES} caracteres). Gere um com: openssl rand -base64 48`,
      );
    }
    if (isProd && /troque|change|secret|dev/i.test(fromEnv)) {
      throw new ConfigError('JWT_SECRET parece um valor de exemplo. Gere um com: openssl rand -base64 48');
    }
    return fromEnv;
  }
  if (isProd) {
    throw new ConfigError('JWT_SECRET é obrigatório em produção. Gere um com: openssl rand -base64 48');
  }
  // Testes: segredo efêmero em memória.
  if (!secretFile) return crypto.randomBytes(48).toString('base64');
  // Desenvolvimento: segredo aleatório persistido localmente.
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, 'utf8').trim();
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  const secret = crypto.randomBytes(48).toString('base64');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

function list(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const dataDir = path.resolve(env.DATA_DIR ?? 'data');
  const tlsCert = env.TLS_CERT_FILE;
  const tlsKey = env.TLS_KEY_FILE;
  if (!!tlsCert !== !!tlsKey) throw new ConfigError('Defina TLS_CERT_FILE e TLS_KEY_FILE juntos.');

  const corsOrigins = list(env.CORS_ORIGINS);
  const trustProxy = env.TRUST_PROXY ? Number(env.TRUST_PROXY) || 1 : 0;
  const forceHttps = env.FORCE_HTTPS ? env.FORCE_HTTPS === 'true' : isProd;
  if (forceHttps && !tlsCert && !trustProxy) {
    throw new ConfigError(
      'HTTPS obrigatório: configure TLS_CERT_FILE/TLS_KEY_FILE ou rode atrás de um proxy HTTPS com TRUST_PROXY=1.',
    );
  }
  return {
    isProd,
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? '0.0.0.0',
    dbFile: env.DB_FILE ?? path.join(dataDir, 'db.json'),
    jwt: {
      secret: resolveJwtSecret(env, isTest ? null : path.join(dataDir, '.jwt-secret')),
      expiresIn: (env.JWT_EXPIRES_IN ?? '7d') as `${number}d`,
      issuer: env.JWT_ISSUER ?? 'xadrez-arena',
      audience: env.JWT_AUDIENCE ?? 'xadrez-arena-app',
    },
    tls: tlsCert && tlsKey ? { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) } : null,
    /** Porta HTTP que só redireciona para HTTPS (quando o TLS é feito pelo próprio Node). */
    httpRedirectPort: env.HTTP_REDIRECT_PORT ? Number(env.HTTP_REDIRECT_PORT) : null,
    /** Número de proxies confiáveis à frente do servidor (para ler X-Forwarded-Proto/For). */
    trustProxy,
    forceHttps,
    /** Domínio público usado nos redirecionamentos (evita confiar no cabeçalho Host). */
    publicHost: env.PUBLIC_HOST ?? null,
    /** Apps nativos não enviam Origin; a lista vale para navegadores (versão web). */
    corsOrigins: corsOrigins.length ? corsOrigins : isProd ? [] : ['*'],
  };
}

export type Config = ReturnType<typeof loadConfig>;

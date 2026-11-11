// Contexto compartido por toda la aplicación (config, base de datos, correo, etc.).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createMailer } from './lib/mail.js';
import { createHub } from './lib/sse.js';
import { createLimiter } from './lib/ratelimit.js';
import { createPaypal } from './lib/paypal.js';
import { loadKeys } from './lib/cert.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createContext(config, overrides = {}) {
  const log = config.quiet
    ? { info() {}, warn() {}, error() {} }
    : { info: (m) => console.log(m), warn: (m) => console.warn(m), error: (m) => console.error(m) };
  const keysFile = config.keysFile || path.join(ROOT, 'certs', 'keys.json');
  const ctx = {
    config,
    log,
    db: openDb(config.dbFile),
    hub: createHub(),
    limiter: createLimiter(),
    now: () => Date.now(),
    keys: () => loadKeys(keysFile), // historial público de llaves de firma
    ...overrides,
  };
  ctx.mailer ??= createMailer(config, log);
  ctx.paypal ??= createPaypal(config);
  return ctx;
}

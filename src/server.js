// Punto de entrada: `npm start`.
import fs from 'node:fs';
import { loadConfig, launchIssues } from './config.js';
import { createContext } from './context.js';
import { createApp, startJobs } from './app.js';

const config = loadConfig();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const ctx = createContext(config);
const app = createApp(ctx);
const stopJobs = startJobs(ctx);

const server = app.listen(config.port, () => {
  ctx.log.info(`Galería en ${config.baseUrl} (puerto ${config.port}, ${config.production ? 'producción' : 'desarrollo'})`);
  const issues = launchIssues(config);
  if (issues.length) {
    ctx.log.warn(`\nPendientes antes de lanzar (${issues.length}):`);
    for (const i of issues) ctx.log.warn(`  - ${i}`);
    ctx.log.warn('');
  }
});

// Apagado limpio: deja de aceptar conexiones, termina envíos de correo y cierra la base.
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  ctx.log.info(`${signal}: cerrando…`);
  stopJobs();
  ctx.hub.close();
  server.close();
  server.closeIdleConnections?.();
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await ctx.mailer.idle().catch(() => {});
  ctx.db.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

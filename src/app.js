// Ensambla la aplicación Express.
import express from 'express';
import path from 'node:path';
import { ROOT } from './context.js';
import { securityHeaders, originCheck, sessionLoader } from './http.js';
import { AppError } from './lib/util.js';
import { errorPage } from './views/layout.js';
import { publicRoutes } from './routes/public.js';
import { authRoutes } from './routes/auth.js';
import { accountRoutes } from './routes/account.js';
import { orderRoutes } from './routes/orders.js';
import { auctionRoutes } from './routes/auctions.js';
import { adminRoutes } from './routes/admin.js';
import { tick as auctionTick } from './services/auctions.js';
import { expireDue, scrubOldPii } from './services/orders.js';

export function createApp(ctx) {
  const { config } = ctx;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Registro de peticiones sin datos personales (ni IP ni parámetros de la URL).
  app.use((req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/healthz') return;
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      ctx.log.info(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  });

  app.use(securityHeaders(config));

  app.get('/healthz', (req, res) => {
    ctx.db.prepare('SELECT 1').get();
    res.type('text').send('ok');
  });

  const staticOpts = { index: false, dotfiles: 'ignore', maxAge: config.production ? '1h' : 0 };
  app.use('/css', express.static(path.join(ROOT, 'public/css'), staticOpts));
  app.use('/js', express.static(path.join(ROOT, 'public/js'), staticOpts));
  app.use('/fonts', express.static(path.join(ROOT, 'public/fonts'), { ...staticOpts, maxAge: '30d' }));
  app.get('/favicon.svg', (req, res) => res.sendFile(path.join(ROOT, 'public/favicon.svg'), { maxAge: '7d' }));
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'));
  // Fotos subidas: el nombre de archivo es único, así que pueden guardarse en caché para siempre.
  app.use('/media', express.static(config.uploadsDir, { index: false, dotfiles: 'ignore', maxAge: '365d', immutable: true }));
  app.get('/robots.txt', (req, res) => {
    res.type('text').send('User-agent: *\nDisallow: /admin\nDisallow: /cuenta\nDisallow: /pedidos\nDisallow: /comprar\n');
  });

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '200kb' }));
  app.use(originCheck(config));
  app.use(sessionLoader(ctx));

  app.use(publicRoutes(ctx));
  app.use(authRoutes(ctx));
  app.use(accountRoutes(ctx));
  app.use(orderRoutes(ctx));
  app.use(auctionRoutes(ctx));
  app.use('/admin', adminRoutes(ctx));

  app.use((req, res) => {
    res.status(404).send(String(errorPage(req, 404, 'No encontrado', 'Esta página no existe o cambió de lugar.')));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return res.end();
    const wantsJson = req.accepts(['html', 'json']) === 'json';
    if (err instanceof AppError) {
      res.status(err.status);
      return wantsJson ? res.json({ error: err.message, code: err.code, ...(err.data || {}) })
        : res.send(String(errorPage(req, err.status, 'No se pudo completar', err.message)));
    }
    if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).send(String(errorPage(req, 413, 'Archivo demasiado grande', 'Lo que intentas enviar supera el tamaño permitido.')));
    }
    if (err?.status >= 400 && err?.status < 500) {
      return res.status(err.status).send(String(errorPage(req, err.status, 'Solicitud no válida', 'No pudimos procesar la solicitud.')));
    }
    ctx.log.error(`[error] ${req.method} ${req.path}: ${err?.stack || err}`);
    res.status(500);
    return wantsJson ? res.json({ error: 'Error interno.' })
      : res.send(String(errorPage(req, 500, 'Algo salió mal', 'Ocurrió un error de nuestro lado. Inténtalo de nuevo en unos minutos.')));
  });

  return app;
}

// Tareas periódicas: reloj de subastas, vencimiento de pedidos y limpieza por conservación.
export function startJobs(ctx) {
  const safe = (name, fn) => () => {
    try { fn(); } catch (err) { ctx.log.error(`[tarea ${name}] ${err.stack || err}`); }
  };
  const housekeeping = safe('limpieza', () => {
    const now = ctx.now();
    ctx.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    ctx.db.prepare('DELETE FROM tokens WHERE expires_at < ?').run(now - 24 * 3600_000);
    const cutoff = now - ctx.config.retention.securityLogMs;
    ctx.db.prepare('UPDATE audit_log SET ip = NULL WHERE ip IS NOT NULL AND at < ?').run(cutoff);
    ctx.db.prepare('UPDATE bids SET ip = NULL WHERE ip IS NOT NULL AND created_at < ?').run(cutoff);
    scrubOldPii(ctx);
    const YEAR = 365 * 24 * 3600_000;
    // Cuentas que nunca confirmaron su correo (y no tienen actividad): fuera a los 30 días.
    const stale = ctx.db.prepare(`SELECT id FROM users u WHERE email_verified_at IS NULL AND deleted_at IS NULL AND role = 'customer'
      AND created_at < ? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM auction_registrations r WHERE r.user_id = u.id)`).all(now - 30 * 24 * 3600_000);
    const dropUser = ctx.db.transaction((id) => {
      ctx.db.prepare('DELETE FROM consents WHERE user_id = ?').run(id);
      ctx.db.prepare('UPDATE privacy_requests SET user_id = NULL WHERE user_id = ?').run(id);
      ctx.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    for (const { id } of stale) dropUser(id);
    // Constancias de consentimiento: 5 años después de eliminada la cuenta.
    ctx.db.prepare('DELETE FROM consents WHERE user_id IN (SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?)').run(now - 5 * YEAR);
    // Solicitudes de derechos: 3 años después de resueltas.
    ctx.db.prepare(`DELETE FROM privacy_requests WHERE status = 'resolved' AND resolved_at < ?`).run(now - 3 * YEAR);
    ctx.limiter.sweep();
  });
  const timers = [
    setInterval(safe('subastas', () => auctionTick(ctx)), 1000),
    setInterval(safe('pedidos', () => expireDue(ctx)), 30_000),
    setInterval(housekeeping, 3600_000),
  ];
  housekeeping();
  return () => timers.forEach(clearInterval);
}

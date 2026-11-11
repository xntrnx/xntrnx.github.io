// Middleware HTTP: cabeceras de seguridad, protección CSRF, sesión y control de acceso.
import { findSession } from './services/users.js';
import { errorPage } from './views/layout.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function securityHeaders(config) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    // El pago con PayPal es una redirección tras enviar un formulario propio.
    "form-action 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    ...(config.production ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    next();
  };
}

// CSRF: toda petición que cambia algo debe venir del propio sitio. Se comprueba con las
// cabeceras que el navegador pone y la página no puede falsificar (Sec-Fetch-Site / Origin),
// además de que la cookie de sesión es SameSite=Lax.
export function originCheck(config) {
  const ownHost = new URL(config.baseUrl).host;
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const site = req.get('sec-fetch-site');
    if (site) {
      if (site === 'same-origin') return next();
    } else {
      const origin = req.get('origin');
      if (origin) {
        try {
          const host = new URL(origin).host;
          if (host === req.get('host') || host === ownHost) return next();
        } catch { /* origen ilegible: se rechaza */ }
      }
    }
    res.status(403).send(String(errorPage(req, 403, 'Solicitud bloqueada', 'Por seguridad, esta acción solo puede hacerse desde el propio sitio. Vuelve a la página anterior e inténtalo de nuevo.')));
  };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export const cookieName = (config) => (config.production ? '__Host-sid' : 'sid');

export function setSessionCookie(res, config, token, ttlMs) {
  res.append('Set-Cookie', `${cookieName(config)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}${config.production ? '; Secure' : ''}`);
}
export function clearSessionCookie(res, config) {
  res.append('Set-Cookie', `${cookieName(config)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.production ? '; Secure' : ''}`);
}

export function sessionLoader(ctx) {
  return (req, res, next) => {
    req.user = null;
    req.sessionHash = null;
    req.site = ctx.config.site;
    const token = parseCookies(req.headers.cookie)[cookieName(ctx.config)];
    if (token) {
      const s = findSession(ctx, token);
      if (s) {
        req.user = s.user;
        req.sessionHash = s.hash;
        if (s.renewedTtl) setSessionCookie(res, ctx.config, token, s.renewedTtl);
      } else {
        clearSessionCookie(res, ctx.config);
      }
    }
    // Las páginas dependen de la sesión: nunca se guardan en cachés compartidas.
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}

export const reqMeta = (req) => ({ ip: req.ip || null, ua: (req.get('user-agent') || '').slice(0, 300) || null });

export function requireUser(req, res, next) {
  if (req.user) return next();
  let back = '/cuenta';
  if (req.method === 'GET') back = req.originalUrl;
  else { try { back = new URL(req.get('referer')).pathname; } catch { /* sin referer */ } }
  res.redirect(303, `/cuenta/entrar?next=${encodeURIComponent(back)}`);
}

// Las rutas de administración responden 404 a quien no es admin (no revelan que existen).
export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  res.status(404).send(String(errorPage(req, 404, 'No encontrado', 'Esta página no existe.')));
}

export function rateLimit(ctx, name, max, windowMs) {
  return (req, res, next) => {
    if (ctx.config.rateLimit === false) return next();
    if (ctx.limiter.check(`${name}:${req.ip}`, max, windowMs, Date.now())) return next();
    res.status(429);
    if (req.accepts(['html', 'json']) === 'json') return res.json({ error: 'Demasiados intentos. Espera un momento.' });
    res.send(String(errorPage(req, 429, 'Demasiados intentos', 'Espera unos minutos antes de volver a intentarlo.')));
  };
}

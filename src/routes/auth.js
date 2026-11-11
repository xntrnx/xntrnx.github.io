// Registro, verificación de correo, inicio/cierre de sesión y recuperación de contraseña.
import { Router } from 'express';
import * as users from '../services/users.js';
import { AppError, safeNext } from '../lib/util.js';
import { rateLimit, reqMeta, setSessionCookie, clearSessionCookie } from '../http.js';
import { registerPage, checkEmailPage, loginPage, forgotPage, resetPage } from '../views/account.js';

const send = (res, view) => res.send(String(view));
const HOUR = 3600_000;

export function authRoutes(ctx) {
  const r = Router();
  const nextOf = (req) => {
    const n = req.body?.next ?? req.query.next;
    return typeof n === 'string' && n ? safeNext(n, '') : '';
  };

  r.get('/cuenta/registro', (req, res) => {
    if (req.user) return res.redirect(303, '/cuenta');
    send(res, registerPage(req, { next: nextOf(req) }));
  });

  r.post('/cuenta/registro', rateLimit(ctx, 'register', 10, HOUR), async (req, res) => {
    const b = req.body ?? {};
    try {
      await users.register(ctx, b, reqMeta(req));
      res.redirect(303, '/cuenta/revisa-tu-correo');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      send(res, registerPage(req, { values: b, error: err, next: nextOf(req) }));
    }
  });

  r.get('/cuenta/revisa-tu-correo', (req, res) => send(res, checkEmailPage(req)));

  r.get('/cuenta/verificar', rateLimit(ctx, 'verify', 30, HOUR), (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    const user = users.verifyEmail(ctx, req.query.token);
    if (!user) return res.redirect(303, req.user?.email_verified_at ? '/cuenta' : '/cuenta/entrar?m=bad_token');
    res.redirect(303, req.user ? '/cuenta?m=verified' : '/cuenta/entrar?m=verified');
  });

  r.get('/cuenta/entrar', (req, res) => {
    if (req.user) return res.redirect(303, safeNext(nextOf(req)));
    send(res, loginPage(req, { next: nextOf(req) }));
  });

  r.post('/cuenta/entrar', rateLimit(ctx, 'login', 20, 15 * 60_000), async (req, res) => {
    const b = req.body ?? {};
    try {
      const user = await users.login(ctx, b, reqMeta(req));
      // Sesión nueva en cada inicio (evita fijación de sesión).
      if (req.sessionHash) users.destroySession(ctx, req.sessionHash);
      const { token, ttl } = users.createSession(ctx, user, reqMeta(req));
      setSessionCookie(res, ctx.config, token, ttl);
      res.redirect(303, safeNext(nextOf(req), user.role === 'admin' ? '/admin' : '/cuenta'));
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      send(res, loginPage(req, { values: { email: b.email }, error: err, next: nextOf(req) }));
    }
  });

  r.post('/cuenta/salir', (req, res) => {
    if (req.sessionHash) users.destroySession(ctx, req.sessionHash);
    clearSessionCookie(res, ctx.config);
    res.redirect(303, '/?m=bye');
  });

  r.get('/cuenta/recuperar', (req, res) => send(res, forgotPage(req)));
  r.post('/cuenta/recuperar', rateLimit(ctx, 'forgot', 5, HOUR), async (req, res) => {
    await users.requestPasswordReset(ctx, req.body?.email, reqMeta(req));
    send(res, forgotPage(req, { sent: true }));
  });

  r.get('/cuenta/restablecer', (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    const token = String(req.query.token ?? '');
    if (!users.isResetTokenValid(ctx, token)) return res.redirect(303, '/cuenta/recuperar?m=bad_token');
    send(res, resetPage(req, { token }));
  });

  r.post('/cuenta/restablecer', rateLimit(ctx, 'reset', 10, HOUR), async (req, res) => {
    const token = String(req.body?.token ?? '');
    try {
      await users.resetPassword(ctx, token, req.body?.password, reqMeta(req));
      clearSessionCookie(res, ctx.config);
      res.redirect(303, '/cuenta/entrar?m=reset_done');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      if (err.code === 'bad_token') return res.redirect(303, '/cuenta/recuperar?m=bad_token');
      res.status(err.status);
      send(res, resetPage(req, { token, error: err }));
    }
  });

  return r;
}

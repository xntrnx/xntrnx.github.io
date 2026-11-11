// Mi cuenta: perfil, dirección, contraseña, consentimientos, descarga y eliminación de datos.
import { Router } from 'express';
import * as users from '../services/users.js';
import { listForUser } from '../services/orders.js';
import { AppError } from '../lib/util.js';
import { rateLimit, reqMeta, requireUser, clearSessionCookie } from '../http.js';
import { accountPage, privacyCenterPage } from '../views/account.js';

const send = (res, view) => res.send(String(view));

export function accountRoutes(ctx) {
  const r = Router();

  const myAuctions = (userId) => ctx.db.prepare(`
    SELECT a.id, a.status, r.paddle, w.code AS work_code, w.title AS work_title,
      (SELECT MAX(amount_cents) FROM bids b WHERE b.auction_id = a.id AND b.user_id = r.user_id) AS my_top,
      (SELECT b.user_id FROM bids b WHERE b.auction_id = a.id ORDER BY b.amount_cents DESC LIMIT 1) = r.user_id AS leading,
      (SELECT b.user_id FROM bids b WHERE b.id = a.winner_bid_id) = r.user_id AS won
    FROM auction_registrations r JOIN auctions a ON a.id = r.auction_id JOIN works w ON w.id = a.work_id
    WHERE r.user_id = ? ORDER BY a.ends_at DESC LIMIT 50`).all(userId);

  const renderAccount = (req, res, extra = {}) => send(res, accountPage(req, {
    user: req.user,
    address: users.getAddress(ctx, req.user.id),
    orders: listForUser(ctx, req.user.id),
    auctions: myAuctions(req.user.id),
    ...extra,
  }));

  const renderPrivacy = (req, res, extra = {}) => send(res, privacyCenterPage(req, {
    user: req.user,
    consents: ctx.db.prepare('SELECT kind, version, granted, created_at FROM consents WHERE user_id = ? ORDER BY id DESC').all(req.user.id),
    ...extra,
  }));

  // Ejecuta la acción; si falla por validación, vuelve a mostrar el formulario con el error.
  const handle = (render, form, fn, ok) => async (req, res) => {
    try {
      await fn(req, res);
      if (!res.headersSent) res.redirect(303, ok);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      render(req, res, { error: err, form, values: req.body ?? {} });
    }
  };

  r.get('/cuenta', requireUser, (req, res) => renderAccount(req, res));
  r.get('/cuenta/privacidad', requireUser, (req, res) => renderPrivacy(req, res));

  r.post('/cuenta/perfil', requireUser, handle(renderAccount, 'profile',
    (req) => users.updateProfile(ctx, req.user, req.body ?? {}), '/cuenta?m=saved'));

  r.post('/cuenta/direccion', requireUser, handle(renderAccount, 'address',
    (req) => users.saveAddress(ctx, req.user.id, users.validateAddress(req.body ?? {})), '/cuenta?m=saved'));

  r.post('/cuenta/direccion/eliminar', requireUser, (req, res) => {
    users.deleteAddress(ctx, req.user.id);
    res.redirect(303, '/cuenta?m=address_deleted');
  });

  r.post('/cuenta/reenviar-verificacion', requireUser, rateLimit(ctx, 'resend', 5, 3600_000), (req, res) => {
    if (!req.user.email_verified_at) users.sendVerification(ctx, req.user);
    res.redirect(303, '/cuenta?m=verify_sent');
  });

  r.post('/cuenta/contrasena', requireUser, rateLimit(ctx, 'pw', 10, 3600_000), handle(renderPrivacy, 'password',
    (req) => users.changePassword(ctx, req.user, req.body?.current, req.body?.password, req.sessionHash, reqMeta(req)),
    '/cuenta/privacidad?m=pw_changed'));

  r.post('/cuenta/consentimientos', requireUser, (req, res) => {
    users.setMarketing(ctx, req.user, Boolean(req.body?.marketing), reqMeta(req));
    res.redirect(303, '/cuenta/privacidad?m=saved');
  });

  // Derecho de acceso / portabilidad: descarga inmediata.
  r.get('/cuenta/mis-datos.json', requireUser, rateLimit(ctx, 'export', 20, 3600_000), (req, res) => {
    users.audit(ctx, { userId: req.user.id, action: 'user.export', ip: req.ip });
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos.json"');
    res.type('application/json').send(JSON.stringify(users.exportData(ctx, req.user.id), null, 2));
  });

  // Derecho de supresión / cancelación.
  r.post('/cuenta/eliminar', requireUser, rateLimit(ctx, 'delete', 10, 3600_000), handle(renderPrivacy, 'delete',
    async (req, res) => {
      await users.deleteAccount(ctx, req.user, req.body?.password, reqMeta(req));
      clearSessionCookie(res, ctx.config);
    }, '/?m=deleted'));

  return r;
}

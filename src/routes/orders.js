// Compra directa y pedidos (pago con PayPal o SPEI).
import { Router } from 'express';
import * as orders from '../services/orders.js';
import { getPublic } from '../services/works.js';
import { getAddress } from '../services/users.js';
import { AppError } from '../lib/util.js';
import { rateLimit, reqMeta, requireUser } from '../http.js';
import { errorPage } from '../views/layout.js';
import { checkoutPage, orderPage } from '../views/orders.js';

const send = (res, view) => res.send(String(view));

export function orderRoutes(ctx) {
  const r = Router();
  const limit = rateLimit(ctx, 'order', 30, 3600_000);

  // Solo quien hizo el pedido puede verlo (quien administra usa /admin/pedidos).
  function loadOrder(req, res, next) {
    const order = orders.getOrder(ctx, req.params.code);
    if (!order || order.user_id !== req.user.id) {
      return res.status(404).send(String(errorPage(req, 404, 'Pedido no encontrado', 'No encontramos ese pedido en tu cuenta.')));
    }
    req.order = order;
    next();
  }
  const renderOrder = (req, res, extra = {}) => send(res, orderPage(req, {
    order: orders.getOrder(ctx, req.order.code), config: ctx.config, paypalEnabled: ctx.paypal.enabled, ...extra,
  }));
  const orFormError = (fn, ok) => async (req, res) => {
    try {
      const to = await fn(req, res);
      if (!res.headersSent) res.redirect(303, to || ok(req));
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      renderOrder(req, res, { error: err, values: err.field ? req.body : null });
    }
  };

  r.get('/comprar/:code', requireUser, (req, res) => {
    const work = getPublic(ctx, req.params.code);
    if (!work) return res.status(404).send(String(errorPage(req, 404, 'No encontrada', 'Esta obra no existe o ya no está publicada.')));
    if (work.sale.kind !== 'available') return res.redirect(303, `/obra/${work.code}`);
    if (!req.user.email_verified_at) return res.redirect(303, '/cuenta?m=need_verify');
    send(res, checkoutPage(req, { work, address: getAddress(ctx, req.user.id), config: ctx.config }));
  });

  r.post('/comprar/:code', requireUser, limit, (req, res) => {
    const b = req.body ?? {};
    try {
      const order = orders.createPurchase(ctx, req.user, req.params.code, b, reqMeta(req));
      res.redirect(303, `/pedidos/${order.code}?m=order_created`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      if (err.code === 'unverified') return res.redirect(303, '/cuenta?m=need_verify');
      const work = getPublic(ctx, req.params.code);
      if (!work || err.code === 'unavailable') throw err;
      res.status(err.status);
      send(res, checkoutPage(req, { work, address: null, config: ctx.config, values: b, error: err }));
    }
  });

  r.get('/pedidos/:code', requireUser, loadOrder, (req, res) => renderOrder(req, res));

  r.post('/pedidos/:code/direccion', requireUser, loadOrder, limit, orFormError(
    (req) => { orders.setAddress(ctx, req.order, req.body ?? {}, req.user, reqMeta(req)); },
    (req) => `/pedidos/${req.order.code}?m=saved`));

  r.post('/pedidos/:code/paypal', requireUser, loadOrder, limit, orFormError(
    (req) => orders.startPaypal(ctx, req.order), () => '/'));

  // PayPal regresa aquí después de que la persona aprueba el pago. La captura se valida
  // contra el pedido (importe, moneda y referencia) antes de marcarlo como pagado.
  r.get('/pedidos/:code/paypal/retorno', requireUser, loadOrder, async (req, res) => {
    try {
      const result = await orders.completePaypal(ctx, req.order, String(req.query.token ?? ''));
      res.redirect(303, `/pedidos/${req.order.code}?m=${result === 'refund_due' ? 'refund_due' : 'paid'}`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      renderOrder(req, res, { error: err });
    }
  });

  r.post('/pedidos/:code/spei', requireUser, loadOrder, limit, orFormError(
    (req) => { orders.notifySpei(ctx, req.order, req.body?.ref, req.user); },
    (req) => `/pedidos/${req.order.code}?m=spei_sent`));

  r.post('/pedidos/:code/cancelar', requireUser, loadOrder, orFormError(
    (req) => { orders.cancelByUser(ctx, req.order, req.user); },
    () => '/cuenta?m=order_cancelled'));

  return r;
}

// Pedidos: apartado de la obra, pago (PayPal / SPEI), envío y cierre.
import { AppError, cleanLine } from '../lib/util.js';
import { randomCode } from '../lib/security.js';
import { TERMS_VERSION, PRIVACY_VERSION } from '../legal/versions.js';
import { emails } from '../emails.js';
import { audit, recordConsent, validateAddress, saveAddress, getUser } from './users.js';

export const STATUS_LABEL = {
  pending_payment: 'Esperando pago',
  payment_review: 'Transferencia en revisión',
  paid: 'Pagado, preparando envío',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
  refund_due: 'Reembolso pendiente',
  refunded: 'Reembolsado',
};

const orderUrl = (ctx, o) => `${ctx.config.baseUrl}/pedidos/${o.code}`;
const adminUrl = (ctx, o) => `${ctx.config.baseUrl}/admin/pedidos/${o.code}`;
const workOf = (ctx, o) => ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(o.work_id);

export const shippingFor = (ctx, country) => (country === 'MX' ? ctx.config.shipping.mxCents : ctx.config.shipping.intlCents);

export function getOrder(ctx, code) {
  const o = ctx.db.prepare('SELECT * FROM orders WHERE code = ?').get(String(code));
  return o ? { ...o, work: workOf(ctx, o) } : null;
}

export const listForUser = (ctx, userId) =>
  ctx.db.prepare(`SELECT o.*, w.code AS work_code, w.title AS work_title FROM orders o JOIN works w ON w.id = o.work_id
    WHERE o.user_id = ? ORDER BY o.id DESC`).all(userId);

function insertOrder(ctx, { userId, work, source, auctionId = null, subtotal, address = null, ownerNamePublic = false, holdMs }) {
  const now = ctx.now();
  const shipping = address ? shippingFor(ctx, address.country) : 0;
  const code = `P-${randomCode(8)}`;
  ctx.db.prepare(`INSERT INTO orders (code, user_id, work_id, source, auction_id, subtotal_cents, shipping_cents, total_cents, currency,
      status, ship_recipient, ship_phone, ship_line1, ship_line2, ship_city, ship_state, ship_postal_code, ship_country,
      owner_name_public, expires_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?, 'pending_payment', ?,?,?,?,?,?,?,?, ?,?,?,?)`)
    .run(code, userId, work.id, source, auctionId, subtotal, shipping, subtotal + shipping, ctx.config.currency,
      address?.recipient ?? null, address?.phone ?? null, address?.line1 ?? null, address?.line2 || null, address?.city ?? null,
      address?.state ?? null, address?.postal_code ?? null, address?.country ?? null,
      ownerNamePublic ? 1 : 0, now + holdMs, now, now);
  ctx.db.prepare(`UPDATE works SET status = 'reserved', updated_at = ? WHERE id = ?`).run(now, work.id);
  return code;
}

// Compra directa: aparta la obra para quien compra hasta la fecha límite de pago.
export function createPurchase(ctx, user, workCode, input, meta = {}) {
  if (!user.email_verified_at) throw new AppError('Confirma tu correo antes de comprar.', { code: 'unverified', status: 403 });
  if (!input.acceptTerms) throw new AppError('Para continuar es necesario que aceptes los Términos y Condiciones de venta.', { field: 'acceptTerms' });
  const address = validateAddress(input);
  const gone = new AppError('Esta obra ya no está disponible.', { code: 'unavailable', status: 409 });
  let code;
  try {
    code = ctx.db.transaction(() => {
      const work = ctx.db.prepare('SELECT * FROM works WHERE code = ?').get(String(workCode));
      if (!work || work.status !== 'available' || !work.price_cents) throw gone;
      const auction = ctx.db.prepare(`SELECT 1 FROM auctions WHERE work_id = ? AND status IN ('scheduled','live')`).get(work.id);
      if (auction) throw new AppError('Esta obra está en subasta; no puede comprarse directamente.', { code: 'unavailable', status: 409 });
      const c = insertOrder(ctx, {
        userId: user.id, work, source: 'purchase', subtotal: work.price_cents, address,
        ownerNamePublic: Boolean(input.ownerNamePublic), holdMs: ctx.config.orderHoldMs,
      });
      recordConsent(ctx, user.id, 'terms', TERMS_VERSION, true, meta);
      if (input.ownerNamePublic) recordConsent(ctx, user.id, 'owner_name_public', PRIVACY_VERSION, true, meta);
      if (input.saveAddress) saveAddress(ctx, user.id, address);
      audit(ctx, { userId: user.id, action: 'order.create', entity: 'order', entityId: c, ip: meta.ip });
      return c;
    }).immediate();
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw gone; // otra persona la apartó en el mismo instante
    throw err;
  }
  const order = getOrder(ctx, code);
  ctx.mailer.send({ to: user.email, ...emails.orderCreated({ name: user.name, order, work: order.work, url: orderUrl(ctx, order) }) });
  ctx.mailer.sendAdmin(emails.adminNewOrder({ order, work: order.work, url: adminUrl(ctx, order) }));
  return order;
}

// Pedido de quien gana una subasta. Se llama DENTRO de la transacción de cierre.
export function createFromAuctionTx(ctx, auction, bid, work) {
  const code = insertOrder(ctx, {
    userId: bid.user_id, work, source: 'auction', auctionId: auction.id, subtotal: bid.amount_cents, holdMs: ctx.config.auctionPayMs,
  });
  audit(ctx, { userId: bid.user_id, action: 'order.create_auction', entity: 'order', entityId: code });
  return code;
}

export function notifyAuctionOrder(ctx, code) {
  const order = getOrder(ctx, code);
  const user = getUser(ctx, order.user_id);
  if (user) ctx.mailer.send({ to: user.email, ...emails.orderCreated({ name: user.name, order, work: order.work, url: orderUrl(ctx, order), viaAuction: true }) });
  ctx.mailer.sendAdmin(emails.adminNewOrder({ order, work: order.work, url: adminUrl(ctx, order) }));
}

// Dirección de envío (necesaria antes de pagar un pedido de subasta; editable mientras no se pague).
export function setAddress(ctx, order, input, user, meta = {}) {
  if (order.status !== 'pending_payment') throw new AppError('La dirección ya no puede cambiarse en este pedido. Escríbenos si necesitas corregirla.', { code: 'locked', status: 409 });
  const a = validateAddress(input);
  const shipping = shippingFor(ctx, a.country);
  ctx.db.transaction(() => {
    ctx.db.prepare(`UPDATE orders SET ship_recipient = ?, ship_phone = ?, ship_line1 = ?, ship_line2 = ?, ship_city = ?, ship_state = ?,
      ship_postal_code = ?, ship_country = ?, shipping_cents = ?, total_cents = subtotal_cents + ?, owner_name_public = ?,
      paypal_order_id = NULL, updated_at = ? WHERE id = ?`)
      .run(a.recipient, a.phone, a.line1, a.line2 || null, a.city, a.state, a.postal_code, a.country, shipping, shipping,
        input.ownerNamePublic ? 1 : 0, ctx.now(), order.id);
    if (Boolean(input.ownerNamePublic) !== Boolean(order.owner_name_public)) {
      recordConsent(ctx, user.id, 'owner_name_public', PRIVACY_VERSION, Boolean(input.ownerNamePublic), meta);
    }
    if (input.saveAddress) saveAddress(ctx, user.id, a);
  })();
}

const hasAddress = (o) => Boolean(o.ship_line1 && o.ship_country);

// ---------- PayPal ----------
export async function startPaypal(ctx, order) {
  if (!ctx.paypal.enabled) throw new AppError('PayPal no está disponible por ahora.', { status: 503 });
  if (order.status !== 'pending_payment') throw new AppError('Este pedido ya no está esperando pago.', { code: 'state', status: 409 });
  if (!hasAddress(order)) throw new AppError('Antes de pagar, indica la dirección de envío.', { code: 'address' });
  const now = ctx.now();
  // Si queda poco tiempo, se alarga el apartado para que el pago no llegue con el pedido vencido.
  if (order.expires_at && order.expires_at - now < 30 * 60_000) {
    ctx.db.prepare('UPDATE orders SET expires_at = ? WHERE id = ?').run(now + 30 * 60_000, order.id);
  }
  const pp = await ctx.paypal.createOrder({
    order,
    description: `${order.work.code} - ${order.work.title}`,
    returnUrl: `${orderUrl(ctx, order)}/paypal/retorno`,
    cancelUrl: `${orderUrl(ctx, order)}?m=paypal_cancel`,
  });
  ctx.db.prepare(`UPDATE orders SET paypal_order_id = ?, payment_method = 'paypal', updated_at = ? WHERE id = ?`).run(pp.id, ctx.now(), order.id);
  return pp.approveUrl;
}

export async function completePaypal(ctx, order, paypalToken) {
  if (['paid', 'shipped', 'delivered'].includes(order.status)) return 'paid';
  if (!order.paypal_order_id || paypalToken !== order.paypal_order_id) {
    throw new AppError('No reconocemos esta operación de PayPal. Si se te hizo un cargo, escríbenos.', { code: 'paypal_mismatch', status: 409 });
  }
  let captureId;
  try {
    ({ captureId } = await ctx.paypal.capture({ paypalOrderId: order.paypal_order_id, order }));
  } catch (err) {
    audit(ctx, { userId: order.user_id, action: 'order.paypal_failed', entity: 'order', entityId: order.code, meta: { code: err.code, ...(err.data || {}) } });
    if (err.code === 'paypal_mismatch') {
      ctx.mailer.sendAdmin(emails.adminAlert({ title: `Revisar pago PayPal ${order.code}`, body: 'La captura de PayPal no coincide con el pedido o quedó pendiente. Revísala en tu cuenta de PayPal.', url: adminUrl(ctx, order) }));
    }
    throw err;
  }
  return markPaid(ctx, order.id, { method: 'paypal', captureId });
}

// Marca el pedido como pagado y la obra como vendida. Si el pedido ya había vencido y la
// obra fue apartada por otra persona, el dinero queda marcado para reembolso.
export function markPaid(ctx, orderId, { method, captureId = null, admin = null }) {
  const now = ctx.now();
  const result = ctx.db.transaction(() => {
    const o = ctx.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (['paid', 'shipped', 'delivered'].includes(o.status)) return 'already';
    const setPaid = (status) => ctx.db.prepare(`UPDATE orders SET status = ?, payment_method = ?, paypal_capture_id = COALESCE(?, paypal_capture_id),
      paid_at = ?, expires_at = NULL, updated_at = ? WHERE id = ?`).run(status, method, captureId, now, now, o.id);
    if (o.status === 'pending_payment' || o.status === 'payment_review') {
      setPaid('paid');
      ctx.db.prepare(`UPDATE works SET status = 'sold', updated_at = ? WHERE id = ?`).run(now, o.work_id);
    } else if (o.status === 'expired' || o.status === 'cancelled') {
      const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(o.work_id);
      const auction = ctx.db.prepare(`SELECT 1 FROM auctions WHERE work_id = ? AND status IN ('scheduled','live')`).get(o.work_id);
      if (work.status === 'available' && !auction) {
        setPaid('paid');
        ctx.db.prepare(`UPDATE works SET status = 'sold', updated_at = ? WHERE id = ?`).run(now, o.work_id);
      } else {
        setPaid('refund_due');
        audit(ctx, { userId: admin?.id ?? o.user_id, action: 'order.refund_due', entity: 'order', entityId: o.code });
        return 'refund_due';
      }
    } else {
      throw new AppError('El pedido no admite pagos en su estado actual.', { code: 'state', status: 409 });
    }
    audit(ctx, { userId: admin?.id ?? o.user_id, action: 'order.paid', entity: 'order', entityId: o.code, meta: { method } });
    return 'paid';
  }).immediate();

  const order = ctx.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const work = workOf(ctx, order);
  const user = getUser(ctx, order.user_id);
  if (result === 'refund_due') {
    ctx.mailer.sendAdmin(emails.adminAlert({
      title: `REEMBOLSO pendiente ${order.code}`,
      body: 'Llegó un pago de un pedido que ya había vencido y la obra ya no estaba disponible. Hay que devolver el dinero a la persona compradora.',
      url: adminUrl(ctx, order),
    }));
  } else if (result === 'paid') {
    if (user) ctx.mailer.send({ to: user.email, ...emails.paid({ name: user.name, order, work, url: orderUrl(ctx, order) }) });
    ctx.mailer.sendAdmin(emails.adminPaid({ order, work, url: adminUrl(ctx, order) }));
  }
  return result === 'already' ? 'paid' : result;
}

// ---------- SPEI ----------
export function notifySpei(ctx, order, refInput, user) {
  if (!ctx.config.spei.enabled) throw new AppError('La transferencia SPEI no está disponible por ahora.', { status: 503 });
  if (order.status !== 'pending_payment') throw new AppError('Este pedido ya no está esperando pago.', { code: 'state', status: 409 });
  if (!hasAddress(order)) throw new AppError('Antes de pagar, indica la dirección de envío.', { code: 'address' });
  const ref = cleanLine(refInput, 60) || null;
  // En revisión no vence solo: la confirmación es manual.
  ctx.db.prepare(`UPDATE orders SET status = 'payment_review', payment_method = 'spei', payment_ref = ?, expires_at = NULL, updated_at = ? WHERE id = ?`)
    .run(ref, ctx.now(), order.id);
  audit(ctx, { userId: user.id, action: 'order.spei_notified', entity: 'order', entityId: order.code });
  const fresh = getOrder(ctx, order.code);
  ctx.mailer.send({ to: user.email, ...emails.speiReceived({ name: user.name, order: fresh, url: orderUrl(ctx, fresh) }) });
  ctx.mailer.sendAdmin(emails.adminSpei({ order: fresh, url: adminUrl(ctx, fresh) }));
}

// ---------- Cierre ----------
function closeOrder(ctx, order, status, actorId) {
  const now = ctx.now();
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE orders SET status = ?, expires_at = NULL, updated_at = ? WHERE id = ?').run(status, now, order.id);
    ctx.db.prepare(`UPDATE works SET status = 'available', updated_at = ? WHERE id = ? AND status = 'reserved'`).run(now, order.work_id);
    audit(ctx, { userId: actorId, action: `order.${status}`, entity: 'order', entityId: order.code });
  })();
  const user = getUser(ctx, order.user_id);
  const work = workOf(ctx, order);
  if (user) ctx.mailer.send({ to: user.email, ...emails.orderClosed({ name: user.name, order, work, reason: status }) });
}

export function cancelByUser(ctx, order, user) {
  if (order.source !== 'purchase') throw new AppError('Un pedido que proviene de una subasta no puede cancelarse desde aquí. Escríbenos.', { code: 'state', status: 409 });
  if (order.status !== 'pending_payment') throw new AppError('Este pedido ya no puede cancelarse desde aquí. Escríbenos.', { code: 'state', status: 409 });
  closeOrder(ctx, order, 'cancelled', user.id);
}

// Vence los pedidos sin pago y libera la obra. Lo ejecuta el reloj interno.
export function expireDue(ctx) {
  const due = ctx.db.prepare(`SELECT * FROM orders WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at <= ?`).all(ctx.now());
  for (const o of due) {
    closeOrder(ctx, o, 'expired', null);
    if (o.source === 'auction') {
      ctx.mailer.sendAdmin(emails.adminAlert({
        title: `Subasta sin pago ${o.code}`,
        body: 'Quien ganó la subasta no pagó a tiempo. La obra volvió a quedar disponible; puedes ofrecerla a la siguiente puja o programar otra subasta.',
        url: adminUrl(ctx, o),
      }));
    }
  }
  return due.length;
}

// ---------- Administración ----------
export function adminAction(ctx, order, action, input, admin) {
  const now = ctx.now();
  const user = getUser(ctx, order.user_id);
  const work = order.work || workOf(ctx, order);
  const upd = (sql, ...args) => ctx.db.prepare(`UPDATE orders SET ${sql}, updated_at = ? WHERE id = ?`).run(...args, now, order.id);
  const log = () => audit(ctx, { userId: admin.id, action: `order.admin_${action}`, entity: 'order', entityId: order.code });
  const bad = () => { throw new AppError('Esa acción no aplica al estado actual del pedido.', { code: 'state', status: 409 }); };

  switch (action) {
    case 'confirm_payment': {
      if (!['pending_payment', 'payment_review', 'expired', 'cancelled'].includes(order.status)) bad();
      log();
      return markPaid(ctx, order.id, { method: order.payment_method || 'spei', admin });
    }
    case 'reject_payment': {
      if (order.status !== 'payment_review') bad();
      upd(`status = 'pending_payment', expires_at = ?`, now + 24 * 3600_000);
      log();
      if (user) ctx.mailer.send({ to: user.email, ...emails.paymentRejected({ name: user.name, order, url: orderUrl(ctx, order) }) });
      return 'ok';
    }
    case 'ship': {
      if (order.status !== 'paid') bad();
      const tracking = cleanLine(input.tracking, 120) || null;
      upd(`status = 'shipped', tracking = ?, shipped_at = ?`, tracking, now);
      log();
      if (user) ctx.mailer.send({ to: user.email, ...emails.shipped({ name: user.name, order: { ...order, tracking }, work, url: orderUrl(ctx, order) }) });
      return 'ok';
    }
    case 'deliver': {
      if (order.status !== 'shipped') bad();
      upd(`status = 'delivered', delivered_at = ?`, now);
      log();
      return 'ok';
    }
    case 'cancel': {
      if (!['pending_payment', 'payment_review'].includes(order.status)) bad();
      closeOrder(ctx, order, 'cancelled', admin.id);
      return 'ok';
    }
    case 'refund': {
      // Registra un reembolso que YA hiciste por fuera (PayPal o transferencia).
      if (!['paid', 'shipped', 'delivered', 'refund_due'].includes(order.status)) bad();
      ctx.db.transaction(() => {
        upd(`status = 'refunded'`);
        if (order.status !== 'refund_due') {
          ctx.db.prepare(`UPDATE works SET status = 'available', updated_at = ? WHERE id = ? AND status = 'sold'`).run(now, order.work_id);
        }
        log();
      })();
      return 'ok';
    }
    case 'notes': {
      upd('admin_notes = ?', String(input.notes ?? '').slice(0, 2000) || null);
      return 'ok';
    }
    default:
      return bad();
  }
}

// Conservación: pasados los años de ley, se borran los datos de envío de pedidos cerrados.
export function scrubOldPii(ctx) {
  const cutoff = ctx.now() - ctx.config.retention.orderPiiMs;
  return ctx.db.prepare(`UPDATE orders SET ship_recipient = NULL, ship_phone = NULL, ship_line1 = NULL, ship_line2 = NULL, ship_city = NULL,
      ship_state = NULL, ship_postal_code = NULL, payment_ref = NULL, admin_notes = NULL, pii_scrubbed_at = ?
    WHERE pii_scrubbed_at IS NULL AND updated_at < ? AND status IN ('delivered','cancelled','expired','refunded')`).run(ctx.now(), cutoff).changes;
}

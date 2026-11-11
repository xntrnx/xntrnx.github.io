// Subastas: subasta inglesa ascendente, con pujas públicas bajo seudónimo ("paleta"),
// precio de reserva opcional y prórroga automática contra pujas de último segundo.
import { AppError, fmtMoney } from '../lib/util.js';
import { AUCTION_RULES_VERSION } from '../legal/versions.js';
import { emails } from '../emails.js';
import { audit, recordConsent, getUser } from './users.js';
import { createFromAuctionTx, notifyAuctionOrder } from './orders.js';

export const getAuction = (ctx, id) => ctx.db.prepare('SELECT * FROM auctions WHERE id = ?').get(Number(id)) || null;

const workOf = (ctx, a) => ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(a.work_id);
const topBidOf = (ctx, auctionId) =>
  ctx.db.prepare('SELECT * FROM bids WHERE auction_id = ? ORDER BY amount_cents DESC, id ASC LIMIT 1').get(auctionId) || null;

export const registrationOf = (ctx, auctionId, userId) =>
  ctx.db.prepare('SELECT * FROM auction_registrations WHERE auction_id = ? AND user_id = ?').get(auctionId, userId) || null;

// Estado público de la subasta. No contiene ningún dato personal: solo números de paleta.
export function publicState(ctx, a) {
  const bids = ctx.db.prepare(`SELECT b.amount_cents, b.created_at, r.paddle FROM bids b
    JOIN auction_registrations r ON r.auction_id = b.auction_id AND r.user_id = b.user_id
    WHERE b.auction_id = ? ORDER BY b.amount_cents DESC LIMIT 15`).all(a.id);
  const count = ctx.db.prepare('SELECT COUNT(*) AS n FROM bids WHERE auction_id = ?').get(a.id).n;
  const top = bids[0] || null;
  const current = top ? top.amount_cents : null;
  return {
    id: a.id,
    status: a.status,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    extended: a.ends_at > a.original_ends_at,
    now: ctx.now(),
    startCents: a.start_cents,
    incrementCents: a.increment_cents,
    currentCents: current,
    minNextCents: current === null ? a.start_cents : current + a.increment_cents,
    bidCount: count,
    hasReserve: a.reserve_cents !== null,
    reserveMet: a.reserve_cents === null ? null : current !== null && current >= a.reserve_cents,
    topPaddle: top ? top.paddle : null,
    bids: bids.map((b) => ({ paddle: b.paddle, amountCents: b.amount_cents, at: b.created_at })),
  };
}

const publish = (ctx, a) => ctx.hub.publish(`auction:${a.id}`, publicState(ctx, a));

export function listAuctions(ctx) {
  return ctx.db.prepare(`SELECT a.*, w.code AS work_code, w.title AS work_title, w.status AS work_status FROM auctions a
    JOIN works w ON w.id = a.work_id WHERE a.status != 'cancelled' AND w.status != 'draft'
    ORDER BY CASE a.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END, a.ends_at DESC`).all();
}

// ---------- Administración ----------
export function createAuction(ctx, input, admin) {
  const now = ctx.now();
  const { workId, startsAt, endsAt, startCents, reserveCents = null, incrementCents, extendSeconds = 300 } = input;
  const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
  if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
  if (work.status !== 'available') throw new AppError('Solo se puede subastar una obra publicada como "disponible" y sin pedidos en curso.');
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) throw new AppError('Indica la fecha y hora de inicio y de cierre.');
  if (endsAt <= now) throw new AppError('El cierre debe estar en el futuro.');
  if (endsAt - Math.max(startsAt, now) < 10 * 60_000) throw new AppError('La subasta debe durar al menos 10 minutos.');
  if (!Number.isSafeInteger(startCents) || startCents <= 0) throw new AppError('El precio de salida no es válido.');
  if (!Number.isSafeInteger(incrementCents) || incrementCents <= 0) throw new AppError('El incremento mínimo no es válido.');
  if (reserveCents !== null && (!Number.isSafeInteger(reserveCents) || reserveCents < startCents)) {
    throw new AppError('El precio de reserva no puede ser menor que el precio de salida.');
  }
  if (!Number.isInteger(extendSeconds) || extendSeconds < 0 || extendSeconds > 3600) throw new AppError('La prórroga debe estar entre 0 y 60 minutos.');
  try {
    const r = ctx.db.prepare(`INSERT INTO auctions (work_id, starts_at, ends_at, original_ends_at, start_cents, reserve_cents, increment_cents, extend_seconds, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(workId, startsAt, endsAt, endsAt, startCents, reserveCents, incrementCents, extendSeconds, startsAt <= now ? 'live' : 'scheduled', now);
    audit(ctx, { userId: admin?.id, action: 'auction.create', entity: 'auction', entityId: r.lastInsertRowid });
    return Number(r.lastInsertRowid);
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw new AppError('Esta obra ya tiene una subasta activa.');
    throw err;
  }
}

export function cancelAuction(ctx, id, admin) {
  const a = getAuction(ctx, id);
  if (!a || !['scheduled', 'live'].includes(a.status)) throw new AppError('La subasta ya terminó o no existe.', { status: 409 });
  ctx.db.prepare(`UPDATE auctions SET status = 'cancelled' WHERE id = ?`).run(a.id);
  audit(ctx, { userId: admin?.id, action: 'auction.cancel', entity: 'auction', entityId: a.id });
  publish(ctx, getAuction(ctx, a.id));
}

// ---------- Participación ----------

// Registro a la subasta: exige correo verificado, datos de contacto y aceptar las reglas.
export function registerBidder(ctx, auction, user, input, meta = {}) {
  if (!['scheduled', 'live'].includes(auction.status)) throw new AppError('Esta subasta ya terminó.', { status: 409 });
  if (!user.email_verified_at) throw new AppError('Confirma tu correo antes de registrarte a una subasta.', { code: 'unverified', status: 403 });
  if (!user.name || !user.phone || !user.country) {
    throw new AppError('Completa tu nombre, teléfono y país en tu cuenta antes de registrarte a una subasta.', { code: 'profile', status: 403 });
  }
  if (!input.acceptRules) throw new AppError('Para participar es necesario que aceptes las Reglas de Subasta.', { field: 'acceptRules' });
  if (!input.binding) throw new AppError('Confirma que entiendes que cada puja es un compromiso de compra.', { field: 'binding' });
  const existing = registrationOf(ctx, auction.id, user.id);
  if (existing) return existing;
  ctx.db.transaction(() => {
    const paddle = ctx.db.prepare('SELECT COALESCE(MAX(paddle), 0) + 1 AS p FROM auction_registrations WHERE auction_id = ?').get(auction.id).p;
    ctx.db.prepare('INSERT INTO auction_registrations (auction_id, user_id, paddle, created_at) VALUES (?,?,?,?)').run(auction.id, user.id, paddle, ctx.now());
    recordConsent(ctx, user.id, 'auction_rules', AUCTION_RULES_VERSION, true, meta);
    audit(ctx, { userId: user.id, action: 'auction.register', entity: 'auction', entityId: auction.id, ip: meta.ip });
  }).immediate();
  return registrationOf(ctx, auction.id, user.id);
}

export function placeBid(ctx, auctionId, user, amountCents, meta = {}) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new AppError('Escribe un importe válido.', { field: 'amount' });
  const outcome = ctx.db.transaction(() => {
    const now = ctx.now();
    const a = getAuction(ctx, auctionId);
    if (!a) throw new AppError('Subasta no encontrada.', { status: 404 });
    if (a.status === 'scheduled' && a.starts_at > now) throw new AppError('La subasta todavía no empieza.', { code: 'not_started', status: 409 });
    if (!['scheduled', 'live'].includes(a.status) || a.ends_at <= now) throw new AppError('La subasta ya cerró.', { code: 'ended', status: 409 });
    if (!registrationOf(ctx, a.id, user.id)) throw new AppError('Regístrate a la subasta antes de pujar.', { code: 'unregistered', status: 403 });

    const top = topBidOf(ctx, a.id);
    if (top && top.user_id === user.id) throw new AppError('Ya tienes la puja más alta.', { code: 'already_top', status: 409 });
    const min = top ? top.amount_cents + a.increment_cents : a.start_cents;
    if (amountCents < min) {
      throw new AppError(`La puja mínima ahora es ${fmtMoney(min)}.`, { code: 'low', status: 409, field: 'amount', data: { minNextCents: min } });
    }
    // Freno contra errores de dedo (un cero de más).
    if (amountCents > Math.max(min * 5, min + a.increment_cents * 100)) {
      throw new AppError(`Esa puja es mucho mayor que la mínima (${fmtMoney(min)}). Si es intencional, sube en pasos más cortos.`, { code: 'too_high', field: 'amount' });
    }
    ctx.db.prepare('INSERT INTO bids (auction_id, user_id, amount_cents, created_at, ip) VALUES (?,?,?,?,?)').run(a.id, user.id, amountCents, now, meta.ip ?? null);
    // Prórroga: una puja dentro de la ventana final recorre el cierre.
    const extendMs = a.extend_seconds * 1000;
    const endsAt = extendMs && a.ends_at - now < extendMs ? now + extendMs : a.ends_at;
    ctx.db.prepare(`UPDATE auctions SET status = 'live', ends_at = ? WHERE id = ?`).run(endsAt, a.id);
    audit(ctx, { userId: user.id, action: 'auction.bid', entity: 'auction', entityId: a.id, ip: meta.ip, meta: { amountCents } });
    return { auction: getAuction(ctx, a.id), previousTop: top };
  }).immediate();

  const state = publicState(ctx, outcome.auction);
  ctx.hub.publish(`auction:${outcome.auction.id}`, state);
  if (outcome.previousTop) {
    const prev = getUser(ctx, outcome.previousTop.user_id);
    const work = workOf(ctx, outcome.auction);
    if (prev) ctx.mailer.send({ to: prev.email, ...emails.outbid({ name: prev.name, work, amount: amountCents, url: `${ctx.config.baseUrl}/obra/${work.code}` }) });
  }
  return state;
}

// ---------- Reloj ----------
// Abre las subastas programadas y cierra las que llegaron a su hora. Se ejecuta cada segundo.
export function tick(ctx) {
  const now = ctx.now();
  const starting = ctx.db.prepare(`SELECT * FROM auctions WHERE status = 'scheduled' AND starts_at <= ?`).all(now);
  for (const a of starting) {
    ctx.db.prepare(`UPDATE auctions SET status = 'live' WHERE id = ? AND status = 'scheduled'`).run(a.id);
    publish(ctx, getAuction(ctx, a.id));
  }
  const ending = ctx.db.prepare(`SELECT id FROM auctions WHERE status = 'live' AND ends_at <= ?`).all(now);
  for (const { id } of ending) settle(ctx, id);
  return starting.length + ending.length;
}

function settle(ctx, auctionId) {
  const result = ctx.db.transaction(() => {
    const a = getAuction(ctx, auctionId);
    if (!a || a.status !== 'live' || a.ends_at > ctx.now()) return null; // una puja pudo prorrogarla
    const top = topBidOf(ctx, a.id);
    const work = workOf(ctx, a);
    const sold = top && (a.reserve_cents === null || top.amount_cents >= a.reserve_cents) && work.status === 'available';
    if (sold) {
      ctx.db.prepare(`UPDATE auctions SET status = 'sold', winner_bid_id = ? WHERE id = ?`).run(top.id, a.id);
      const orderCode = createFromAuctionTx(ctx, a, top, work);
      audit(ctx, { userId: top.user_id, action: 'auction.won', entity: 'auction', entityId: a.id, meta: { amountCents: top.amount_cents, orderCode } });
      return { orderCode };
    }
    ctx.db.prepare(`UPDATE auctions SET status = 'unsold' WHERE id = ?`).run(a.id);
    audit(ctx, { action: 'auction.unsold', entity: 'auction', entityId: a.id });
    return { orderCode: null, hadBids: Boolean(top) };
  }).immediate();
  if (!result) return;
  const a = getAuction(ctx, auctionId);
  publish(ctx, a);
  if (result.orderCode) {
    notifyAuctionOrder(ctx, result.orderCode);
  } else {
    const work = workOf(ctx, a);
    ctx.mailer.sendAdmin(emails.adminAlert({
      title: `Subasta sin venta: ${work.title}`,
      body: result.hadBids ? 'La subasta cerró sin alcanzar el precio de reserva.' : 'La subasta cerró sin pujas.',
      url: `${ctx.config.baseUrl}/admin/subastas`,
    }));
  }
}

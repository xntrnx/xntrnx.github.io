// Panel de administración (solo cuentas con rol "admin").
import { Router } from 'express';
import multer from 'multer';
import * as works from '../services/works.js';
import * as auctions from '../services/auctions.js';
import * as orders from '../services/orders.js';
import { audit, getUser } from '../services/users.js';
import { launchIssues } from '../config.js';
import { AppError, parsePesos, clean } from '../lib/util.js';
import { requireAdmin } from '../http.js';
import * as v from '../views/admin.js';

const send = (res, view) => res.send(String(view));

export function adminRoutes(ctx) {
  const r = Router();
  r.use(requireAdmin);

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: works.MAX_PHOTO_BYTES, files: 12, fields: 20 } });
  const count = (sql, ...a) => ctx.db.prepare(sql).get(...a).n;
  const idOf = (req) => (/^\d{1,12}$/.test(req.params.id) ? Number(req.params.id) : -1);

  r.get('/', (req, res) => {
    send(res, v.dashboardPage(req, {
      issues: launchIssues(ctx.config).concat(ctx.keys().length ? [] : ['certs/keys.json está vacío: genera tu llave de firma (npm run cert:keygen) o copia el keys.json del sitio anterior.']),
      stats: {
        review: count(`SELECT COUNT(*) n FROM orders WHERE status = 'payment_review'`),
        toShip: count(`SELECT COUNT(*) n FROM orders WHERE status = 'paid'`),
        refundDue: count(`SELECT COUNT(*) n FROM orders WHERE status = 'refund_due'`),
        privacyOpen: count(`SELECT COUNT(*) n FROM privacy_requests WHERE status = 'open'`),
        liveAuctions: count(`SELECT COUNT(*) n FROM auctions WHERE status = 'live'`),
        works: count('SELECT COUNT(*) n FROM works'),
        users: count('SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL'),
      },
    }));
  });

  // ---------- Obras ----------
  r.get('/obras', (req, res) => send(res, v.worksPage(req, works.listAll(ctx))));
  r.get('/obras/nueva', (req, res) => send(res, v.workNewPage(req, {})));

  r.post('/obras', (req, res) => {
    try {
      const id = works.createWork(ctx, req.body ?? {}, req.user);
      res.redirect(303, `/admin/obras/${id}?m=saved`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      send(res, v.workNewPage(req, { values: req.body ?? {}, error: err }));
    }
  });

  function renderEdit(req, res, id, extra = {}) {
    const work = works.getById(ctx, id);
    if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
    send(res, v.workEditPage(req, {
      work,
      auction: ctx.db.prepare(`SELECT * FROM auctions WHERE work_id = ? AND status IN ('scheduled','live')`).get(id) || null,
      orders: ctx.db.prepare('SELECT * FROM orders WHERE work_id = ? ORDER BY id DESC').all(id),
      ...extra,
    }));
  }
  // Ejecuta una acción sobre la obra y vuelve a su ficha (con el error, si lo hubo).
  const workAction = (fn) => async (req, res) => {
    const id = idOf(req);
    try {
      await fn(req, id);
      res.redirect(303, `/admin/obras/${id}?m=saved`);
    } catch (err) {
      if (!(err instanceof AppError) || err.status === 404) throw err;
      res.status(err.status);
      renderEdit(req, res, id, { error: err });
    }
  };

  r.get('/obras/:id', (req, res) => renderEdit(req, res, idOf(req)));
  r.post('/obras/:id', workAction((req, id) => works.updateWork(ctx, id, req.body ?? {}, req.user)));

  r.post('/obras/:id/fotos', upload.array('photos', 12), workAction((req, id) => {
    if (!req.files?.length) throw new AppError('Elige al menos una foto.');
    for (const f of req.files) works.addPhoto(ctx, id, f.buffer);
  }));
  r.post('/obras/:id/fotos/:pid/eliminar', workAction((req, id) => works.deletePhoto(ctx, id, Number(req.params.pid))));
  r.post('/obras/:id/fotos/:pid/primera', workAction((req, id) => works.makePhotoFirst(ctx, id, Number(req.params.pid))));

  // Ficha sin firmar para el certificado. El nombre del propietario solo se incluye si
  // quien compró lo autorizó expresamente.
  r.get('/obras/:id/ficha.json', (req, res) => {
    const work = works.getById(ctx, idOf(req));
    if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
    const sold = ctx.db.prepare(`SELECT * FROM orders WHERE work_id = ? AND status IN ('paid','shipped','delivered') ORDER BY id DESC LIMIT 1`).get(work.id);
    let owner = `${ctx.config.site.artist} (artista)`;
    if (sold) owner = (sold.owner_name_public && getUser(ctx, sold.user_id)?.name) || 'Colección privada';
    res.setHeader('Content-Disposition', `attachment; filename="${work.code}.json"`);
    res.type('application/json').send(JSON.stringify(works.unsignedFicha(ctx, work, owner), null, 2) + '\n');
  });

  r.post('/obras/:id/certificado', upload.single('cert'), workAction((req, id) => {
    if (!req.file) throw new AppError('Elige el archivo .json firmado.');
    works.setCertificate(ctx, id, req.file.buffer.toString('utf8'), req.user);
  }));

  r.post('/obras/:id/subasta', workAction((req, id) => {
    const b = req.body ?? {};
    // Las horas llegan en milisegundos (las calcula el navegador). Sin JavaScript se
    // interpretan como hora del centro de México (UTC-6).
    const when = (ms, local) => (/^\d{12,14}$/.test(ms ?? '') ? Number(ms) : Date.parse(`${local}:00-06:00`));
    const reserve = clean(b.reserve, 20) ? parsePesos(b.reserve) : null;
    if (clean(b.reserve, 20) && reserve === null) throw new AppError('El precio de reserva no es válido.');
    auctions.createAuction(ctx, {
      workId: id,
      startsAt: when(b.starts_ms, b.starts_local),
      endsAt: when(b.ends_ms, b.ends_local),
      startCents: parsePesos(b.start),
      incrementCents: parsePesos(b.increment),
      reserveCents: reserve,
      extendSeconds: Math.round(Number(b.extend || 0) * 60),
    }, req.user);
  }));

  r.post('/obras/:id/eliminar', (req, res) => {
    const id = idOf(req);
    try {
      works.deleteWork(ctx, id, req.user);
      res.redirect(303, '/admin/obras?m=saved');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      renderEdit(req, res, id, { error: err });
    }
  });

  // ---------- Subastas ----------
  r.get('/subastas', (req, res) => {
    const rows = ctx.db.prepare(`SELECT a.*, w.title AS work_title,
        (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count,
        (SELECT MAX(amount_cents) FROM bids b WHERE b.auction_id = a.id) AS top_cents,
        (SELECT u.name FROM bids b JOIN users u ON u.id = b.user_id WHERE b.auction_id = a.id ORDER BY b.amount_cents DESC LIMIT 1) AS top_name,
        (SELECT u.email FROM bids b JOIN users u ON u.id = b.user_id WHERE b.auction_id = a.id ORDER BY b.amount_cents DESC LIMIT 1) AS top_email
      FROM auctions a JOIN works w ON w.id = a.work_id ORDER BY a.id DESC LIMIT 200`).all();
    send(res, v.auctionsAdminPage(req, rows));
  });
  r.post('/subastas/:id/cancelar', (req, res) => {
    auctions.cancelAuction(ctx, idOf(req), req.user);
    res.redirect(303, '/admin/subastas?m=saved');
  });

  // ---------- Pedidos ----------
  r.get('/pedidos', (req, res) => {
    const rows = ctx.db.prepare(`SELECT o.*, w.title AS work_title, u.name AS user_name FROM orders o
      JOIN works w ON w.id = o.work_id JOIN users u ON u.id = o.user_id
      ORDER BY CASE o.status WHEN 'refund_due' THEN 0 WHEN 'payment_review' THEN 1 WHEN 'paid' THEN 2 ELSE 3 END, o.id DESC LIMIT 300`).all();
    send(res, v.ordersAdminPage(req, rows));
  });

  const renderOrder = (req, res, code, extra = {}) => {
    const order = orders.getOrder(ctx, code);
    if (!order) throw new AppError('Pedido no encontrado.', { status: 404 });
    audit(ctx, { userId: req.user.id, action: 'order.admin_view', entity: 'order', entityId: order.code });
    send(res, v.orderAdminPage(req, { order, buyer: getUser(ctx, order.user_id), ...extra }));
  };
  r.get('/pedidos/:code', (req, res) => renderOrder(req, res, req.params.code));
  r.post('/pedidos/:code/:action', (req, res) => {
    const order = orders.getOrder(ctx, req.params.code);
    if (!order) throw new AppError('Pedido no encontrado.', { status: 404 });
    try {
      orders.adminAction(ctx, order, req.params.action, req.body ?? {}, req.user);
      res.redirect(303, `/admin/pedidos/${order.code}?m=saved`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      renderOrder(req, res, order.code, { error: err });
    }
  });

  // ---------- Cuentas, privacidad, bitácora ----------
  r.get('/usuarios', (req, res) => {
    audit(ctx, { userId: req.user.id, action: 'users.admin_list' });
    send(res, v.usersAdminPage(req, ctx.db.prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 500').all()));
  });

  r.get('/privacidad', (req, res) => {
    send(res, v.privacyAdminPage(req, ctx.db.prepare(`SELECT * FROM privacy_requests ORDER BY status = 'open' DESC, id DESC LIMIT 200`).all()));
  });
  r.post('/privacidad/:id/resolver', (req, res) => {
    ctx.db.prepare(`UPDATE privacy_requests SET status = 'resolved', admin_notes = ?, resolved_at = ? WHERE id = ? AND status = 'open'`)
      .run(clean(req.body?.notes, 2000), ctx.now(), idOf(req));
    audit(ctx, { userId: req.user.id, action: 'privacy.resolved', entity: 'privacy_request', entityId: idOf(req) });
    res.redirect(303, '/admin/privacidad?m=saved');
  });

  r.get('/auditoria', (req, res) => {
    send(res, v.auditPage(req, ctx.db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all()));
  });

  return r;
}

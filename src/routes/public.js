// Rutas públicas: portada, galería, obra, certificados, subastas (listado) y documentos legales.
import { Router } from 'express';
import { getPublic, listPublic } from '../services/works.js';
import { listAuctions, publicState, registrationOf, getAuction } from '../services/auctions.js';
import { createPrivacyRequest } from '../services/users.js';
import { verifyCertificate } from '../lib/cert.js';
import { AppError } from '../lib/util.js';
import { rateLimit } from '../http.js';
import { errorPage } from '../views/layout.js';
import { homePage, galleryPage, workPage, auctionsPage, certificatePage } from '../views/public.js';
import { privacyRequestPage } from '../views/account.js';
import { privacyEs, privacyEn, termsEs, termsEn, cookiesPage } from '../views/legal.js';

const send = (res, view) => res.send(String(view));

// Vista de la obra (se reutiliza para mostrar errores de registro o puja sin JavaScript).
export function renderWork(ctx, req, res, work, { error = null, status = 200 } = {}) {
  const view = { error };
  if (work.sale.auction) {
    view.state = publicState(ctx, work.sale.auction);
    view.registration = req.user ? registrationOf(ctx, work.sale.auction.id, req.user.id) : null;
  }
  const all = listPublic(ctx);
  const k = all.findIndex((w) => w.id === work.id);
  if (k >= 0 && all.length > 1) {
    const prev = all[(k - 1 + all.length) % all.length];
    const next = all[(k + 1) % all.length];
    view.adjacent = all.length > 2 ? { prev, next } : { prev: null, next };
  }
  res.status(status);
  send(res, workPage(req, work, view));
}

export function publicRoutes(ctx) {
  const r = Router();
  const notFound = (req, res, what = 'Esta obra no existe o ya no está publicada.') =>
    res.status(404).send(String(errorPage(req, 404, 'No encontrada', what)));

  r.get('/', (req, res) => send(res, homePage(req)));
  r.get('/galeria', (req, res) => send(res, galleryPage(req, listPublic(ctx))));

  r.get('/obra/:code', (req, res) => {
    const work = getPublic(ctx, req.params.code);
    if (!work) return notFound(req, res);
    renderWork(ctx, req, res, work);
  });

  r.get('/obra/:code/certificado.json', (req, res) => {
    const work = getPublic(ctx, req.params.code);
    if (!work?.certificate_json) return res.status(404).json({ error: 'Sin certificado' });
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/json').send(work.certificate_json);
  });

  r.get('/obra/:code/certificado', (req, res) => {
    const work = getPublic(ctx, req.params.code);
    if (!work) return notFound(req, res);
    if (!work.certificate_json) return notFound(req, res, 'Esta obra todavía no tiene un certificado publicado.');
    const serverCheck = verifyCertificate(JSON.parse(work.certificate_json), ctx.keys());
    send(res, certificatePage(req, { work, serverCheck }));
  });

  r.get('/verificar', (req, res) => send(res, certificatePage(req)));

  // Historial público de llaves de firma (solo llaves públicas).
  r.get('/llaves.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(ctx.keys());
  });

  r.get('/subastas', (req, res) => {
    const auctions = listAuctions(ctx);
    const states = new Map(auctions.map((a) => [a.id, publicState(ctx, getAuction(ctx, a.id))]));
    send(res, auctionsPage(req, auctions, states));
  });

  // ---------- Legal ----------
  r.get('/legal/privacidad', (req, res) => send(res, privacyEs(req, ctx.config)));
  r.get('/legal/privacy', (req, res) => send(res, privacyEn(req, ctx.config)));
  r.get('/legal/terminos', (req, res) => send(res, termsEs(req, ctx.config)));
  r.get('/legal/terms', (req, res) => send(res, termsEn(req, ctx.config)));
  r.get('/legal/cookies', (req, res) => send(res, cookiesPage(req, ctx.config)));

  // Formulario de derechos ARCO / RGPD, abierto también a quien no tiene cuenta.
  r.get('/privacidad/solicitud', (req, res) => send(res, privacyRequestPage(req, {})));
  r.post('/privacidad/solicitud', rateLimit(ctx, 'privacy', 5, 3600_000), (req, res) => {
    try {
      createPrivacyRequest(ctx, req.body ?? {}, req.user);
      res.redirect(303, '/privacidad/solicitud?m=request_sent');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status);
      send(res, privacyRequestPage(req, { values: req.body ?? {}, error: err }));
    }
  });

  // ---------- Compatibilidad con las direcciones del sitio anterior ----------
  const idParam = (req) => (typeof req.query.id === 'string' ? encodeURIComponent(req.query.id) : '');
  r.get('/index.html', (req, res) => res.redirect(301, '/'));
  r.get('/galeria.html', (req, res) => res.redirect(301, '/galeria'));
  r.get('/obra.html', (req, res) => res.redirect(301, idParam(req) ? `/obra/${idParam(req)}` : '/galeria'));
  r.get('/comprar.html', (req, res) => res.redirect(301, idParam(req) ? `/comprar/${idParam(req)}` : '/galeria'));
  r.get('/verify.html', (req, res) => res.redirect(301, idParam(req) ? `/obra/${idParam(req)}/certificado` : '/verificar'));

  return r;
}

// Rutas públicas: portada, galería, obra, certificados, subastas (listado) y documentos legales.
import { Router } from 'express';
import { getPublic, listPublic } from '../services/works.js';
import { listAuctions, publicState, registrationOf, getAuction } from '../services/auctions.js';
import { createPrivacyRequest } from '../services/users.js';
import QRCode from 'qrcode';
import { verifyCertificate, didWeb, didDocument } from '../lib/cert.js';
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

  r.get('/obra/:code/certificado', async (req, res) => {
    const work = getPublic(ctx, req.params.code);
    if (!work) return notFound(req, res);
    if (!work.certificate_json) return notFound(req, res, 'Esta obra todavía no tiene un certificado publicado.');
    const cert = JSON.parse(work.certificate_json);
    const serverCheck = verifyCertificate(cert, ctx.keys(), { did: didWeb(ctx.config.baseUrl) });
    const url = `${ctx.config.baseUrl}/obra/${work.code}/certificado`;
    const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c2333ff', light: '#ffffff00' } });
    send(res, certificatePage(req, { work, cert, serverCheck, qr, url }));
  });

  r.get('/verificar', (req, res) => send(res, certificatePage(req)));

  // Identidad del emisor (did:web): documento DID con las llaves públicas de firma.
  r.get('/.well-known/did.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.type('application/did+json').send(JSON.stringify(didDocument(didWeb(ctx.config.baseUrl), ctx.keys()), null, 2));
  });

  // Vocabulario propio del certificado (los demás términos son de schema.org).
  r.get('/ns/coa', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      '@context': { rdfs: 'http://www.w3.org/2000/01/rdf-schema#' },
      '@id': `${ctx.config.baseUrl}/ns/coa`,
      'rdfs:comment': 'Terms used by certificates of authenticity issued by this site. All other terms come from https://schema.org/ (VisualArtwork).',
      terms: {
        ArtworkAuthenticityCredential: 'Verifiable Credential in which the artist attests that the described artwork is an original work of their authorship.',
        inscriptions: 'Object ID "Inscriptions and Markings": signatures, dates, stamps or labels on the object.',
        distinguishingFeatures: 'Object ID "Distinguishing Features": characteristics that identify this particular object.',
        currentOwner: 'Owner of the artwork when the credential was issued, or "Colección privada" when the owner chose not to be named.',
      },
    });
  });

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

// Subastas: estado en vivo, registro y pujas.
import { Router } from 'express';
import * as auctions from '../services/auctions.js';
import { getById } from '../services/works.js';
import { AppError, parsePesos } from '../lib/util.js';
import { rateLimit, reqMeta, requireUser } from '../http.js';
import { renderWork } from './public.js';

export function auctionRoutes(ctx) {
  const r = Router();

  function load(req, res, next) {
    const a = /^\d{1,12}$/.test(req.params.id) ? auctions.getAuction(ctx, req.params.id) : null;
    if (!a) return next(new AppError('Subasta no encontrada.', { status: 404 }));
    req.auction = a;
    next();
  }
  const wantsJson = (req) => req.accepts(['html', 'json']) === 'json';

  r.get('/subastas/:id/estado', load, (req, res) => res.json(auctions.publicState(ctx, req.auction)));

  // Flujo en vivo (Server-Sent Events). Solo transmite el estado público.
  r.get('/subastas/:id/eventos', load, (req, res) => {
    ctx.hub.subscribe(`auction:${req.auction.id}`, req, res, auctions.publicState(ctx, req.auction));
  });

  r.post('/subastas/:id/registro', requireUser, load, rateLimit(ctx, 'areg', 20, 3600_000), (req, res) => {
    const work = getById(ctx, req.auction.work_id);
    try {
      auctions.registerBidder(ctx, req.auction, req.user, req.body ?? {}, reqMeta(req));
      res.redirect(303, `/obra/${work.code}?m=registered_auction`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      if (err.code === 'unverified') return res.redirect(303, '/cuenta?m=need_verify');
      renderWork(ctx, req, res, work, { error: err, status: err.status });
    }
  });

  r.post('/subastas/:id/pujas', requireUser, load, rateLimit(ctx, 'bid', 60, 60_000), (req, res) => {
    const json = wantsJson(req);
    try {
      const cents = parsePesos(req.body?.amount);
      if (cents === null) throw new AppError('Escribe el importe en pesos, por ejemplo 9500.', { field: 'amount' });
      const state = auctions.placeBid(ctx, req.auction.id, req.user, cents, reqMeta(req));
      if (json) return res.json({ ok: true, state });
      const work = getById(ctx, req.auction.work_id);
      res.redirect(303, `/obra/${work.code}?m=bid_ok`);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      if (json) return res.status(err.status).json({ error: err.message, code: err.code, state: auctions.publicState(ctx, auctions.getAuction(ctx, req.auction.id)) });
      renderWork(ctx, req, res, getById(ctx, req.auction.work_id), { error: err, status: err.status });
    }
  });

  return r;
}

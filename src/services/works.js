// Obras: catálogo público, administración, fotos y certificados.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import { AppError, clean, cleanLine, parsePesos } from '../lib/util.js';
import { verifyCertificate } from '../lib/cert.js';
import { audit } from './users.js';

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;
const IMAGE_EXT = { jpg: 'jpg', png: 'png', webp: 'webp' };
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const photosOf = (ctx, workId) => ctx.db.prepare('SELECT * FROM work_photos WHERE work_id = ? ORDER BY position, id').all(workId);

const activeAuctionOf = (ctx, workId) =>
  ctx.db.prepare(`SELECT * FROM auctions WHERE work_id = ? AND status IN ('scheduled','live')`).get(workId) || null;

const topBid = (ctx, auctionId) =>
  ctx.db.prepare('SELECT amount_cents FROM bids WHERE auction_id = ? ORDER BY amount_cents DESC LIMIT 1').get(auctionId);

// Cómo se muestra la obra al público.
export function saleState(ctx, work) {
  if (work.status === 'sold') return { kind: 'sold', label: 'Vendida' };
  if (work.status === 'reserved') return { kind: 'reserved', label: 'Apartada' };
  if (work.status === 'nfs') return { kind: 'nfs', label: 'No está a la venta' };
  const auction = activeAuctionOf(ctx, work.id);
  if (auction) {
    const top = topBid(ctx, auction.id);
    return {
      kind: auction.status === 'live' ? 'auction_live' : 'auction_scheduled',
      label: auction.status === 'live' ? 'En subasta' : 'Subasta próxima',
      auction,
      amountCents: top ? top.amount_cents : auction.start_cents,
      hasBids: Boolean(top),
    };
  }
  if (work.price_cents) return { kind: 'available', label: 'Disponible', amountCents: work.price_cents };
  return { kind: 'nfs', label: 'Consultar disponibilidad' };
}

export function listPublic(ctx) {
  const works = ctx.db.prepare(`SELECT * FROM works WHERE status != 'draft' ORDER BY position, id DESC`).all();
  return works.map((w) => ({ ...w, photo: photosOf(ctx, w.id)[0] || null, sale: saleState(ctx, w) }));
}

export function getPublic(ctx, code) {
  const w = ctx.db.prepare(`SELECT * FROM works WHERE code = ? AND status != 'draft'`).get(String(code));
  if (!w) return null;
  return { ...w, photos: photosOf(ctx, w.id), sale: saleState(ctx, w) };
}

export function getById(ctx, id) {
  const w = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!w) return null;
  return { ...w, photos: photosOf(ctx, w.id), sale: saleState(ctx, w) };
}

export const listAll = (ctx) =>
  ctx.db.prepare('SELECT * FROM works ORDER BY position, id DESC').all().map((w) => ({ ...w, photo: photosOf(ctx, w.id)[0] || null, sale: saleState(ctx, w) }));

function parseFields(input) {
  const title = cleanLine(input.title, 160);
  if (!title) throw new AppError('Escribe el título de la obra.', { field: 'title' });
  const yearRaw = cleanLine(input.year, 4);
  const year = yearRaw ? Number(yearRaw) : null;
  if (yearRaw && !(Number.isInteger(year) && year > 1800 && year < 2200)) throw new AppError('El año no es válido.', { field: 'year' });
  const priceRaw = cleanLine(input.price, 20);
  const price_cents = priceRaw ? parsePesos(priceRaw) : null;
  if (priceRaw && (price_cents === null || price_cents <= 0)) throw new AppError('El precio no es válido. Ejemplo: 8500 o 8500.50', { field: 'price' });
  const positionRaw = cleanLine(input.position, 6);
  const position = positionRaw ? Number.parseInt(positionRaw, 10) : 0;
  return {
    title,
    technique: cleanLine(input.technique, 160) || null,
    year,
    dimensions: cleanLine(input.dimensions, 80) || null,
    description: clean(input.description, 4000) || null,
    price_cents,
    position: Number.isFinite(position) ? position : 0,
  };
}

export function createWork(ctx, input, admin) {
  const code = cleanLine(input.code, 40);
  if (!CODE_RE.test(code)) throw new AppError('El código solo admite letras, números, guiones y guion bajo (ej. TLK-2026-014).', { field: 'code' });
  const f = parseFields(input);
  const now = ctx.now();
  try {
    const r = ctx.db.prepare(`INSERT INTO works (code, title, technique, year, dimensions, description, price_cents, status, position, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,'draft',?,?,?)`).run(code, f.title, f.technique, f.year, f.dimensions, f.description, f.price_cents, f.position, now, now);
    audit(ctx, { userId: admin?.id, action: 'work.create', entity: 'work', entityId: code });
    return Number(r.lastInsertRowid);
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw new AppError('Ya existe una obra con ese código.', { field: 'code' });
    throw err;
  }
}

export function updateWork(ctx, id, input, admin) {
  const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
  const f = parseFields(input);
  let status = work.status;
  const wanted = cleanLine(input.status, 12);
  if (wanted && wanted !== work.status) {
    if (!['draft', 'available', 'nfs', 'sold'].includes(wanted)) throw new AppError('Estado no válido.', { field: 'status' });
    const order = ctx.db.prepare(`SELECT code FROM orders WHERE work_id = ? AND status IN ('pending_payment','payment_review','paid','shipped','delivered')`).get(id);
    if (order) throw new AppError(`El estado lo controla el pedido ${order.code}. Cancela o reembolsa el pedido para liberarla.`, { field: 'status' });
    if (wanted !== 'available' && activeAuctionOf(ctx, id)) throw new AppError('La obra tiene una subasta activa. Cancélala antes de cambiar el estado.', { field: 'status' });
    status = wanted;
  }
  ctx.db.prepare(`UPDATE works SET title = ?, technique = ?, year = ?, dimensions = ?, description = ?, price_cents = ?, position = ?, status = ?, updated_at = ? WHERE id = ?`)
    .run(f.title, f.technique, f.year, f.dimensions, f.description, f.price_cents, f.position, status, ctx.now(), id);
  audit(ctx, { userId: admin?.id, action: 'work.update', entity: 'work', entityId: work.code });
}

export function deleteWork(ctx, id, admin) {
  const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!work) return;
  const used = ctx.db.prepare('SELECT 1 FROM orders WHERE work_id = ? UNION SELECT 1 FROM auctions WHERE work_id = ? LIMIT 1').get(id, id);
  if (used) throw new AppError('Esta obra tiene pedidos o subastas en su historial y no puede borrarse. Puedes dejarla como borrador.', { code: 'blocked' });
  const photos = photosOf(ctx, id);
  ctx.db.prepare('DELETE FROM works WHERE id = ?').run(id);
  for (const p of photos) fs.rmSync(path.join(ctx.config.uploadsDir, p.file), { force: true });
  audit(ctx, { userId: admin?.id, action: 'work.delete', entity: 'work', entityId: work.code });
}

export function addPhoto(ctx, workId, buffer) {
  const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
  if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new AppError('El archivo está vacío.');
  if (buffer.length > MAX_PHOTO_BYTES) throw new AppError('Cada foto puede pesar hasta 15 MB.');
  let info;
  try { info = imageSize(buffer); } catch { info = null; }
  const ext = info && IMAGE_EXT[info.type];
  if (!ext || !info.width || !info.height) throw new AppError('Formato no admitido. Sube fotos JPG, PNG o WebP.');
  // El archivo se guarda tal cual (sin recomprimir) para que su huella SHA-256 coincida
  // con la que se firma en el certificado.
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const file = `${work.code}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  fs.mkdirSync(ctx.config.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.config.uploadsDir, file), buffer);
  const pos = ctx.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM work_photos WHERE work_id = ?').get(workId).p;
  // Si la foto viene rotada por EXIF (orientación 5-8), ancho y alto se intercambian al mostrarse.
  const rotated = info.orientation >= 5 && info.orientation <= 8;
  ctx.db.prepare('INSERT INTO work_photos (work_id, file, sha256, width, height, position) VALUES (?,?,?,?,?,?)')
    .run(workId, file, sha, rotated ? info.height : info.width, rotated ? info.width : info.height, pos);
  return file;
}

export function deletePhoto(ctx, workId, photoId) {
  const p = ctx.db.prepare('SELECT * FROM work_photos WHERE id = ? AND work_id = ?').get(photoId, workId);
  if (!p) return;
  ctx.db.prepare('DELETE FROM work_photos WHERE id = ?').run(p.id);
  fs.rmSync(path.join(ctx.config.uploadsDir, p.file), { force: true });
}

export function makePhotoFirst(ctx, workId, photoId) {
  const p = ctx.db.prepare('SELECT * FROM work_photos WHERE id = ? AND work_id = ?').get(photoId, workId);
  if (!p) return;
  const min = ctx.db.prepare('SELECT MIN(position) AS m FROM work_photos WHERE work_id = ?').get(workId).m;
  ctx.db.prepare('UPDATE work_photos SET position = ? WHERE id = ?').run(min - 1, p.id);
}

// Ficha sin firmar, lista para firmarse fuera de línea con tools/sign-work.js.
export function unsignedFicha(ctx, work, ownerLabel) {
  return {
    id: work.code,
    titulo: work.title,
    anio: work.year,
    tecnica: work.technique,
    dimensiones: work.dimensions,
    descripcion: work.description,
    propietarioActual: ownerLabel,
    fechaRegistro: new Date(ctx.now()).toISOString().slice(0, 10),
    fotos: work.photos.map((p) => `/media/${p.file}`),
    fotosSha256: work.photos.map((p) => p.sha256),
  };
}

export function setCertificate(ctx, workId, jsonText, admin) {
  const work = ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
  if (!work) throw new AppError('Obra no encontrada.', { status: 404 });
  let cert;
  try { cert = JSON.parse(jsonText); } catch { throw new AppError('El archivo no es JSON válido.'); }
  const result = verifyCertificate(cert, ctx.keys());
  if (!result.ok) throw new AppError(`No se guardó: ${result.reason}`);
  if (cert.id !== work.code) throw new AppError(`La ficha es de la obra "${cert.id}", no de "${work.code}".`);
  ctx.db.prepare('UPDATE works SET certificate_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(cert, null, 2), ctx.now(), workId);
  audit(ctx, { userId: admin?.id, action: 'work.certificate', entity: 'work', entityId: work.code });
}

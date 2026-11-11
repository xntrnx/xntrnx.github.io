// seed.js — carga obras de DEMOSTRACIÓN con "pinturas" generadas por código, para probar
// el sitio antes de subir obra real.
//
//   npm run seed
//
// No lo corras en producción: son datos de ejemplo. Bórralas después desde el panel.
import zlib from 'node:zlib';
import fs from 'node:fs';
import { loadConfig } from '../src/config.js';
import { createContext } from '../src/context.js';
import { createWork, updateWork, addPhoto } from '../src/services/works.js';
import { createAuction } from '../src/services/auctions.js';

const config = loadConfig();
if (config.production && !process.argv.includes('--force')) {
  console.error('Esto carga datos de ejemplo y NODE_ENV=production. Si de verdad quieres hacerlo, agrega --force.');
  process.exit(1);
}

// ---------- PNG mínimo ----------
function png(width, height, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- "Pintura" abstracta: manchas suaves + trazos + grano ----------
function paint(w, h, seed, palette) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const blobs = Array.from({ length: 9 }, () => ({
    x: rnd() * w, y: rnd() * h, r: (0.18 + rnd() * 0.5) * Math.max(w, h),
    c: palette[(rnd() * palette.length) | 0], a: 0.35 + rnd() * 0.55, sx: 0.5 + rnd() * 1.4,
  }));
  const strokes = Array.from({ length: 5 }, () => ({ y: rnd() * h, t: 6 + rnd() * 40, k: (rnd() - 0.5) * 0.6, c: palette[(rnd() * palette.length) | 0], a: 0.25 + rnd() * 0.4 }));
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 14, g = 9, b = 10;
      for (const o of blobs) {
        const dx = (x - o.x) * o.sx, dy = y - o.y;
        const k = o.a * Math.exp(-(dx * dx + dy * dy) / (o.r * o.r * 0.22));
        r += (o.c[0] - r) * k; g += (o.c[1] - g) * k; b += (o.c[2] - b) * k;
      }
      for (const t of strokes) {
        const d = Math.abs(y - (t.y + (x - w / 2) * t.k + Math.sin(x / 37 + t.y) * 9));
        if (d < t.t) { const k = t.a * (1 - d / t.t) ** 2; r += (t.c[0] - r) * k; g += (t.c[1] - g) * k; b += (t.c[2] - b) * k; }
      }
      const n = (rnd() - 0.5) * 16 + Math.sin(x * 0.9) * Math.sin(y * 0.9) * 3; // grano de lienzo
      const i = (y * w + x) * 3;
      out[i] = Math.max(0, Math.min(255, r + n)); out[i + 1] = Math.max(0, Math.min(255, g + n)); out[i + 2] = Math.max(0, Math.min(255, b + n));
    }
  }
  return png(w, h, out);
}

const P = {
  blood: [[179, 32, 42], [74, 12, 17], [234, 228, 219], [30, 20, 22], [229, 86, 91]],
  ochre: [[196, 138, 52], [92, 48, 22], [234, 228, 219], [36, 28, 24], [150, 40, 30]],
  night: [[38, 58, 92], [16, 22, 40], [200, 205, 215], [120, 30, 40], [70, 96, 130]],
  ash: [[148, 138, 132], [60, 54, 52], [234, 228, 219], [20, 18, 18], [179, 32, 42]],
  moss: [[74, 96, 62], [28, 40, 30], [214, 204, 170], [150, 44, 36], [110, 128, 84]],
};

const DEMO = [
  { code: 'DEMO-001', title: 'Lo que queda del incendio', technique: 'Óleo sobre lienzo', year: 2026, dimensions: '80 x 100 cm', price: '18500', size: [800, 1000], pal: P.blood, seed: 11,
    description: 'Pieza de ejemplo. Capas delgadas de rojo sobre negro, raspadas hasta dejar ver el fondo.' },
  { code: 'DEMO-002', title: 'Mediodía en el patio', technique: 'Acrílico y pigmento sobre madera', year: 2025, dimensions: '60 x 60 cm', price: '9500', size: [900, 900], pal: P.ochre, seed: 23 },
  { code: 'DEMO-003', title: 'Una pausa', technique: 'Óleo sobre lino', year: 2026, dimensions: '120 x 90 cm', price: '', size: [1080, 810], pal: P.night, seed: 37, auction: true,
    description: 'Pieza de ejemplo en subasta.' },
  { code: 'DEMO-004', title: 'Ceniza', technique: 'Carbón y óleo sobre papel', year: 2024, dimensions: '50 x 70 cm', price: '6200', size: [700, 980], pal: P.ash, seed: 41, status: 'sold' },
  { code: 'DEMO-005', title: 'Cerro', technique: 'Óleo sobre lienzo', year: 2025, dimensions: '100 x 70 cm', price: '14000', size: [1000, 700], pal: P.moss, seed: 53 },
  { code: 'DEMO-006', title: 'Estudio para un retrato', technique: 'Óleo sobre cartón', year: 2023, dimensions: '30 x 40 cm', price: '', size: [660, 880], pal: P.blood, seed: 67, status: 'nfs' },
];

fs.mkdirSync(config.uploadsDir, { recursive: true });
const ctx = createContext({ ...config, quiet: true });
let made = 0;
DEMO.forEach((d, i) => {
  if (ctx.db.prepare('SELECT 1 FROM works WHERE code = ?').get(d.code)) return;
  const id = createWork(ctx, { ...d, position: String(i) });
  addPhoto(ctx, id, paint(d.size[0], d.size[1], d.seed, d.pal));
  addPhoto(ctx, id, paint(Math.round(d.size[0] * 0.7), Math.round(d.size[1] * 0.7), d.seed + 1, P.ash)); // "reverso"
  updateWork(ctx, id, { ...d, position: String(i), status: d.status || 'available' });
  if (d.auction) {
    const now = Date.now();
    createAuction(ctx, { workId: id, startsAt: now, endsAt: now + 2 * 24 * 3600_000, startCents: 800000, reserveCents: 1200000, incrementCents: 50000, extendSeconds: 300 });
  }
  made++;
});
ctx.db.close();
console.log(made ? `Listo: ${made} obras de demostración.` : 'Las obras de demostración ya existían.');
process.exit(0);

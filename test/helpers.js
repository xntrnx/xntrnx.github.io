// Utilidades de prueba: levanta la aplicación completa con una base temporal, un reloj
// controlable, correo capturado en memoria y un PayPal simulado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { createContext } from '../src/context.js';
import { createApp } from '../src/app.js';
import { canonicalText } from '../src/lib/cert.js';

export async function boot(envOverrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'galeria-test-'));
  const mails = [];
  const config = loadConfig({
    NODE_ENV: 'test', DATA_DIR: dir, BASE_URL: 'http://test.local', KEYS_FILE: path.join(dir, 'keys.json'),
    SITE_NAME: 'una pausa, Cecahuitl', CONTACT_EMAIL: 'hola@test.local', ADMIN_NOTIFY_EMAIL: 'admin@test.local',
    SPEI_CLABE: '012345678901234567', SPEI_BENEFICIARIO: 'Titular de Prueba', SPEI_BANCO: 'Banco de Prueba',
    PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 'secret',
    ...envOverrides,
  }, { quiet: true, rateLimit: false });
  config.mail.transport = { sendMail: async (m) => { mails.push(m); } };
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(config.keysFile, '[]');

  const clock = { t: Date.UTC(2026, 10, 11, 18, 0, 0) };
  const ctx = createContext(config, { now: () => clock.t });
  const app = createApp(ctx);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    ctx, config, clock, mails, base, dir,
    client: () => new Client(base),
    // Último correo enviado a una dirección (espera a que termine el envío).
    async lastMail(to) {
      await ctx.mailer.idle();
      return [...mails].reverse().find((m) => m.to === to) || null;
    },
    async close() {
      ctx.hub.close();
      await ctx.mailer.idle();
      await new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
      ctx.db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Cliente HTTP con frasco de cookies. Envía la cabecera Origin como lo haría un navegador.
export class Client {
  constructor(base) { this.base = base; this.cookies = new Map(); }

  async request(method, url, { form, json, body, headers = {}, origin = this.base } = {}) {
    const h = { Accept: 'text/html', ...headers };
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET' && origin) h.Origin = origin;
    let payload = body;
    if (form) { h['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
    if (json) { h['Content-Type'] = 'application/json'; h.Accept = 'application/json'; payload = JSON.stringify(json); }
    const res = await fetch(this.base + url, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      if (attrs.some((a) => a.trim().toLowerCase() === 'max-age=0')) this.cookies.delete(name);
      else this.cookies.set(name, pair.slice(i + 1).trim());
    }
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), text, headers: res.headers, json: () => JSON.parse(text) };
  }
  get(url, opts) { return this.request('GET', url, opts); }
  post(url, form = {}, opts = {}) { return this.request('POST', url, { form, ...opts }); }
}

export const tokenFrom = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');

let n = 0;
// Crea una cuenta verificada y con sesión iniciada. Devuelve { client, email, user }.
export async function signUp(t, { verify = true, phone = '+52 55 1234 5678', name = 'Ana Compradora', country = 'MX' } = {}) {
  const email = `persona${++n}@test.local`;
  const password = 'una frase larga y segura';
  const c = t.client();
  const r = await c.post('/cuenta/registro', { name, email, country, password, adult: '1', acceptLegal: '1' });
  if (r.status !== 303) throw new Error(`registro falló: ${r.status}`);
  if (verify) {
    const mail = await t.lastMail(email);
    await c.get(`/cuenta/verificar?token=${tokenFrom(mail)}`);
  }
  const login = await c.post('/cuenta/entrar', { email, password });
  if (login.status !== 303) throw new Error(`login falló: ${login.status}`);
  const user = t.ctx.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (phone) t.ctx.db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, user.id);
  return { client: c, email, password, user: t.ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) };
}

export async function signUpAdmin(t) {
  const a = await signUp(t, { name: 'Artista Admin' });
  t.ctx.db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(a.user.id);
  return a;
}

// Inserta una obra publicada directamente en la base.
export function makeWork(t, { code = `T-${++n}`, title = 'Obra de prueba', priceCents = 850000, status = 'available' } = {}) {
  const now = t.clock.t;
  const r = t.ctx.db.prepare(`INSERT INTO works (code, title, technique, year, price_cents, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(code, title, 'Óleo sobre lienzo', 2026, priceCents, status, now, now);
  return { id: Number(r.lastInsertRowid), code, title };
}

export const ADDRESS = {
  recipient: 'Ana Compradora', phone: '+52 55 1234 5678', line1: 'Av. Siempre Viva 742', line2: 'Depto 3',
  city: 'Ciudad de México', state: 'CDMX', postal_code: '06100', country: 'MX',
};

// Par de llaves de firma para pruebas; registra la pública en el historial del sitio.
export function makeSigner(t, { register = true, revoked = false } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = der.subarray(der.length - 32).toString('base64');
  if (register) {
    const keys = JSON.parse(fs.readFileSync(t.config.keysFile, 'utf8'));
    keys.push({ publicKeyBase64, created: '2026-01-01', revoked });
    fs.writeFileSync(t.config.keysFile, JSON.stringify(keys));
  }
  return (ficha) => {
    const copy = { ...ficha };
    delete copy.signature; delete copy.publicKeyBase64;
    const signature = crypto.sign(null, Buffer.from(canonicalText(copy), 'utf8'), privateKey).toString('base64');
    return { ...copy, publicKeyBase64, signature };
  };
}

// PNG mínimo válido de 1x1 (para probar la subida de fotos).
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// PayPal simulado: registra las llamadas y responde como la API real.
export function fakePaypal(t, { captureAmount = null, captureStatus = 'COMPLETED' } = {}) {
  const calls = [];
  const created = new Map();
  t.config.paypal.fetch = async (url, init) => {
    const u = new URL(url);
    calls.push({ method: init.method, path: u.pathname, body: init.body ? safeJson(init.body) : null });
    const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (u.pathname === '/v1/oauth2/token') return reply(200, { access_token: 'tok', expires_in: 3600 });
    if (u.pathname === '/v2/checkout/orders' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      const id = `PP${created.size + 1}`;
      created.set(id, body.purchase_units[0]);
      return reply(201, { id, status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }] });
    }
    const m = u.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/);
    if (m && created.has(m[1])) {
      const unit = created.get(m[1]);
      return reply(201, { id: m[1], status: captureStatus, purchase_units: [{ payments: { captures: [{
        id: `CAP-${m[1]}`, status: captureStatus, custom_id: unit.custom_id,
        amount: captureAmount || unit.amount,
      }] } }] });
    }
    return reply(404, { name: 'RESOURCE_NOT_FOUND' });
  };
  return calls;
}
function safeJson(s) { try { return JSON.parse(s); } catch { return String(s); } }

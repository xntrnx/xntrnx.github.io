// Cuentas: registro, verificación de correo, sesiones, perfil y derechos de privacidad.
import { AppError, clean, cleanLine, normalizeEmail, isEmail, isCountry } from '../lib/util.js';
import { hashPassword, verifyPassword, burnPasswordTime, newToken, sha256, PASSWORD_MIN, PASSWORD_MAX } from '../lib/security.js';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/versions.js';
import { emails } from '../emails.js';

const VERIFY_TTL = 48 * 3600_000;
const RESET_TTL = 3600_000;
const MAX_FAILED = 10;
const LOCK_MS = 15 * 60_000;

export function audit(ctx, { userId = null, action, entity = null, entityId = null, ip = null, meta = null }) {
  ctx.db.prepare('INSERT INTO audit_log (at, user_id, action, entity, entity_id, ip, meta) VALUES (?,?,?,?,?,?,?)')
    .run(ctx.now(), userId, action, entity, entityId == null ? null : String(entityId), ip, meta ? JSON.stringify(meta) : null);
}

export function recordConsent(ctx, userId, kind, version, granted, meta = {}) {
  ctx.db.prepare('INSERT INTO consents (user_id, kind, version, granted, created_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)')
    .run(userId, kind, version, granted ? 1 : 0, ctx.now(), meta.ip ?? null, meta.ua ?? null);
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) {
    throw new AppError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, { field: 'password' });
  }
  if (pw.length > PASSWORD_MAX) throw new AppError('La contraseña es demasiado larga.', { field: 'password' });
}

function validPhone(v) {
  return /^[+\d][\d\s().-]{6,24}$/.test(v);
}

export const getUser = (ctx, id) => ctx.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(id);
const getByEmail = (ctx, email) => ctx.db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email);

function issueToken(ctx, userId, kind, ttl) {
  const { token, hash } = newToken();
  const now = ctx.now();
  ctx.db.prepare('DELETE FROM tokens WHERE user_id = ? AND kind = ?').run(userId, kind);
  ctx.db.prepare('INSERT INTO tokens (token_hash, user_id, kind, expires_at, created_at) VALUES (?,?,?,?,?)')
    .run(hash, userId, kind, now + ttl, now);
  return token;
}

function takeToken(ctx, token, kind) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const row = ctx.db.prepare('SELECT * FROM tokens WHERE token_hash = ? AND kind = ?').get(sha256(token), kind);
  if (!row || row.used_at || row.expires_at < ctx.now()) return null;
  return row;
}

// ---------- Registro ----------
export async function register(ctx, input, meta = {}) {
  const email = normalizeEmail(input.email);
  const name = cleanLine(input.name, 120);
  const country = cleanLine(input.country, 2).toUpperCase();
  if (name.length < 2) throw new AppError('Escribe tu nombre completo.', { field: 'name' });
  if (!isEmail(email)) throw new AppError('Escribe un correo electrónico válido.', { field: 'email' });
  if (!isCountry(country)) throw new AppError('Elige tu país de residencia.', { field: 'country' });
  checkPassword(input.password);
  if (!input.adult) throw new AppError('Debes ser mayor de 18 años para crear una cuenta.', { field: 'adult' });
  if (!input.acceptLegal) {
    throw new AppError('Para crear la cuenta es necesario que aceptes los Términos y Condiciones y confirmes que leíste el Aviso de Privacidad.', { field: 'acceptLegal' });
  }

  const existing = getByEmail(ctx, email);
  const password_hash = await hashPassword(input.password); // siempre, para igualar tiempos
  if (existing) {
    // Misma respuesta que un registro nuevo: no se revela que el correo ya está registrado.
    ctx.mailer.send({ to: existing.email, ...emails.alreadyRegistered({
      name: existing.name, loginUrl: `${ctx.config.baseUrl}/cuenta/entrar`, resetUrl: `${ctx.config.baseUrl}/cuenta/recuperar`,
    }) });
    return { created: false };
  }

  const now = ctx.now();
  const marketing = input.marketing ? 1 : 0;
  let userId;
  try {
    userId = ctx.db.transaction(() => {
      const r = ctx.db.prepare(`INSERT INTO users (email, password_hash, name, country, marketing_opt_in, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?)`).run(email, password_hash, name, country, marketing, now, now);
      const id = Number(r.lastInsertRowid);
      recordConsent(ctx, id, 'privacy', PRIVACY_VERSION, true, meta);
      recordConsent(ctx, id, 'terms', TERMS_VERSION, true, meta);
      if (marketing) recordConsent(ctx, id, 'marketing', PRIVACY_VERSION, true, meta);
      audit(ctx, { userId: id, action: 'user.register', entity: 'user', entityId: id, ip: meta.ip });
      return id;
    })();
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) return { created: false }; // registro simultáneo del mismo correo
    throw err;
  }
  sendVerification(ctx, { id: userId, email, name });
  return { created: true, userId };
}

export function sendVerification(ctx, user) {
  const token = issueToken(ctx, user.id, 'verify_email', VERIFY_TTL);
  ctx.mailer.send({ to: user.email, ...emails.verify({ name: user.name, url: `${ctx.config.baseUrl}/cuenta/verificar?token=${token}` }) });
}

export function verifyEmail(ctx, token) {
  const row = takeToken(ctx, token, 'verify_email');
  if (!row) return null;
  const now = ctx.now();
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE tokens SET used_at = ? WHERE token_hash = ?').run(now, row.token_hash);
    ctx.db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?').run(now, now, row.user_id);
    audit(ctx, { userId: row.user_id, action: 'user.verify_email', entity: 'user', entityId: row.user_id });
  })();
  return getUser(ctx, row.user_id);
}

// ---------- Inicio de sesión ----------
const BAD_LOGIN = 'Correo o contraseña incorrectos.';

export async function login(ctx, input, meta = {}) {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password.slice(0, PASSWORD_MAX) : '';
  const user = isEmail(email) ? getByEmail(ctx, email) : null;
  if (!user || !user.password_hash) {
    await burnPasswordTime(password);
    throw new AppError(BAD_LOGIN, { code: 'bad_login', status: 401 });
  }
  const now = ctx.now();
  if (user.locked_until && user.locked_until > now) {
    await burnPasswordTime(password);
    throw new AppError('Demasiados intentos fallidos. Espera unos minutos o restablece tu contraseña.', { code: 'locked', status: 429 });
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    const failed = user.failed_logins + 1;
    ctx.db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .run(failed, failed >= MAX_FAILED ? now + LOCK_MS : null, user.id);
    audit(ctx, { userId: user.id, action: 'user.login_failed', ip: meta.ip });
    throw new AppError(BAD_LOGIN, { code: 'bad_login', status: 401 });
  }
  ctx.db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
  audit(ctx, { userId: user.id, action: 'user.login', ip: meta.ip });
  return user;
}

export function createSession(ctx, user, meta = {}) {
  const { token, hash } = newToken();
  const now = ctx.now();
  const ttl = user.role === 'admin' ? ctx.config.retention.adminSessionMs : ctx.config.retention.sessionMs;
  ctx.db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)')
    .run(hash, user.id, now, now, now + ttl, meta.ip ?? null, meta.ua ?? null);
  return { token, ttl };
}

export function findSession(ctx, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const hash = sha256(token);
  const now = ctx.now();
  const s = ctx.db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(hash);
  if (!s) return null;
  if (s.expires_at < now) {
    ctx.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
    return null;
  }
  const user = getUser(ctx, s.user_id);
  if (!user) return null;
  // Sesión deslizante: se renueva con el uso (a lo más una escritura cada 10 minutos).
  let renewedTtl = 0;
  if (now - s.last_seen_at > 10 * 60_000) {
    renewedTtl = user.role === 'admin' ? ctx.config.retention.adminSessionMs : ctx.config.retention.sessionMs;
    ctx.db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?').run(now, now + renewedTtl, hash);
  }
  return { hash, user, renewedTtl };
}

export function destroySession(ctx, hash) {
  ctx.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
}

// ---------- Contraseña ----------
export async function requestPasswordReset(ctx, emailInput, meta = {}) {
  const email = normalizeEmail(emailInput);
  const user = isEmail(email) ? getByEmail(ctx, email) : null;
  if (!user) return; // misma respuesta exista o no la cuenta
  const token = issueToken(ctx, user.id, 'reset_password', RESET_TTL);
  audit(ctx, { userId: user.id, action: 'user.reset_requested', ip: meta.ip });
  ctx.mailer.send({ to: user.email, ...emails.reset({ name: user.name, url: `${ctx.config.baseUrl}/cuenta/restablecer?token=${token}` }) });
}

export const isResetTokenValid = (ctx, token) => Boolean(takeToken(ctx, token, 'reset_password'));

export async function resetPassword(ctx, token, password, meta = {}) {
  checkPassword(password);
  const row = takeToken(ctx, token, 'reset_password');
  if (!row) throw new AppError('El enlace ya no es válido. Pide uno nuevo.', { code: 'bad_token' });
  const hash = await hashPassword(password);
  const now = ctx.now();
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE tokens SET used_at = ? WHERE token_hash = ?').run(now, row.token_hash);
    // Quien abre el enlace demostró controlar el correo: también queda verificado.
    ctx.db.prepare(`UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL,
      email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?`).run(hash, now, now, row.user_id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    audit(ctx, { userId: row.user_id, action: 'user.password_reset', ip: meta.ip });
  })();
  const user = getUser(ctx, row.user_id);
  if (user) ctx.mailer.send({ to: user.email, ...emails.passwordChanged({ name: user.name }) });
  return user;
}

export async function changePassword(ctx, user, current, next, keepSessionHash, meta = {}) {
  if (!(await verifyPassword(String(current ?? ''), user.password_hash))) {
    throw new AppError('La contraseña actual no es correcta.', { field: 'current' });
  }
  checkPassword(next);
  const hash = await hashPassword(next);
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, ctx.now(), user.id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(user.id, keepSessionHash ?? '');
    audit(ctx, { userId: user.id, action: 'user.password_changed', ip: meta.ip });
  })();
  ctx.mailer.send({ to: user.email, ...emails.passwordChanged({ name: user.name }) });
}

// ---------- Perfil ----------
export function updateProfile(ctx, user, input) {
  const name = cleanLine(input.name, 120);
  const phone = cleanLine(input.phone, 30);
  const country = cleanLine(input.country, 2).toUpperCase();
  if (name.length < 2) throw new AppError('Escribe tu nombre completo.', { field: 'name' });
  if (phone && !validPhone(phone)) throw new AppError('Escribe un teléfono válido, con clave de país (ej. +52 55 1234 5678).', { field: 'phone' });
  if (!isCountry(country)) throw new AppError('Elige tu país de residencia.', { field: 'country' });
  ctx.db.prepare('UPDATE users SET name = ?, phone = ?, country = ?, updated_at = ? WHERE id = ?')
    .run(name, phone || null, country, ctx.now(), user.id);
}

export function setMarketing(ctx, user, granted, meta = {}) {
  const g = granted ? 1 : 0;
  if (user.marketing_opt_in === g) return;
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE users SET marketing_opt_in = ?, updated_at = ? WHERE id = ?').run(g, ctx.now(), user.id);
    recordConsent(ctx, user.id, 'marketing', PRIVACY_VERSION, g, meta);
  })();
}

export function validateAddress(input) {
  const a = {
    recipient: cleanLine(input.recipient, 120),
    phone: cleanLine(input.phone, 30),
    line1: cleanLine(input.line1, 160),
    line2: cleanLine(input.line2, 160),
    city: cleanLine(input.city, 80),
    state: cleanLine(input.state, 80),
    postal_code: cleanLine(input.postal_code, 16),
    country: cleanLine(input.country, 2).toUpperCase(),
  };
  if (a.recipient.length < 2) throw new AppError('Escribe el nombre de quien recibe.', { field: 'recipient' });
  if (!validPhone(a.phone)) throw new AppError('Escribe un teléfono de contacto para la entrega, con clave de país.', { field: 'phone' });
  if (a.line1.length < 4) throw new AppError('Escribe la calle y el número.', { field: 'line1' });
  if (!a.city) throw new AppError('Escribe la ciudad.', { field: 'city' });
  if (!a.state) throw new AppError('Escribe el estado o provincia.', { field: 'state' });
  if (a.postal_code.length < 3) throw new AppError('Escribe el código postal.', { field: 'postal_code' });
  if (!isCountry(a.country)) throw new AppError('Elige el país de envío.', { field: 'country' });
  return a;
}

export const getAddress = (ctx, userId) => ctx.db.prepare('SELECT * FROM addresses WHERE user_id = ?').get(userId) || null;

export function saveAddress(ctx, userId, a) {
  ctx.db.prepare(`INSERT INTO addresses (user_id, recipient, phone, line1, line2, city, state, postal_code, country, updated_at)
    VALUES (@user_id, @recipient, @phone, @line1, @line2, @city, @state, @postal_code, @country, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET recipient = excluded.recipient, phone = excluded.phone, line1 = excluded.line1,
      line2 = excluded.line2, city = excluded.city, state = excluded.state, postal_code = excluded.postal_code,
      country = excluded.country, updated_at = excluded.updated_at`)
    .run({ ...a, line2: a.line2 || null, user_id: userId, updated_at: ctx.now() });
}

export function deleteAddress(ctx, userId) {
  ctx.db.prepare('DELETE FROM addresses WHERE user_id = ?').run(userId);
}

// ---------- Derechos de privacidad ----------

// Acceso / portabilidad: copia completa de los datos de la persona, en JSON.
export function exportData(ctx, userId) {
  const db = ctx.db;
  const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const address = getAddress(ctx, userId);
  return {
    generado: iso(ctx.now()),
    responsable: ctx.config.legal.controllerName || ctx.config.site.name,
    cuenta: {
      correo: u.email, nombre: u.name, telefono: u.phone, pais: u.country,
      correoVerificado: iso(u.email_verified_at), recibeNovedades: Boolean(u.marketing_opt_in),
      creada: iso(u.created_at), actualizada: iso(u.updated_at),
    },
    direccionGuardada: address && {
      destinatario: address.recipient, telefono: address.phone, linea1: address.line1, linea2: address.line2,
      ciudad: address.city, estado: address.state, codigoPostal: address.postal_code, pais: address.country,
    },
    consentimientos: db.prepare('SELECT kind, version, granted, created_at, ip, user_agent FROM consents WHERE user_id = ? ORDER BY id').all(userId)
      .map((c) => ({ tipo: c.kind, version: c.version, otorgado: Boolean(c.granted), fecha: iso(c.created_at), ip: c.ip, dispositivo: c.user_agent })),
    pedidos: db.prepare(`SELECT o.*, w.code AS work_code, w.title AS work_title FROM orders o JOIN works w ON w.id = o.work_id
      WHERE o.user_id = ? ORDER BY o.id`).all(userId).map((o) => ({
      pedido: o.code, obra: `${o.work_title} (${o.work_code})`, origen: o.source, estado: o.status,
      subtotal: o.subtotal_cents / 100, envio: o.shipping_cents / 100, total: o.total_cents / 100, moneda: o.currency,
      metodoDePago: o.payment_method, referenciaDePago: o.payment_ref, ordenPaypal: o.paypal_order_id,
      envioA: o.ship_recipient ? {
        destinatario: o.ship_recipient, telefono: o.ship_phone, linea1: o.ship_line1, linea2: o.ship_line2,
        ciudad: o.ship_city, estado: o.ship_state, codigoPostal: o.ship_postal_code, pais: o.ship_country,
      } : null,
      nombrePublicoEnCertificado: Boolean(o.owner_name_public), guia: o.tracking,
      creado: iso(o.created_at), pagado: iso(o.paid_at), enviado: iso(o.shipped_at), entregado: iso(o.delivered_at),
    })),
    subastas: db.prepare(`SELECT r.auction_id, r.paddle, r.created_at, w.code AS work_code, w.title AS work_title
      FROM auction_registrations r JOIN auctions a ON a.id = r.auction_id JOIN works w ON w.id = a.work_id
      WHERE r.user_id = ? ORDER BY r.created_at`).all(userId)
      .map((r) => ({ subasta: r.auction_id, obra: `${r.work_title} (${r.work_code})`, paleta: r.paddle, registro: iso(r.created_at) })),
    pujas: db.prepare('SELECT auction_id, amount_cents, created_at, ip FROM bids WHERE user_id = ? ORDER BY id').all(userId)
      .map((b) => ({ subasta: b.auction_id, importe: b.amount_cents / 100, fecha: iso(b.created_at), ip: b.ip })),
    sesiones: db.prepare('SELECT created_at, last_seen_at, ip, user_agent FROM sessions WHERE user_id = ?').all(userId)
      .map((s) => ({ inicio: iso(s.created_at), ultimoUso: iso(s.last_seen_at), ip: s.ip, dispositivo: s.user_agent })),
    solicitudesDePrivacidad: db.prepare('SELECT kind, message, status, created_at, resolved_at FROM privacy_requests WHERE user_id = ?').all(userId)
      .map((r) => ({ tipo: r.kind, mensaje: r.message, estado: r.status, fecha: iso(r.created_at), resuelta: iso(r.resolved_at) })),
    actividadDeSeguridad: db.prepare('SELECT at, action, ip FROM audit_log WHERE user_id = ? ORDER BY id').all(userId)
      .map((a) => ({ fecha: iso(a.at), evento: a.action, ip: a.ip })),
  };
}

// Supresión / cancelación. Borra lo que se puede borrar y anonimiza el resto; los pedidos
// se conservan bloqueados por obligación legal (fiscal) hasta que venza su plazo.
export async function deleteAccount(ctx, user, password, meta = {}) {
  if (!(await verifyPassword(String(password ?? ''), user.password_hash))) {
    throw new AppError('La contraseña no es correcta.', { field: 'password' });
  }
  if (user.role === 'admin') throw new AppError('Una cuenta de administración no puede eliminarse desde aquí.', { code: 'blocked' });
  const db = ctx.db;
  const openOrder = db.prepare(`SELECT code FROM orders WHERE user_id = ? AND status IN ('pending_payment','payment_review','paid','shipped','refund_due') LIMIT 1`).get(user.id);
  if (openOrder) {
    throw new AppError(`Tienes un pedido en curso (${openOrder.code}). Podrás eliminar tu cuenta cuando se entregue o se cancele.`, { code: 'blocked' });
  }
  const leading = db.prepare(`SELECT a.id FROM auctions a WHERE a.status = 'live'
    AND (SELECT b.user_id FROM bids b WHERE b.auction_id = a.id ORDER BY b.amount_cents DESC LIMIT 1) = ? LIMIT 1`).get(user.id);
  if (leading) {
    throw new AppError('Tienes la puja más alta en una subasta en curso. Podrás eliminar tu cuenta cuando la subasta termine.', { code: 'blocked' });
  }
  const email = user.email;
  const now = ctx.now();
  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM addresses WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE bids SET ip = NULL WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE consents SET ip = NULL, user_agent = NULL WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE audit_log SET ip = NULL WHERE user_id = ?').run(user.id);
    db.prepare(`UPDATE privacy_requests SET name = '(eliminado)', email = '(eliminado)', message = '(eliminado)' WHERE user_id = ? AND status = 'resolved'`).run(user.id);
    db.prepare(`UPDATE users SET email = ?, password_hash = NULL, name = NULL, phone = NULL, country = NULL,
      marketing_opt_in = 0, email_verified_at = NULL, deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(`eliminada-${user.id}@invalid`, now, now, user.id);
    audit(ctx, { userId: user.id, action: 'user.deleted', entity: 'user', entityId: user.id });
  })();
  ctx.mailer.send({ to: email, ...emails.accountDeleted() });
}

export function createPrivacyRequest(ctx, input, user = null) {
  const name = cleanLine(input.name, 120);
  const email = normalizeEmail(input.email);
  const kind = cleanLine(input.kind, 30);
  const message = clean(input.message, 4000);
  const KINDS = ['acceso', 'rectificacion', 'cancelacion', 'oposicion', 'limitacion', 'portabilidad', 'revocacion', 'otro'];
  if (name.length < 2) throw new AppError('Escribe tu nombre completo.', { field: 'name' });
  if (!isEmail(email)) throw new AppError('Escribe un correo electrónico válido.', { field: 'email' });
  if (!KINDS.includes(kind)) throw new AppError('Elige el tipo de solicitud.', { field: 'kind' });
  if (message.length < 10) throw new AppError('Describe tu solicitud con un poco más de detalle.', { field: 'message' });
  const r = ctx.db.prepare('INSERT INTO privacy_requests (user_id, name, email, kind, message, created_at) VALUES (?,?,?,?,?,?)')
    .run(user?.id ?? null, name, email, kind, message, ctx.now());
  const id = Number(r.lastInsertRowid);
  ctx.mailer.sendAdmin(emails.adminAlert({
    title: `Solicitud de privacidad #${id} (${kind})`,
    body: `Llegó una solicitud de derechos de privacidad. Plazo legal de respuesta: 20 días hábiles (México) / un mes (RGPD).`,
    url: `${ctx.config.baseUrl}/admin/privacidad`,
  }));
  return id;
}

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, signUp, signUpAdmin, makeWork, ADDRESS } from './helpers.js';
import { createAuction } from '../src/services/auctions.js';
import { startJobs } from '../src/app.js';

let t;
before(async () => { t = await boot(); });
after(async () => { await t.close(); });

const PW = 'una frase larga y segura';

test('acceso / portabilidad: la descarga incluye todos los datos de la persona, y solo los suyos', async () => {
  const w = makeWork(t);
  const a = await signUp(t, { name: 'Ana Titular' });
  const b = await signUp(t, { name: 'Beto Ajeno' });
  await a.client.post(`/comprar/${w.code}`, { ...ADDRESS, acceptTerms: '1', saveAddress: '1', ownerNamePublic: '1' });
  await b.client.post('/cuenta/direccion', { ...ADDRESS, recipient: 'Beto Ajeno', line1: 'Calle Ajena 99' });

  assert.equal((await t.client().get('/cuenta/mis-datos.json')).status, 303, 'requiere sesión');
  const res = await a.client.get('/cuenta/mis-datos.json');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const d = res.json();
  assert.equal(d.cuenta.correo, a.email);
  assert.equal(d.cuenta.nombre, 'Ana Titular');
  assert.equal(d.direccionGuardada.linea1, 'Av. Siempre Viva 742');
  assert.equal(d.pedidos.length, 1);
  assert.equal(d.pedidos[0].envioA.ciudad, 'Ciudad de México');
  assert.equal(d.pedidos[0].nombrePublicoEnCertificado, true);
  assert.deepEqual(d.consentimientos.map((c) => c.tipo), ['privacy', 'terms', 'terms', 'owner_name_public']);
  assert.ok(d.sesiones.length >= 1 && d.actividadDeSeguridad.length >= 1);
  assert.ok(!res.text.includes('Beto') && !res.text.includes('Calle Ajena') && !res.text.includes('scrypt'));
});

test('rectificación y consentimientos: perfil editable, marketing con constancia de alta y baja', async () => {
  const { client, user } = await signUp(t);
  assert.equal((await client.post('/cuenta/perfil', { name: 'Nombre Corregido', phone: 'no-es-telefono', country: 'MX' })).status, 400);
  await client.post('/cuenta/perfil', { name: 'Nombre Corregido', phone: '+34 600 000 000', country: 'ES' });
  const u = t.ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  assert.equal(u.name, 'Nombre Corregido');
  assert.equal(u.country, 'ES');

  await client.post('/cuenta/consentimientos', { marketing: '1' });
  await client.post('/cuenta/consentimientos', {});
  const log = t.ctx.db.prepare(`SELECT granted FROM consents WHERE user_id = ? AND kind = 'marketing' ORDER BY id`).all(user.id);
  assert.deepEqual(log.map((x) => x.granted), [1, 0]);
  assert.equal(t.ctx.db.prepare('SELECT marketing_opt_in m FROM users WHERE id = ?').get(user.id).m, 0);
  await client.post('/cuenta/direccion', ADDRESS);
  await client.post('/cuenta/direccion/eliminar');
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM addresses WHERE user_id = ?').get(user.id).n, 0);
});

test('supresión: exige contraseña y se bloquea mientras haya un pedido en curso', async () => {
  const w = makeWork(t);
  const { client, user } = await signUp(t);
  const r = await client.post(`/comprar/${w.code}`, { ...ADDRESS, acceptTerms: '1' });
  const code = r.location.match(/P-[A-Z0-9]+/)[0];
  assert.equal((await client.post('/cuenta/eliminar', { password: 'incorrecta-incorrecta' })).status, 400);
  const blocked = await client.post('/cuenta/eliminar', { password: PW });
  assert.equal(blocked.status, 400);
  assert.ok(blocked.text.includes(code));
  assert.equal(t.ctx.db.prepare('SELECT deleted_at FROM users WHERE id = ?').get(user.id).deleted_at, null);
});

test('supresión: borra o anonimiza todo, conserva bloqueado solo lo que exige la ley', async () => {
  const w = makeWork(t);
  const admin = await signUpAdmin(t);
  const { client, user, email } = await signUp(t, { name: 'Persona Que Se Va' });
  // Un pedido entregado (debe conservarse por obligación fiscal) y una puja en una subasta ya cerrada.
  const r = await client.post(`/comprar/${w.code}`, { ...ADDRESS, acceptTerms: '1', saveAddress: '1' });
  const code = r.location.match(/P-[A-Z0-9]+/)[0];
  for (const step of ['confirm_payment', 'ship', 'deliver']) await admin.client.post(`/admin/pedidos/${code}/${step}`);
  const w2 = makeWork(t);
  const auctionId = createAuction(t.ctx, { workId: w2.id, startsAt: t.clock.t, endsAt: t.clock.t + 3600_000, startCents: 100000, incrementCents: 10000 });
  await client.post(`/subastas/${auctionId}/registro`, { acceptRules: '1', binding: '1' });
  await client.request('POST', `/subastas/${auctionId}/pujas`, { json: { amount: '1000' } });

  const leading = await client.post('/cuenta/eliminar', { password: PW });
  assert.equal(leading.status, 400, 'no puede irse con la puja más alta en una subasta abierta');
  t.ctx.db.prepare(`UPDATE auctions SET status = 'unsold' WHERE id = ?`).run(auctionId);

  const done = await client.post('/cuenta/eliminar', { password: PW });
  assert.equal(done.location, '/?m=deleted');
  const u = t.ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  assert.ok(u.deleted_at);
  assert.equal(u.name, null); assert.equal(u.phone, null); assert.equal(u.password_hash, null); assert.equal(u.country, null);
  assert.ok(!u.email.includes('persona'));
  const count = (sql) => t.ctx.db.prepare(sql).get(user.id).n;
  assert.equal(count('SELECT COUNT(*) n FROM sessions WHERE user_id = ?'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM addresses WHERE user_id = ?'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM tokens WHERE user_id = ?'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM bids WHERE user_id = ? AND ip IS NOT NULL'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM consents WHERE user_id = ? AND (ip IS NOT NULL OR user_agent IS NOT NULL)'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM audit_log WHERE user_id = ? AND ip IS NOT NULL'), 0);
  assert.equal(count('SELECT COUNT(*) n FROM orders WHERE user_id = ?'), 1, 'el comprobante de compra se conserva bloqueado');
  assert.equal(count('SELECT COUNT(*) n FROM bids WHERE user_id = ?'), 1, 'la puja queda, anónima');

  assert.equal((await client.get('/cuenta')).status, 303, 'la sesión dejó de existir');
  assert.equal((await t.client().post('/cuenta/entrar', { email, password: PW })).status, 401);
  assert.match((await t.lastMail(email)).subject, /cuenta fue eliminada/);
  // El correo queda libre para volver a registrarse.
  const again = await t.client().post('/cuenta/registro', { name: 'De Vuelta', email, country: 'MX', password: PW, adult: '1', acceptLegal: '1' });
  assert.equal(again.status, 303);
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM users WHERE email = ?').get(email).n, 1);
  // El panel de administración ya no muestra sus datos.
  assert.ok(!(await admin.client.get('/admin/usuarios')).text.includes('Persona Que Se Va'));
});

test('formulario de derechos (ARCO): abierto sin cuenta, llega al panel y se avisa al responsable', async () => {
  const c = t.client();
  assert.equal((await c.get('/privacidad/solicitud')).status, 200);
  assert.equal((await c.post('/privacidad/solicitud', { name: 'X', email: 'no', kind: 'acceso', message: 'corta' })).status, 400);
  const ok = await c.post('/privacidad/solicitud', { name: 'Visitante Sin Cuenta', email: 'visitante@test.local', kind: 'cancelacion', message: 'Solicito que eliminen todos mis datos personales.' });
  assert.equal(ok.location, '/privacidad/solicitud?m=request_sent');
  assert.match((await t.lastMail('admin@test.local')).subject, /Solicitud de privacidad/);
  const admin = await signUpAdmin(t);
  const panel = await admin.client.get('/admin/privacidad');
  assert.ok(panel.text.includes('Visitante Sin Cuenta') && panel.text.includes('ABIERTA'));
  const id = t.ctx.db.prepare(`SELECT id FROM privacy_requests WHERE email = 'visitante@test.local'`).get().id;
  await admin.client.post(`/admin/privacidad/${id}/resolver`, { notes: 'Sin cuenta ni pedidos; se respondió por correo.' });
  assert.equal(t.ctx.db.prepare('SELECT status FROM privacy_requests WHERE id = ?').get(id).status, 'resolved');
});

test('conservación automática: sesiones vencidas, IP de bitácora a los 12 meses, cuentas sin verificar a los 30 días', async () => {
  const stale = await signUp(t, { verify: false });
  const kept = await signUp(t);
  t.clock.t += 31 * 24 * 3600_000;
  let stop = startJobs(t.ctx); stop();
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM users WHERE id = ?').get(stale.user.id).n, 0, 'cuenta sin verificar eliminada');
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM users WHERE id = ?').get(kept.user.id).n, 1);
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ?').get(kept.user.id).n, 0, 'sesión de 30 días sin uso eliminada');
  assert.ok(t.ctx.db.prepare('SELECT COUNT(*) n FROM audit_log WHERE user_id = ? AND ip IS NOT NULL').get(kept.user.id).n > 0);
  t.clock.t += 366 * 24 * 3600_000;
  stop = startJobs(t.ctx); stop();
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM audit_log WHERE user_id = ? AND ip IS NOT NULL').get(kept.user.id).n, 0);
});

test('documentos legales: publicados en español e inglés, y señalan lo que falta configurar', async () => {
  const c = t.client();
  for (const [url, needle] of [
    ['/legal/privacidad', 'Aviso de Privacidad Integral'], ['/legal/privacy', 'Privacy Notice'],
    ['/legal/terminos', 'Reglas de Subasta'], ['/legal/terms', 'Auction Rules'], ['/legal/cookies', 'estrictamente necesaria'],
  ]) {
    const r = await c.get(url);
    assert.equal(r.status, 200, url);
    assert.ok(r.text.includes(needle), url);
  }
  const es = (await c.get('/legal/privacidad')).text;
  assert.ok(es.includes('[PENDIENTE: nombre legal completo del responsable]'), 'marca los datos del responsable sin configurar');
  for (const s of ['ARCO', 'RGPD', 'LGPD', 'CCPA', '20 días hábiles', 'Secretaría Anticorrupción y Buen Gobierno', 'No vendemos']) assert.ok(es.includes(s), s);
  assert.ok((await c.get('/')).text.includes('/legal/privacidad'), 'el aviso está enlazado desde la portada');

  const t2 = await boot({ LEGAL_NAME: 'Nombre Legal SA', LEGAL_ADDRESS: 'Calle 1, CDMX, México', PRIVACY_EMAIL: 'privacidad@test.local', HOSTING_LOCATION: 'Estados Unidos', EMAIL_PROVIDER: 'Proveedor X' });
  try {
    const full = (await t2.client().get('/legal/privacidad')).text;
    assert.ok(full.includes('Nombre Legal SA') && full.includes('privacidad@test.local'));
    assert.ok(!full.includes('PENDIENTE'));
  } finally { await t2.close(); }
});

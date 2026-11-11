import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, signUp, tokenFrom } from './helpers.js';

let t;
before(async () => { t = await boot(); });
after(async () => { await t.close(); });

const PW = 'una frase larga y segura';
const reg = (email, extra = {}) => ({ name: 'Ana Prueba', email, country: 'MX', password: PW, adult: '1', acceptLegal: '1', ...extra });

test('registro: exige mayoría de edad, aceptación legal y contraseña suficiente', async () => {
  const c = t.client();
  assert.equal((await c.post('/cuenta/registro', reg('a1@test.local', { adult: '' }))).status, 400);
  assert.equal((await c.post('/cuenta/registro', reg('a1@test.local', { acceptLegal: '' }))).status, 400);
  assert.equal((await c.post('/cuenta/registro', reg('a1@test.local', { password: 'corta' }))).status, 400);
  assert.equal((await c.post('/cuenta/registro', reg('no-es-correo'))).status, 400);
  assert.equal(t.ctx.db.prepare(`SELECT COUNT(*) n FROM users WHERE email = 'a1@test.local'`).get().n, 0);
});

test('registro: guarda la contraseña como hash, registra consentimientos y envía verificación', async () => {
  const c = t.client();
  const r = await c.post('/cuenta/registro', reg('a2@test.local', { marketing: '1' }));
  assert.equal(r.status, 303);
  assert.equal(r.location, '/cuenta/revisa-tu-correo');
  const u = t.ctx.db.prepare(`SELECT * FROM users WHERE email = 'a2@test.local'`).get();
  assert.match(u.password_hash, /^scrypt\$/);
  assert.ok(!u.password_hash.includes(PW));
  assert.equal(u.email_verified_at, null);
  const kinds = t.ctx.db.prepare('SELECT kind, granted FROM consents WHERE user_id = ? ORDER BY id').all(u.id).map((x) => x.kind);
  assert.deepEqual(kinds, ['privacy', 'terms', 'marketing']);

  const mail = await t.lastMail('a2@test.local');
  assert.match(mail.subject, /Confirma tu correo/);
  const v = await c.get(`/cuenta/verificar?token=${tokenFrom(mail)}`);
  assert.equal(v.location, '/cuenta/entrar?m=verified');
  assert.ok(t.ctx.db.prepare('SELECT email_verified_at FROM users WHERE id = ?').get(u.id).email_verified_at);
  // El enlace es de un solo uso.
  assert.equal((await c.get(`/cuenta/verificar?token=${tokenFrom(mail)}`)).location, '/cuenta/entrar?m=bad_token');
});

test('registro: el marketing NO se activa si no se marca la casilla', async () => {
  await t.client().post('/cuenta/registro', reg('a3@test.local'));
  const u = t.ctx.db.prepare(`SELECT * FROM users WHERE email = 'a3@test.local'`).get();
  assert.equal(u.marketing_opt_in, 0);
  assert.equal(t.ctx.db.prepare(`SELECT COUNT(*) n FROM consents WHERE user_id = ? AND kind = 'marketing'`).get(u.id).n, 0);
});

test('registro con correo ya existente: misma respuesta, sin duplicar ni revelar', async () => {
  const c = t.client();
  await c.post('/cuenta/registro', reg('dup@test.local'));
  const again = await c.post('/cuenta/registro', reg('DUP@test.local', { name: 'Otra Persona' }));
  assert.equal(again.status, 303);
  assert.equal(again.location, '/cuenta/revisa-tu-correo');
  assert.equal(t.ctx.db.prepare(`SELECT COUNT(*) n FROM users WHERE email = 'dup@test.local'`).get().n, 1);
  assert.match((await t.lastMail('dup@test.local')).subject, /Ya tienes una cuenta/);
});

test('sesión: cookie HttpOnly + SameSite, acceso a /cuenta y cierre de sesión', async () => {
  const { client, email } = await signUp(t);
  const page = await client.get('/cuenta');
  assert.equal(page.status, 200);
  assert.ok(page.text.includes(email));
  assert.equal(page.headers.get('cache-control'), 'no-store');

  const fresh = t.client();
  const login = await fresh.request('POST', '/cuenta/entrar', { form: { email, password: PW } });
  const cookie = login.headers.getSetCookie().find((x) => x.startsWith('sid='));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  // En la base solo se guarda el hash del identificador de sesión.
  const raw = cookie.split(';')[0].slice(4);
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM sessions WHERE id_hash = ?').get(raw).n, 0);

  assert.equal((await client.post('/cuenta/salir')).status, 303);
  assert.equal((await client.get('/cuenta')).status, 303);
});

test('inicio de sesión: mensaje genérico y bloqueo tras muchos intentos', async () => {
  const { email } = await signUp(t);
  const c = t.client();
  const bad = await c.post('/cuenta/entrar', { email, password: 'incorrecta-incorrecta' });
  assert.equal(bad.status, 401);
  const ghost = await c.post('/cuenta/entrar', { email: 'nadie@test.local', password: 'incorrecta-incorrecta' });
  assert.equal(ghost.status, 401);
  assert.ok(bad.text.includes('Correo o contraseña incorrectos') && ghost.text.includes('Correo o contraseña incorrectos'));

  t.ctx.db.prepare('UPDATE users SET failed_logins = 9 WHERE email = ?').run(email);
  await c.post('/cuenta/entrar', { email, password: 'incorrecta-incorrecta' });
  const locked = await c.post('/cuenta/entrar', { email, password: PW });
  assert.equal(locked.status, 429);
  t.clock.t += 16 * 60_000;
  assert.equal((await c.post('/cuenta/entrar', { email, password: PW })).status, 303);
});

test('CSRF: se rechaza todo POST que no venga del propio sitio', async () => {
  const { client } = await signUp(t);
  const cross = await client.post('/cuenta/perfil', { name: 'Hackeado', country: 'MX' }, { origin: 'https://evil.example' });
  assert.equal(cross.status, 403);
  const none = await client.post('/cuenta/perfil', { name: 'Hackeado', country: 'MX' }, { origin: null });
  assert.equal(none.status, 403);
  const fetchSite = await client.post('/cuenta/perfil', { name: 'Hackeado', country: 'MX' }, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(fetchSite.status, 403);
  assert.equal((await client.post('/cuenta/perfil', { name: 'Ana Editada', country: 'MX' })).status, 303);
});

test('recuperar contraseña: enlace de un solo uso que cierra todas las sesiones', async () => {
  const { client, email } = await signUp(t);
  const c = t.client();
  assert.equal((await c.post('/cuenta/recuperar', { email: 'nadie@test.local' })).status, 200);
  await c.post('/cuenta/recuperar', { email });
  const token = tokenFrom(await t.lastMail(email));
  assert.equal((await c.get(`/cuenta/restablecer?token=${token}`)).status, 200);
  assert.equal((await c.post('/cuenta/restablecer', { token, password: 'corta' })).status, 400);
  const done = await c.post('/cuenta/restablecer', { token, password: 'otra frase larga y nueva' });
  assert.equal(done.location, '/cuenta/entrar?m=reset_done');
  assert.equal((await client.get('/cuenta')).status, 303, 'la sesión anterior quedó cerrada');
  assert.equal((await c.post('/cuenta/restablecer', { token, password: 'otra frase larga y nueva' })).location, '/cuenta/recuperar?m=bad_token');
  assert.equal((await c.post('/cuenta/entrar', { email, password: PW })).status, 401);
  assert.equal((await c.post('/cuenta/entrar', { email, password: 'otra frase larga y nueva' })).status, 303);
});

test('redirección tras entrar: solo a rutas internas', async () => {
  const { email } = await signUp(t);
  const c = t.client();
  const r = await c.post('/cuenta/entrar', { email, password: PW, next: 'https://evil.example/x' });
  assert.equal(r.location, '/cuenta');
  const c2 = t.client();
  assert.equal((await c2.post('/cuenta/entrar', { email, password: PW, next: '//evil.example' })).location, '/cuenta');
  const c3 = t.client();
  assert.equal((await c3.post('/cuenta/entrar', { email, password: PW, next: '/obra/X-1' })).location, '/obra/X-1');
});

test('cabeceras de seguridad y páginas públicas sin cookies', async () => {
  const r = await t.client().get('/galeria');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.getSetCookie().length, 0, 'navegar sin cuenta no crea ninguna cookie');
  assert.ok(!/googleapis|gstatic|google-analytics|facebook/.test(r.text), 'sin recursos de terceros');
});

test('administración: invisible (404) para quien no es admin', async () => {
  const { client } = await signUp(t);
  assert.equal((await client.get('/admin')).status, 404);
  assert.equal((await client.get('/admin/pedidos')).status, 404);
  assert.equal((await t.client().get('/admin/usuarios')).status, 404);
});

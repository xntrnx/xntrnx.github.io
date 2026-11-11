import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { boot, signUpAdmin, signUp, makeSigner, TINY_PNG, ADDRESS } from './helpers.js';
import { verifyCertificate } from '../src/lib/cert.js';

let t, admin;
before(async () => { t = await boot(); admin = await signUpAdmin(t); });
after(async () => { await t.close(); });

function upload(client, url, field, filename, buffer, type) {
  const fd = new FormData();
  fd.append(field, new Blob([buffer], { type }), filename);
  return client.request('POST', url, { body: fd });
}
const work = (id) => t.ctx.db.prepare('SELECT * FROM works WHERE id = ?').get(id);

test('admin: crea una obra como borrador, sube fotos y la publica', async () => {
  const c = admin.client;
  assert.equal((await c.post('/admin/obras', { code: 'mal código!', title: 'X' })).status, 400);
  const created = await c.post('/admin/obras', { code: 'TLK-2026-900', title: 'Obra nueva', technique: 'Óleo', year: '2026', dimensions: '80 x 100 cm', price: '8,500' });
  assert.equal(created.status, 303);
  const id = Number(created.location.match(/obras\/(\d+)/)[1]);
  assert.equal(work(id).status, 'draft');
  assert.equal(work(id).price_cents, 850000);
  assert.equal((await t.client().get('/obra/TLK-2026-900')).status, 404, 'un borrador no es público');
  assert.equal((await c.post('/admin/obras', { code: 'TLK-2026-900', title: 'Repetida' })).status, 400);

  assert.equal((await upload(c, `/admin/obras/${id}/fotos`, 'photos', 'x.png', Buffer.from('<script>alert(1)</script>'), 'image/png')).status, 400, 'rechaza lo que no es imagen');
  assert.equal((await upload(c, `/admin/obras/${id}/fotos`, 'photos', 'foto.png', TINY_PNG, 'image/png')).status, 303);
  const photo = t.ctx.db.prepare('SELECT * FROM work_photos WHERE work_id = ?').get(id);
  assert.equal(photo.sha256, crypto.createHash('sha256').update(TINY_PNG).digest('hex'));
  const served = await fetch(`${t.base}/media/${photo.file}`);
  assert.equal(served.status, 200);
  assert.ok(Buffer.from(await served.arrayBuffer()).equals(TINY_PNG), 'la foto se sirve idéntica, byte por byte');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');

  await c.post(`/admin/obras/${id}`, { title: 'Obra nueva', price: '8500', status: 'available' });
  const pub = await t.client().get('/obra/TLK-2026-900');
  assert.equal(pub.status, 200);
  assert.ok(pub.text.includes('Comprar'));
  assert.ok((await t.client().get('/galeria')).text.includes('Obra nueva'));
});

test('certificado: solo se publica una credencial W3C con firma válida, de una llave vigente, de este sitio y de esta obra', async () => {
  const c = admin.client;
  const created = await c.post('/admin/obras', { code: 'TLK-2026-901', title: 'Con certificado', price: '5000', artform: 'Pintura', inscriptions: 'Firmada al reverso', features: 'Empaste grueso en la esquina superior' });
  const id = Number(created.location.match(/obras\/(\d+)/)[1]);
  await upload(c, `/admin/obras/${id}/fotos`, 'photos', 'foto.png', TINY_PNG, 'image/png');
  await c.post(`/admin/obras/${id}`, { title: 'Con certificado', price: '5000', status: 'available', artform: 'Pintura', inscriptions: 'Firmada al reverso', features: 'Empaste grueso en la esquina superior' });

  const cred = (await c.get(`/admin/obras/${id}/credencial.json`)).json();
  assert.equal(cred['@context'][0], 'https://www.w3.org/ns/credentials/v2');
  assert.deepEqual(cred.type, ['VerifiableCredential', 'ArtworkAuthenticityCredential']);
  assert.equal(cred.issuer.id, 'did:web:test.local');
  assert.match(cred.id, /^urn:uuid:/);
  const subj = cred.credentialSubject;
  assert.equal(subj.type, 'VisualArtwork');
  assert.equal(subj.identifier, 'TLK-2026-901');
  assert.equal(subj.currentOwner, 'Cecahuitl (artista)');
  assert.equal(subj.artform, 'Pintura');
  assert.equal(subj.inscriptions, 'Firmada al reverso');
  assert.equal(subj.distinguishingFeatures, 'Empaste grueso en la esquina superior');
  assert.equal(cred.relatedResource[0].digestSRI, 'sha256-' + crypto.createHash('sha256').update(TINY_PNG).digest('base64'));
  assert.equal(cred.relatedResource[0].mediaType, 'image/png');
  const put = (obj) => upload(c, `/admin/obras/${id}/certificado`, 'cert', 'cred.json', Buffer.from(JSON.stringify(obj)), 'application/json');

  assert.equal((await put(cred)).status, 400, 'sin firma');
  const stranger = makeSigner(t, { register: false });
  assert.equal((await put(stranger(cred))).status, 400, 'llave que no está en el historial');
  const revoked = makeSigner(t, { revoked: true });
  assert.equal((await put(revoked(cred))).status, 400, 'llave revocada');
  const sign = makeSigner(t);
  const good = sign(cred);
  assert.equal((await put({ ...good, credentialSubject: { ...good.credentialSubject, name: 'Alterado después de firmar' } })).status, 400, 'contenido alterado');
  assert.equal((await put(sign({ ...cred, credentialSubject: { ...subj, identifier: 'OTRA-OBRA' } }))).status, 400, 'credencial de otra obra');
  assert.equal((await put(sign({ ...cred, issuer: { id: 'did:web:otro-sitio.example', name: 'Otro' } }))).status, 400, 'emitida por otro sitio');
  assert.equal((await put(sign({ ...cred, relatedResource: [{ ...cred.relatedResource[0], digestSRI: 'sha256-AAAA' }] }))).status, 400, 'huella de foto distinta a la foto actual');
  assert.equal((await put(sign.legacy({ id: 'TLK-2026-901', titulo: 'Con certificado' }))).status, 400, 'el formato anterior ya no se emite');
  assert.equal(work(id).certificate_json, null);

  assert.equal((await put(good)).status, 303);
  const pub = await t.client().get('/obra/TLK-2026-901/certificado.json');
  assert.equal(pub.status, 200);
  const keys = (await t.client().get('/llaves.json')).json();
  assert.equal(verifyCertificate(pub.json(), keys, { did: 'did:web:test.local' }).ok, true);
  const page = await t.client().get('/obra/TLK-2026-901/certificado');
  assert.equal(page.status, 200);
  for (const s of ['Certificado de autenticidad', 'Firmada al reverso', '<svg', 'did:web:test.local', 'eddsa-jcs-2022']) assert.ok(page.text.includes(s), s);

  // Publicación por JSON (la firma hecha en el navegador del artista).
  const again = sign((await c.get(`/admin/obras/${id}/credencial.json`)).json());
  const viaJson = await c.request('POST', `/admin/obras/${id}/certificado.json`, { json: again });
  assert.equal(viaJson.status, 200);
  assert.equal(JSON.parse(work(id).certificate_json).id, again.id);
  assert.equal((await c.request('POST', `/admin/obras/${id}/certificado.json`, { json: { ...again, name: 'x' } })).status, 400);
  const other = await signUp(t);
  assert.equal((await other.client.request('POST', `/admin/obras/${id}/certificado.json`, { json: again })).status, 404, 'solo quien administra publica certificados');

  // Si después se cambia una foto, la credencial ya publicada deja de poder re-publicarse.
  await upload(c, `/admin/obras/${id}/fotos`, 'photos', 'otra.png', TINY_PNG, 'image/png');
  assert.equal((await put(good)).status, 400);
});

test('identidad del emisor: documento did:web con llaves Multikey; las revocadas dejan de ser válidas', async () => {
  const ok = makeSigner(t);
  const gone = makeSigner(t, { revoked: true });
  const res = await t.client().get('/.well-known/did.json');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/did\+json/);
  const did = res.json();
  assert.equal(did.id, 'did:web:test.local');
  const vm = (mk) => did.verificationMethod.find((m) => m.publicKeyMultibase === mk);
  assert.equal(vm(ok.multikey).type, 'Multikey');
  assert.match(ok.multikey, /^z6Mk/);
  assert.ok(did.assertionMethod.includes(`did:web:test.local#${ok.multikey}`));
  assert.ok(vm(gone.multikey).revoked);
  assert.ok(!did.assertionMethod.includes(`did:web:test.local#${gone.multikey}`));
  assert.equal((await t.client().get('/ns/coa')).status, 200);
});

test('certificado tras la venta: el nombre de quien compra solo aparece si lo autorizó', async () => {
  const c = admin.client;
  const mk = async (code) => {
    const r = await c.post('/admin/obras', { code, title: code, price: '5000' });
    const id = Number(r.location.match(/obras\/(\d+)/)[1]);
    await c.post(`/admin/obras/${id}`, { title: code, price: '5000', status: 'available' });
    return id;
  };
  const sell = async (code, extra) => {
    const buyer = await signUp(t, { name: 'Compradora Discreta' });
    const r = await buyer.client.post(`/comprar/${code}`, { ...ADDRESS, acceptTerms: '1', ...extra });
    await c.post(`/admin/pedidos/${r.location.match(/P-[A-Z0-9]+/)[0]}/confirm_payment`);
  };
  const idA = await mk('TLK-A'); const idB = await mk('TLK-B');
  await sell('TLK-A', {});
  await sell('TLK-B', { ownerNamePublic: '1' });
  assert.equal((await c.get(`/admin/obras/${idA}/credencial.json`)).json().credentialSubject.currentOwner, 'Colección privada');
  assert.equal((await c.get(`/admin/obras/${idB}/credencial.json`)).json().credentialSubject.currentOwner, 'Compradora Discreta');
});

test('admin: programa una subasta desde la ficha y no puede retirar una obra con pedido', async () => {
  const c = admin.client;
  const r = await c.post('/admin/obras', { code: 'TLK-SUB', title: 'Para subasta' });
  const id = Number(r.location.match(/obras\/(\d+)/)[1]);
  const form = { starts_ms: String(t.clock.t + 3600_000), ends_ms: String(t.clock.t + 7200_000), start: '5,000', increment: '500', reserve: '9000', extend: '5' };
  assert.equal((await c.post(`/admin/obras/${id}/subasta`, form)).status, 400, 'un borrador no se subasta');
  await c.post(`/admin/obras/${id}`, { title: 'Para subasta', status: 'available' });
  assert.equal((await c.post(`/admin/obras/${id}/subasta`, { ...form, reserve: '100' })).status, 400, 'reserva menor que la salida');
  assert.equal((await c.post(`/admin/obras/${id}/subasta`, form)).status, 303);
  const a = t.ctx.db.prepare('SELECT * FROM auctions WHERE work_id = ?').get(id);
  assert.equal(a.start_cents, 500000); assert.equal(a.reserve_cents, 900000); assert.equal(a.extend_seconds, 300);
  assert.equal((await c.post(`/admin/obras/${id}`, { title: 'Para subasta', status: 'draft' })).status, 400, 'con subasta activa no se oculta');
  assert.equal((await c.post(`/admin/obras/${id}/eliminar`)).status, 400);
  assert.equal((await c.post(`/admin/subastas/${a.id}/cancelar`)).status, 303);
  assert.equal(t.ctx.db.prepare('SELECT status FROM auctions WHERE id = ?').get(a.id).status, 'cancelled');
});

test('admin: las consultas a datos personales quedan en la bitácora', async () => {
  await admin.client.get('/admin/usuarios');
  const row = t.ctx.db.prepare(`SELECT * FROM audit_log WHERE action = 'users.admin_list' AND user_id = ?`).get(admin.user.id);
  assert.ok(row);
  assert.equal((await admin.client.get('/admin/auditoria')).status, 200);
  assert.equal((await admin.client.get('/admin')).status, 200);
});

test('herramientas de firma: keygen + sign-work producen una credencial que el sitio acepta', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = path.resolve(import.meta.dirname, '..');
  const tmp = fs.mkdtempSync(path.join(t.dir, 'sign-'));
  // Se trabaja sobre una copia de las herramientas para no tocar certs/keys.json del repositorio.
  fs.cpSync(path.join(root, 'tools'), path.join(tmp, 'tools'), { recursive: true });
  fs.cpSync(path.join(root, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'certs'));
  fs.writeFileSync(path.join(tmp, 'certs', 'keys.json'), '[]');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  execFileSync(process.execPath, ['tools/keygen.js'], { cwd: tmp });
  assert.equal(fs.statSync(path.join(tmp, 'private-key.pem')).mode & 0o777, 0o600);
  const file = path.join(tmp, 'cred.json');
  fs.writeFileSync(file, JSON.stringify({
    '@context': ['https://www.w3.org/ns/credentials/v2'], type: ['VerifiableCredential'], issuer: { id: 'did:web:test.local' },
    credentialSubject: { identifier: 'X-1', name: 'Prueba' },
  }));
  execFileSync(process.execPath, ['tools/sign-work.js', file], { cwd: tmp });
  const keysFile = path.join(tmp, 'certs', 'keys.json');
  const keys = () => JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  const signed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(signed.proof.cryptosuite, 'eddsa-jcs-2022');
  assert.equal(verifyCertificate(signed, keys(), { did: 'did:web:test.local' }).ok, true);
  assert.equal(verifyCertificate({ ...signed, credentialSubject: { identifier: 'X-2' } }, keys(), { did: 'did:web:test.local' }).ok, false);
  execFileSync(process.execPath, ['tools/revoke-key.js', keys()[0].publicKeyBase64], { cwd: tmp });
  assert.equal(verifyCertificate(signed, keys(), { did: 'did:web:test.local' }).ok, false);
});

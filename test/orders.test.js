import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, signUp, signUpAdmin, makeWork, fakePaypal, ADDRESS } from './helpers.js';
import { expireDue, scrubOldPii } from '../src/services/orders.js';

let t;
before(async () => { t = await boot({ SHIPPING_INTL_MXN: '1500' }); });
after(async () => { await t.close(); });

const buy = (client, code, extra = {}) => client.post(`/comprar/${code}`, { ...ADDRESS, acceptTerms: '1', saveAddress: '1', ...extra });
const workStatus = (id) => t.ctx.db.prepare('SELECT status FROM works WHERE id = ?').get(id).status;
const order = (code) => t.ctx.db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
const codeOf = (res) => res.location.match(/\/pedidos\/(P-[A-Z0-9]+)/)[1];

test('comprar exige sesión, correo verificado y aceptar los términos', async () => {
  const w = makeWork(t);
  assert.match((await t.client().get(`/comprar/${w.code}`)).location, /^\/cuenta\/entrar\?next=/);
  const unverified = await signUp(t, { verify: false });
  assert.equal((await buy(unverified.client, w.code)).location, '/cuenta?m=need_verify');
  const { client } = await signUp(t);
  assert.equal((await buy(client, w.code, { acceptTerms: '' })).status, 400);
  assert.equal((await buy(client, w.code, { line1: '' })).status, 400);
  assert.equal(workStatus(w.id), 'available');
});

test('una obra única no puede venderse dos veces', async () => {
  const w = makeWork(t);
  const a = await signUp(t);
  const b = await signUp(t);
  const first = await buy(a.client, w.code);
  assert.equal(first.status, 303);
  const o = order(codeOf(first));
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.total_cents, 850000, 'envío nacional incluido');
  assert.equal(workStatus(w.id), 'reserved');

  const second = await buy(b.client, w.code);
  assert.equal(second.status, 409);
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM orders WHERE work_id = ?').get(w.id).n, 1);

  // Garantía de fondo: el índice único impide un segundo pedido vigente aunque se salte la lógica.
  assert.throws(() => t.ctx.db.prepare(`INSERT INTO orders (code, user_id, work_id, source, subtotal_cents, total_cents, currency, status, created_at, updated_at)
    VALUES ('P-DUPLICADO', ?, ?, 'purchase', 1, 1, 'MXN', 'pending_payment', 1, 1)`).run(b.user.id, w.id), /UNIQUE/);
});

test('el pedido es privado: otra cuenta recibe 404', async () => {
  const w = makeWork(t);
  const a = await signUp(t);
  const b = await signUp(t);
  const code = codeOf(await buy(a.client, w.code));
  assert.equal((await a.client.get(`/pedidos/${code}`)).status, 200);
  assert.equal((await b.client.get(`/pedidos/${code}`)).status, 404);
  assert.equal((await b.client.post(`/pedidos/${code}/cancelar`)).status, 404);
  assert.equal((await t.client().get(`/pedidos/${code}`)).status, 303);
});

test('envío internacional se suma al total', async () => {
  const w = makeWork(t);
  const { client } = await signUp(t);
  const o = order(codeOf(await buy(client, w.code, { country: 'ES', state: 'Madrid', city: 'Madrid', postal_code: '28001' })));
  assert.equal(o.shipping_cents, 150000);
  assert.equal(o.total_cents, 850000 + 150000);
});

test('un pedido sin pago vence y libera la obra', async () => {
  const w = makeWork(t);
  const { client, email } = await signUp(t);
  const code = codeOf(await buy(client, w.code));
  t.clock.t += 23 * 3600_000;
  expireDue(t.ctx);
  assert.equal(order(code).status, 'pending_payment', 'dentro del plazo sigue apartada');
  t.clock.t += 2 * 3600_000;
  expireDue(t.ctx);
  assert.equal(order(code).status, 'expired');
  assert.equal(workStatus(w.id), 'available');
  assert.match((await t.lastMail(email)).subject, /vencido/);
});

test('cancelar antes de pagar libera la obra', async () => {
  const w = makeWork(t);
  const { client } = await signUp(t);
  const code = codeOf(await buy(client, w.code));
  assert.equal((await client.post(`/pedidos/${code}/cancelar`)).location, '/cuenta?m=order_cancelled');
  assert.equal(order(code).status, 'cancelled');
  assert.equal(workStatus(w.id), 'available');
});

test('SPEI: aviso -> revisión -> el admin confirma -> vendida -> enviada -> entregada', async () => {
  const w = makeWork(t);
  const admin = await signUpAdmin(t);
  const { client, email } = await signUp(t);
  const code = codeOf(await buy(client, w.code));

  const page = await client.get(`/pedidos/${code}`);
  assert.ok(page.text.includes('012345678901234567'), 'muestra la CLABE');
  assert.equal((await client.post(`/pedidos/${code}/spei`, { ref: 'RASTREO123' })).location, `/pedidos/${code}?m=spei_sent`);
  assert.equal(order(code).status, 'payment_review');
  assert.equal(order(code).expires_at, null, 'en revisión no vence solo');
  assert.match((await t.lastMail('admin@test.local')).subject, /SPEI por confirmar/);

  // La persona compradora no puede confirmarse el pago a sí misma.
  assert.equal((await client.post(`/admin/pedidos/${code}/confirm_payment`)).status, 404);
  assert.equal(order(code).status, 'payment_review');

  assert.equal((await admin.client.post(`/admin/pedidos/${code}/confirm_payment`)).status, 303);
  assert.equal(order(code).status, 'paid');
  assert.equal(workStatus(w.id), 'sold');
  assert.match((await t.lastMail(email)).subject, /Pago confirmado/);

  await admin.client.post(`/admin/pedidos/${code}/ship`, { tracking: 'DHL 123456' });
  assert.equal(order(code).status, 'shipped');
  assert.ok((await t.lastMail(email)).text.includes('DHL 123456'));
  await admin.client.post(`/admin/pedidos/${code}/deliver`);
  assert.equal(order(code).status, 'delivered');
  // Una acción fuera de lugar no cambia nada.
  assert.equal((await admin.client.post(`/admin/pedidos/${code}/cancel`)).status, 409);
  assert.equal(order(code).status, 'delivered');
});

test('PayPal: el importe lo fija el servidor y la captura se valida contra el pedido', async () => {
  const w = makeWork(t, { priceCents: 1234500 });
  const calls = fakePaypal(t);
  const { client } = await signUp(t);
  const code = codeOf(await buy(client, w.code));

  const start = await client.post(`/pedidos/${code}/paypal`, { amount: '1.00' }); // un importe enviado por el navegador se ignora
  assert.equal(start.status, 303);
  assert.match(start.location, /^https:\/\/www\.sandbox\.paypal\.com\//);
  const created = calls.find((c) => c.path === '/v2/checkout/orders');
  assert.equal(created.body.purchase_units[0].amount.value, '12345.00');
  assert.equal(created.body.purchase_units[0].amount.currency_code, 'MXN');
  assert.equal(created.body.purchase_units[0].custom_id, code);
  assert.ok(!JSON.stringify(created.body).includes('Siempre Viva'), 'la dirección no se envía a PayPal');

  // Un token que no corresponde al pedido no captura nada.
  assert.equal((await client.get(`/pedidos/${code}/paypal/retorno?token=OTRO`)).status, 409);
  assert.equal(order(code).status, 'pending_payment');

  const back = await client.get(`/pedidos/${code}/paypal/retorno?token=${order(code).paypal_order_id}`);
  assert.equal(back.location, `/pedidos/${code}?m=paid`);
  assert.equal(order(code).status, 'paid');
  assert.equal(order(code).paypal_capture_id, 'CAP-PP1');
  assert.equal(workStatus(w.id), 'sold');
  // Recargar la página de retorno no duplica nada.
  assert.equal((await client.get(`/pedidos/${code}/paypal/retorno?token=PP1`)).location, `/pedidos/${code}?m=paid`);
});

test('PayPal: una captura por otro importe NO marca el pedido como pagado', async () => {
  const w = makeWork(t);
  fakePaypal(t, { captureAmount: { currency_code: 'MXN', value: '1.00' } });
  const { client } = await signUp(t);
  const code = codeOf(await buy(client, w.code));
  await client.post(`/pedidos/${code}/paypal`);
  const back = await client.get(`/pedidos/${code}/paypal/retorno?token=${order(code).paypal_order_id}`);
  assert.equal(back.status, 409);
  assert.equal(order(code).status, 'pending_payment');
  assert.equal(workStatus(w.id), 'reserved');
  assert.match((await t.lastMail('admin@test.local')).subject, /Revisar pago PayPal/);
});

test('PayPal: un pago que llega tarde, con la obra ya apartada por otra persona, queda para reembolso', async () => {
  const w = makeWork(t);
  fakePaypal(t);
  const a = await signUp(t);
  const b = await signUp(t);
  const code = codeOf(await buy(a.client, w.code));
  t.clock.t += 23.8 * 3600_000;
  await a.client.post(`/pedidos/${code}/paypal`); // alarga el apartado 30 minutos
  t.clock.t += 40 * 60_000;
  expireDue(t.ctx);
  assert.equal(order(code).status, 'expired');
  assert.equal((await buy(b.client, w.code)).status, 303); // otra persona la aparta
  const back = await a.client.get(`/pedidos/${code}/paypal/retorno?token=${order(code).paypal_order_id}`);
  assert.equal(back.location, `/pedidos/${code}?m=refund_due`);
  assert.equal(order(code).status, 'refund_due');
  assert.equal(workStatus(w.id), 'reserved', 'sigue apartada para la segunda persona');
  assert.match((await t.lastMail('admin@test.local')).subject, /REEMBOLSO pendiente/);
});

test('cambiar la dirección recalcula el envío e invalida la orden de PayPal previa', async () => {
  const w = makeWork(t);
  fakePaypal(t);
  const { client } = await signUp(t);
  const code = codeOf(await buy(client, w.code));
  await client.post(`/pedidos/${code}/paypal`);
  assert.ok(order(code).paypal_order_id);
  await client.post(`/pedidos/${code}/direccion`, { ...ADDRESS, country: 'FR', city: 'Paris', state: 'IDF', postal_code: '75001' });
  const o = order(code);
  assert.equal(o.total_cents, 850000 + 150000);
  assert.equal(o.paypal_order_id, null);
  const page = await client.get(`/pedidos/${code}`);
  assert.ok(page.text.includes('14 días'), 'informa el derecho de desistimiento a compradores de la UE');
});

test('conservación: tras 6 años se borran los datos de envío de pedidos cerrados', async () => {
  const w = makeWork(t);
  const { client } = await signUp(t);
  const code = codeOf(await buy(client, w.code));
  await client.post(`/pedidos/${code}/cancelar`);
  t.clock.t += 5 * 365 * 24 * 3600_000;
  scrubOldPii(t.ctx);
  assert.equal(order(code).ship_line1, 'Av. Siempre Viva 742');
  t.clock.t += 1.1 * 365 * 24 * 3600_000;
  scrubOldPii(t.ctx);
  const o = order(code);
  assert.equal(o.ship_line1, null);
  assert.equal(o.ship_recipient, null);
  assert.equal(o.ship_phone, null);
  assert.ok(o.pii_scrubbed_at);
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, signUp, makeWork, ADDRESS } from './helpers.js';
import { createAuction, tick, getAuction } from '../src/services/auctions.js';
import { expireDue } from '../src/services/orders.js';

let t;
before(async () => { t = await boot(); });
after(async () => { await t.close(); });

const MIN = 60_000;
function auction(opts = {}) {
  const w = makeWork(t, { priceCents: null });
  const now = t.clock.t;
  const id = createAuction(t.ctx, {
    workId: w.id, startsAt: now, endsAt: now + 60 * MIN, startCents: 500000, incrementCents: 50000,
    reserveCents: null, extendSeconds: 300, ...opts,
  });
  return { id, work: w };
}
const join = (client, id) => client.post(`/subastas/${id}/registro`, { acceptRules: '1', binding: '1' });
const bid = (client, id, amount) => client.request('POST', `/subastas/${id}/pujas`, { json: { amount: String(amount) } });
const state = async (id) => (await t.client().get(`/subastas/${id}/estado`)).json();

test('registro a la subasta: exige sesión, correo verificado, teléfono y aceptar las reglas', async () => {
  const { id } = auction();
  assert.match((await join(t.client(), id)).location, /^\/cuenta\/entrar/);
  const unverified = await signUp(t, { verify: false });
  assert.equal((await join(unverified.client, id)).location, '/cuenta?m=need_verify');
  const noPhone = await signUp(t, { phone: null });
  assert.equal((await join(noPhone.client, id)).status, 403);
  const ok = await signUp(t);
  assert.equal((await ok.client.post(`/subastas/${id}/registro`, { acceptRules: '1' })).status, 400, 'falta confirmar que la puja es vinculante');
  assert.equal((await join(ok.client, id)).status, 303);
  const consent = t.ctx.db.prepare(`SELECT * FROM consents WHERE user_id = ? AND kind = 'auction_rules'`).get(ok.user.id);
  assert.ok(consent.granted && consent.version);
  // No se puede pujar sin registrarse.
  const other = await signUp(t);
  assert.equal((await bid(other.client, id, 5000)).status, 403);
});

test('reglas de puja: mínimo, incremento, no superarse a sí mismo, freno de errores', async () => {
  const { id } = auction();
  const a = await signUp(t);
  const b = await signUp(t);
  await join(a.client, id); await join(b.client, id);

  assert.equal((await bid(a.client, id, 4999)).status, 409, 'debajo del precio de salida');
  assert.equal((await bid(a.client, id, 'abc')).status, 400);
  assert.equal((await bid(a.client, id, 5000)).status, 200);
  assert.equal((await bid(a.client, id, 6000)).status, 409, 'ya tiene la puja más alta');
  const low = await bid(b.client, id, 5400);
  assert.equal(low.status, 409);
  assert.equal(low.json().state.minNextCents, 550000);
  assert.equal((await bid(b.client, id, 550000)).status, 400, 'cien veces el mínimo: probable error de dedo');
  const ok = await bid(b.client, id, 5500);
  assert.equal(ok.status, 200);
  assert.equal(ok.json().state.currentCents, 550000);
  assert.equal(ok.json().state.bidCount, 2);
  assert.match((await t.lastMail(a.email)).subject, /Superaron tu puja/);
});

test('el estado público solo muestra paletas: ningún dato personal', async () => {
  const { id } = auction();
  const a = await signUp(t, { name: 'Nombre Secreto Uno' });
  await join(a.client, id);
  await bid(a.client, id, 5000);
  const raw = (await t.client().get(`/subastas/${id}/estado`)).text;
  assert.ok(!raw.includes('Secreto') && !raw.includes(a.email) && !raw.includes('user'));
  const s = JSON.parse(raw);
  assert.deepEqual(Object.keys(s.bids[0]).sort(), ['amountCents', 'at', 'paddle']);
  assert.equal(s.topPaddle, 1);
  // La página de la obra tampoco lo revela a otras personas.
  const w = t.ctx.db.prepare('SELECT code FROM works WHERE id = ?').get(getAuction(t.ctx, id).work_id);
  const page = (await t.client().get(`/obra/${w.code}`)).text;
  assert.ok(page.includes('Paleta 1') && !page.includes('Secreto'));
});

test('precio de reserva: se informa si se alcanzó, nunca su importe', async () => {
  const { id } = auction({ reserveCents: 900000 });
  const a = await signUp(t);
  await join(a.client, id);
  await bid(a.client, id, 5000);
  const raw = (await t.client().get(`/subastas/${id}/estado`)).text;
  assert.ok(!raw.includes('900000'));
  assert.equal(JSON.parse(raw).reserveMet, false);
});

test('prórroga: una puja en los últimos minutos recorre el cierre', async () => {
  const { id } = auction();
  const a = await signUp(t);
  const b = await signUp(t);
  await join(a.client, id); await join(b.client, id);
  const end = getAuction(t.ctx, id).ends_at;
  t.clock.t = end - 10 * MIN;
  await bid(a.client, id, 5000);
  assert.equal(getAuction(t.ctx, id).ends_at, end, 'fuera de la ventana no se recorre');
  t.clock.t = end - 2 * MIN;
  await bid(b.client, id, 5500);
  assert.equal(getAuction(t.ctx, id).ends_at, t.clock.t + 5 * MIN);
  assert.equal((await state(id)).extended, true);
  // A la hora original todavía no cierra.
  t.clock.t = end + 1000;
  tick(t.ctx);
  assert.equal(getAuction(t.ctx, id).status, 'live');
  assert.equal((await bid(a.client, id, 6000)).status, 200);
});

test('cierre: gana la puja más alta, se crea su pedido y la obra queda apartada', async () => {
  const { id, work } = auction();
  const a = await signUp(t);
  const b = await signUp(t);
  await join(a.client, id); await join(b.client, id);
  await bid(a.client, id, 5000);
  await bid(b.client, id, 7000);
  t.clock.t = getAuction(t.ctx, id).ends_at + 1;
  assert.equal((await bid(a.client, id, 9000)).status, 409, 'después de la hora ya no entra');
  tick(t.ctx);

  const au = getAuction(t.ctx, id);
  assert.equal(au.status, 'sold');
  const o = t.ctx.db.prepare('SELECT * FROM orders WHERE auction_id = ?').get(id);
  assert.equal(o.user_id, b.user.id);
  assert.equal(o.subtotal_cents, 700000);
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.expires_at, t.clock.t + 72 * 3600_000);
  assert.equal(t.ctx.db.prepare('SELECT status FROM works WHERE id = ?').get(work.id).status, 'reserved');
  assert.match((await t.lastMail(b.email)).subject, /Ganaste la subasta/);
  tick(t.ctx);
  assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM orders WHERE auction_id = ?').get(id).n, 1, 'cerrar dos veces no duplica el pedido');

  // Quien gana indica su dirección y entonces puede pagar; quien perdió no ve el pedido.
  assert.equal((await a.client.get(`/pedidos/${o.code}`)).status, 404);
  const page = await b.client.get(`/pedidos/${o.code}`);
  assert.ok(page.text.includes('Dirección de envío') && !page.text.includes('Ya transferí'));
  await b.client.post(`/pedidos/${o.code}/direccion`, ADDRESS);
  assert.ok((await b.client.get(`/pedidos/${o.code}`)).text.includes('Ya transferí'));
  // Un pedido de subasta no se cancela desde la cuenta: la puja es vinculante.
  assert.equal((await b.client.post(`/pedidos/${o.code}/cancelar`)).status, 409);
});

test('cierre sin alcanzar la reserva o sin pujas: no hay venta y la obra sigue disponible', async () => {
  const withReserve = auction({ reserveCents: 900000 });
  const a = await signUp(t);
  await join(a.client, withReserve.id);
  await bid(a.client, withReserve.id, 5000);
  const empty = auction();
  t.clock.t = Math.max(getAuction(t.ctx, withReserve.id).ends_at, getAuction(t.ctx, empty.id).ends_at) + 1;
  tick(t.ctx);
  for (const x of [withReserve, empty]) {
    assert.equal(getAuction(t.ctx, x.id).status, 'unsold');
    assert.equal(t.ctx.db.prepare('SELECT status FROM works WHERE id = ?').get(x.work.id).status, 'available');
    assert.equal(t.ctx.db.prepare('SELECT COUNT(*) n FROM orders WHERE auction_id = ?').get(x.id).n, 0);
  }
});

test('si quien gana no paga en 72 horas, el pedido vence y la obra se libera', async () => {
  const { id, work } = auction();
  const a = await signUp(t);
  await join(a.client, id);
  await bid(a.client, id, 5000);
  t.clock.t = getAuction(t.ctx, id).ends_at + 1;
  tick(t.ctx);
  t.clock.t += 73 * 3600_000;
  expireDue(t.ctx);
  assert.equal(t.ctx.db.prepare('SELECT status FROM orders WHERE auction_id = ?').get(id).status, 'expired');
  assert.equal(t.ctx.db.prepare('SELECT status FROM works WHERE id = ?').get(work.id).status, 'available');
  assert.match((await t.lastMail('admin@test.local')).subject, /Subasta sin pago/);
});

test('una obra en subasta no puede comprarse directamente, ni subastarse dos veces', async () => {
  const w = makeWork(t);
  const now = t.clock.t;
  const args = { workId: w.id, startsAt: now + 60 * MIN, endsAt: now + 120 * MIN, startCents: 100000, incrementCents: 10000 };
  const id = createAuction(t.ctx, args);
  assert.equal(getAuction(t.ctx, id).status, 'scheduled');
  assert.throws(() => createAuction(t.ctx, args), /ya tiene una subasta activa/);
  const { client } = await signUp(t);
  const r = await client.post(`/comprar/${w.code}`, { ...ADDRESS, acceptTerms: '1' });
  assert.equal(r.status, 409);
  await join(client, id);
  assert.equal((await bid(client, id, 1000)).status, 409, 'todavía no empieza');
  t.clock.t = now + 61 * MIN;
  tick(t.ctx);
  assert.equal(getAuction(t.ctx, id).status, 'live');
  assert.equal((await bid(client, id, 1000)).status, 200);
});

test('flujo en vivo (SSE): entrega el estado inicial y cada puja nueva', async () => {
  const { id } = auction();
  const a = await signUp(t);
  await join(a.client, id);
  const res = await fetch(`${t.base}/subastas/${id}/eventos`);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const nextState = async () => {
    for (;;) {
      const m = buf.match(/event: state\ndata: (.*)\n\n/);
      if (m) { buf = buf.slice(m.index + m[0].length); return JSON.parse(m[1]); }
      const { value, done } = await reader.read();
      if (done) throw new Error('flujo cerrado');
      buf += dec.decode(value, { stream: true });
    }
  };
  assert.equal((await nextState()).bidCount, 0);
  await bid(a.client, id, 5000);
  const s = await nextState();
  assert.equal(s.bidCount, 1);
  assert.equal(s.currentCents, 500000);
  await reader.cancel();
});

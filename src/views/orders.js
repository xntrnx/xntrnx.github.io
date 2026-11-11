// Compra directa y página del pedido.
import { html } from '../lib/html.js';
import { fmtMoney, fmtDateTime, countryName, EEA_UK } from '../lib/util.js';
import { STATUS_LABEL } from '../services/orders.js';
import { page, check, formError, addressFields, ADDRESS_FIELDS } from './layout.js';

function shippingNote(config) {
  const { mxCents, intlCents } = config.shipping;
  const f = (c) => (c ? fmtMoney(c) : 'incluido');
  return `Envío asegurado: México ${f(mxCents)}; resto del mundo ${f(intlCents)}. Los impuestos y aranceles de importación fuera de México, si los hay, corren por cuenta de quien compra.`;
}

const ownerCheck = (checked) => check({
  name: 'ownerNamePublic', checked,
  label: html`Autorizo que mi nombre aparezca como propietario/a en el certificado público de la obra. <small>(Opcional. Si no lo marcas, el certificado dirá «Colección privada».)</small>`,
});

export function checkoutPage(req, { work, address, config, values = null, error = null }) {
  const a = values || address || { recipient: req.user.name, phone: req.user.phone, country: req.user.country };
  const photo = work.photos[0];
  return page(req, {
    title: `Comprar: ${work.title}`,
    noindex: true,
    body: html`<section class="sheet">
      <p class="idline">${work.code}</p>
      <h1>${work.title}</h1>
      <div class="summary">
        ${photo ? html`<img src="/media/${photo.file}" alt="" width="${photo.width}" height="${photo.height}">` : ''}
        <div>
          <div class="lines">${[work.technique, work.dimensions, work.year].filter(Boolean).map((x) => html`<div>${x}</div>`)}</div>
          <div class="price">${fmtMoney(work.price_cents)}</div>
        </div>
      </div>
      <p class="fine">${shippingNote(config)}</p>
      <hr>
      <form method="post" action="/comprar/${work.code}" class="form">
        <h2>Dirección de envío</h2>
        ${formError(error, [...ADDRESS_FIELDS, 'acceptTerms'])}
        ${addressFields(a, error)}
        ${check({ name: 'saveAddress', checked: values ? Boolean(values.saveAddress) : true, label: 'Guardar esta dirección en mi cuenta para la próxima vez.' })}
        ${ownerCheck(Boolean(values?.ownerNamePublic))}
        <hr>
        ${check({ name: 'acceptTerms', required: true, error, label: html`Acepto los <a class="link" href="/legal/terminos" target="_blank" rel="noopener">Términos y Condiciones</a> de venta, incluida la información sobre envíos, devoluciones y derecho de desistimiento.` })}
        <button class="btn" type="submit">Apartar la obra y continuar al pago</button>
        <p class="fine">Al continuar, la obra queda apartada a tu nombre durante ${Math.round(config.orderHoldMs / 3600_000)} horas. Si en ese plazo no se recibe el pago, el pedido se cancela solo y no se te cobra nada.</p>
      </form>
    </section>`,
  });
}

export function orderPage(req, { order, config, paypalEnabled, error = null, values = null }) {
  const w = order.work;
  const pending = order.status === 'pending_payment';
  const hasAddr = Boolean(order.ship_line1);
  const addr = values || (hasAddr ? {
    recipient: order.ship_recipient, phone: order.ship_phone, line1: order.ship_line1, line2: order.ship_line2,
    city: order.ship_city, state: order.ship_state, postal_code: order.ship_postal_code, country: order.ship_country,
  } : { recipient: req.user.name, phone: req.user.phone, country: req.user.country });
  const spei = config.spei;
  const euBuyer = EEA_UK.has(order.ship_country);

  const addressForm = html`<form method="post" action="/pedidos/${order.code}/direccion" class="form">
    ${formError(error, ADDRESS_FIELDS)}
    ${addressFields(addr, error)}
    ${check({ name: 'saveAddress', checked: true, label: 'Guardar esta dirección en mi cuenta.' })}
    ${ownerCheck(Boolean(order.owner_name_public))}
    <button class="btn${hasAddr ? ' ghost' : ''}" type="submit">Guardar dirección</button>
  </form>`;

  return page(req, {
    title: `Pedido ${order.code}`,
    noindex: true,
    body: html`<section class="sheet">
      <p class="idline">Pedido ${order.code}${order.source === 'auction' ? ' · Subasta' : ''}</p>
      <h1>${w.title}</h1>
      <p class="status st-${order.status}"><span class="st"><i class="dot"></i>${STATUS_LABEL[order.status]}</span></p>
      ${pending && order.expires_at ? html`<p class="note">Fecha límite de pago: <time datetime="${new Date(order.expires_at).toISOString()}">${fmtDateTime(order.expires_at)}</time>.</p>` : ''}
      ${order.status === 'payment_review' ? html`<p class="note">Recibimos tu aviso de transferencia. La confirmación es manual; te escribiremos en cuanto veamos el depósito.</p>` : ''}
      ${order.status === 'shipped' && order.tracking ? html`<p>Guía / rastreo: <strong>${order.tracking}</strong></p>` : ''}
      ${order.status === 'refund_due' ? html`<p class="note">Recibimos tu pago cuando el pedido ya había vencido y la obra ya no estaba disponible. Te devolveremos el importe completo.</p>` : ''}

      <dl class="kv">
        <dt>Obra</dt><dd><a class="link" href="/obra/${w.code}">${w.title}</a> (${w.code})</dd>
        <dt>${order.source === 'auction' ? 'Precio de adjudicación' : 'Precio'}</dt><dd>${fmtMoney(order.subtotal_cents)}</dd>
        <dt>Envío</dt><dd>${hasAddr ? (order.shipping_cents ? fmtMoney(order.shipping_cents) : 'Incluido') : 'Se calcula con tu dirección'}</dd>
        <dt>Total</dt><dd><strong>${fmtMoney(order.total_cents)}</strong></dd>
        ${hasAddr ? html`<dt>Enviar a</dt><dd>${order.ship_recipient}<br>${order.ship_line1}${order.ship_line2 ? html`, ${order.ship_line2}` : ''}<br>${order.ship_postal_code} ${order.ship_city}, ${order.ship_state}<br>${countryName(order.ship_country)}<br>${order.ship_phone}</dd>` : ''}
      </dl>

      ${pending && !hasAddr ? html`<hr><h2>1. Dirección de envío</h2>
        <p class="note">Indica a dónde enviamos la obra para calcular el total y habilitar el pago.</p>${addressForm}` : ''}

      ${pending && hasAddr ? html`<hr>
        <h2>Pagar</h2>
        ${error && !error.field ? html`<p class="err box" role="alert">${error.message}</p>` : ''}
        ${paypalEnabled ? html`<section class="method">
          <h3>PayPal o tarjeta</h3>
          <form method="post" action="/pedidos/${order.code}/paypal">
            <button class="btn" type="submit">Pagar ${fmtMoney(order.total_cents)} con PayPal</button>
          </form>
          <p class="fine">Te llevamos al sitio de PayPal para pagar de forma segura y regresas aquí. Nosotros nunca vemos ni guardamos los datos de tu tarjeta.</p>
        </section>` : ''}
        ${spei.enabled ? html`<section class="method">
          <h3>Transferencia SPEI (México)</h3>
          <dl class="kv">
            ${spei.banco ? html`<dt>Banco</dt><dd>${spei.banco}</dd>` : ''}
            <dt>CLABE</dt><dd><span class="clabe" id="clabe">${spei.clabe}</span> <button type="button" class="linkbtn" data-copy="${spei.clabe}">Copiar</button></dd>
            <dt>Beneficiario</dt><dd>${spei.beneficiario}</dd>
            <dt>Monto</dt><dd>${fmtMoney(order.total_cents)}</dd>
            <dt>Concepto</dt><dd>${order.code}</dd>
          </dl>
          <form method="post" action="/pedidos/${order.code}/spei" class="form tight">
            <div class="field">
              <label for="f-ref">Clave de rastreo o referencia <small>(opcional)</small></label>
              <input id="f-ref" name="ref" maxlength="60" autocomplete="off">
            </div>
            <button class="btn ghost" type="submit">Ya transferí, avisar</button>
          </form>
          <p class="fine">Esta transferencia se confirma a mano: cuando veamos el depósito, la obra se marca como vendida y te avisamos por correo.</p>
        </section>` : ''}
        ${!paypalEnabled && !spei.enabled ? html`<p class="note">Los pagos en línea aún no están habilitados. Escríbenos${req.site.contactEmail ? html` a <a class="link" href="mailto:${req.site.contactEmail}">${req.site.contactEmail}</a>` : ''} para coordinar el pago.</p>` : ''}
        <details class="mt"><summary>Cambiar la dirección de envío</summary>${addressForm}</details>
        ${order.source === 'purchase' ? html`<form method="post" action="/pedidos/${order.code}/cancelar" class="mt" data-confirm="¿Cancelar este pedido? La obra volverá a quedar disponible.">
          <button class="linkbtn" type="submit">Cancelar pedido</button></form>` : ''}` : ''}

      <hr>
      <p class="fine">${euBuyer || !hasAddr
        ? 'Si compras como consumidor/a desde la Unión Europea, el Reino Unido u otro país que lo reconozca, tienes derecho a desistir de la compra dentro de los 14 días siguientes a recibir la obra, sin dar explicaciones. '
        : ''}Consulta envíos, devoluciones y garantías en los <a class="link" href="/legal/terminos">Términos y Condiciones</a>. ¿Dudas con tu pedido? ${req.site.contactEmail ? html`Escríbenos a <a class="link" href="mailto:${req.site.contactEmail}?subject=Pedido%20${order.code}">${req.site.contactEmail}</a>.` : ''}</p>
      <p class="fine"><a class="link" href="/cuenta">Volver a mi cuenta</a></p>
    </section>`,
  });
}

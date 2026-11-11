// Panel de administración.
import { html } from '../lib/html.js';
import { fmtMoney, fmtDateTime, fmtDate, countryName } from '../lib/util.js';
import { STATUS_LABEL } from '../services/orders.js';
import { page, field, formError } from './layout.js';

function adminPage(req, title, body, scripts = []) {
  return page(req, {
    title: `Admin · ${title}`,
    noindex: true,
    bodyClass: 'admin',
    scripts,
    body: html`<section class="sheet xwide">
      <nav class="subnav" aria-label="Administración">
        <a href="/admin">Resumen</a><a href="/admin/obras">Obras</a><a href="/admin/subastas">Subastas</a>
        <a href="/admin/pedidos">Pedidos</a><a href="/admin/usuarios">Cuentas</a><a href="/admin/privacidad">Privacidad</a><a href="/admin/auditoria">Bitácora</a>
      </nav>
      <h1>${title}</h1>
      ${body}
    </section>`,
  });
}

export function dashboardPage(req, { stats, issues }) {
  return adminPage(req, 'Resumen', html`
    ${issues.length ? html`<div class="callout">
      <p><strong>Pendientes antes de lanzar (${issues.length})</strong></p>
      <ul>${issues.map((i) => html`<li>${i}</li>`)}</ul>
    </div>` : html`<p class="note">Configuración completa.</p>`}
    <ul class="stats">
      <li><a href="/admin/pedidos"><strong>${stats.review}</strong> transferencias por confirmar</a></li>
      <li><a href="/admin/pedidos"><strong>${stats.toShip}</strong> pedidos pagados por enviar</a></li>
      <li><a href="/admin/pedidos"><strong>${stats.refundDue}</strong> reembolsos pendientes</a></li>
      <li><a href="/admin/privacidad"><strong>${stats.privacyOpen}</strong> solicitudes de privacidad abiertas</a></li>
      <li><a href="/admin/subastas"><strong>${stats.liveAuctions}</strong> subastas en curso</a></li>
      <li><a href="/admin/obras"><strong>${stats.works}</strong> obras · <strong>${stats.users}</strong> cuentas</a></li>
    </ul>`);
}

export function worksPage(req, works) {
  return adminPage(req, 'Obras', html`
    <p><a class="btn" href="/admin/obras/nueva">Nueva obra</a></p>
    <table class="tbl">
      <thead><tr><th>Código</th><th>Título</th><th>Estado</th><th>Precio</th><th>Orden</th><th>Certificado</th></tr></thead>
      <tbody>${works.map((w) => html`<tr>
        <td><a class="link" href="/admin/obras/${w.id}">${w.code}</a></td>
        <td>${w.title}</td>
        <td>${w.status === 'draft' ? 'Borrador' : w.sale.label}</td>
        <td>${w.price_cents ? fmtMoney(w.price_cents) : '—'}</td>
        <td>${w.position}</td>
        <td>${w.certificate_json ? 'Sí' : 'No'}</td>
      </tr>`)}</tbody>
    </table>`);
}

function workFields(w, error) {
  return html`
    ${field({ label: 'Título', name: 'title', value: w.title, error, required: true })}
    <div class="row2">
      ${field({ label: 'Técnica', name: 'technique', value: w.technique, error })}
      ${field({ label: 'Año', name: 'year', value: w.year, error, attrs: 'inputmode="numeric"' })}
    </div>
    <div class="row2">
      ${field({ label: 'Dimensiones', name: 'dimensions', value: w.dimensions, error, hint: 'Ej. 80 x 100 cm' })}
      ${field({ label: 'Precio en MXN', name: 'price', value: w.price ?? (w.price_cents ? w.price_cents / 100 : ''), error, hint: 'Vacío = solo subasta o consultar.', attrs: 'inputmode="decimal"' })}
    </div>
    <div class="field"><label for="f-description">Descripción <small>(opcional)</small></label>
      <textarea id="f-description" name="description" rows="5" maxlength="4000">${w.description ?? ''}</textarea></div>
    ${field({ label: 'Tipo de objeto', name: 'artform', value: w.artform, error, hint: 'Pintura, dibujo, grabado, escultura… Aparece en el certificado.' })}
    <div class="field"><label for="f-inscriptions">Inscripciones y marcas <small>(opcional)</small></label>
      <textarea id="f-inscriptions" name="inscriptions" rows="2" maxlength="600">${w.inscriptions ?? ''}</textarea>
      <p class="hint">Dónde y cómo está firmada, fechada o sellada. Ej. «Firmada y fechada al reverso, ángulo inferior derecho».</p></div>
    <div class="field"><label for="f-features">Rasgos distintivos <small>(opcional)</small></label>
      <textarea id="f-features" name="features" rows="2" maxlength="600">${w.features ?? ''}</textarea>
      <p class="hint">Lo que permite reconocer ESTA pieza y no otra: una textura, una reparación, una marca en el bastidor. Solo aparece en el certificado.</p></div>
    ${field({ label: 'Orden en la galería', name: 'position', value: w.position ?? 0, error, hint: 'Número menor aparece primero.', attrs: 'inputmode="numeric"' })}`;
}

export function workNewPage(req, { values = {}, error = null }) {
  return adminPage(req, 'Nueva obra', html`
    <form method="post" action="/admin/obras" class="form">
      ${formError(error, ['code', 'title', 'year', 'price'])}
      ${field({ label: 'Código único', name: 'code', value: values.code, error, required: true, hint: 'Ej. TLK-2026-015. No se puede cambiar después: es el que se firma en el certificado.' })}
      ${workFields(values, error)}
      <button class="btn" type="submit">Crear como borrador</button>
    </form>`);
}

export function workEditPage(req, { work, auction, orders, error = null, values = null }) {
  const w = values ? { ...work, ...values } : work;
  const locked = ['reserved', 'sold'].includes(work.status) && orders.some((o) => ['pending_payment', 'payment_review', 'paid', 'shipped', 'delivered'].includes(o.status));
  const statusOpts = [['draft', 'Borrador (oculta)'], ['available', 'Publicada · disponible'], ['nfs', 'Publicada · no está a la venta'], ['sold', 'Publicada · vendida (venta externa)']];
  return adminPage(req, work.title, html`
    <p class="idline">${work.code} · <a class="link" href="/obra/${work.code}">ver página pública</a></p>
    ${error ? html`<p class="err box" role="alert">${error.message}</p>` : ''}

    <h2>Datos</h2>
    <form method="post" action="/admin/obras/${work.id}" class="form">
      ${workFields(w, error)}
      <div class="field"><label for="f-status">Estado</label>
        ${locked ? html`<p class="note">${work.sale.label}: lo controla un pedido en curso.</p>` : html`
        <select id="f-status" name="status">
          ${statusOpts.map(([v, l]) => html`<option value="${v}"${work.status === v ? ' selected' : ''}>${l}</option>`)}
          ${work.status === 'reserved' ? html`<option value="reserved" selected>Apartada</option>` : ''}
        </select>`}
      </div>
      <button class="btn" type="submit">Guardar</button>
    </form>

    <h2>Fotos</h2>
    <p class="note">La primera es la portada. Las fotos se guardan sin modificar para que su huella coincida con el certificado: si cambias una foto, hay que firmar la ficha otra vez.</p>
    <ul class="photos">${work.photos.map((p, i) => html`<li>
      <img src="/media/${p.file}" alt="" width="${p.width}" height="${p.height}" loading="lazy">
      <div>
        ${i === 0 ? html`<span class="m">Portada</span>` : html`<form method="post" action="/admin/obras/${work.id}/fotos/${p.id}/primera"><button class="linkbtn" type="submit">Hacer portada</button></form>`}
        <form method="post" action="/admin/obras/${work.id}/fotos/${p.id}/eliminar" data-confirm="¿Eliminar esta foto?"><button class="linkbtn" type="submit">Eliminar</button></form>
      </div>
    </li>`)}</ul>
    <form method="post" action="/admin/obras/${work.id}/fotos" enctype="multipart/form-data" class="form tight">
      <div class="field"><label for="f-photos">Subir fotos (JPG, PNG o WebP; hasta 15 MB cada una)</label>
        <input id="f-photos" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></div>
      <button class="btn ghost" type="submit">Subir</button>
    </form>

    <h2>Certificado de autenticidad</h2>
    <p>Estado: <strong>${work.certificate_json ? 'publicado' : 'sin certificado'}</strong>${work.certificate_json ? html` · <a class="link" href="/obra/${work.code}/certificado">ver certificado</a>` : ''}</p>
    <p class="note">El certificado es una credencial verificable (estándar W3C) firmada con tu llave privada. Vuelve a firmar cada vez que cambien los datos, las fotos o el propietario de la obra.</p>
    <div class="method" id="cert-sign" data-work="${work.id}" data-code="${work.code}">
      <h3>Firmar y publicar aquí</h3>
      <div class="field"><label for="f-key">Tu llave privada (<code>private-key.pem</code>)</label>
        <input id="f-key" type="file" accept=".pem,application/x-pem-file,text/plain"></div>
      <button class="btn" type="button" id="cert-sign-btn">Firmar y publicar certificado</button>
      <p class="err" id="cert-sign-msg" role="alert" hidden></p>
      <p class="fine">La llave se lee y se usa solo dentro de este navegador para calcular la firma: <strong>no se sube ni se guarda en el servidor</strong>. Hazlo desde tu propio equipo.</p>
    </div>
    <details>
      <summary>Firmar con la línea de comandos (alternativa)</summary>
      <ol class="steps">
        <li><a class="link" href="/admin/obras/${work.id}/credencial.json" download="${work.code}.json">Descarga la credencial sin firmar</a>.</li>
        <li>Fírmala en tu equipo: <code>npm run cert:sign -- ${work.code}.json</code></li>
        <li>Sube aquí el archivo firmado.</li>
      </ol>
      <form method="post" action="/admin/obras/${work.id}/certificado" enctype="multipart/form-data" class="form tight">
        <div class="field"><label for="f-cert">Credencial firmada (.json)</label>
          <input id="f-cert" type="file" name="cert" accept="application/json,.json" required></div>
        <button class="btn ghost" type="submit">Publicar certificado</button>
      </form>
    </details>

    <h2>Subasta</h2>
    ${auction ? html`<p>Subasta #${auction.id}: <strong>${auction.status === 'live' ? 'en curso' : 'programada'}</strong>. Abre ${fmtDateTime(auction.starts_at)}; cierra ${fmtDateTime(auction.ends_at)}.</p>
      <form method="post" action="/admin/subastas/${auction.id}/cancelar" data-confirm="¿Cancelar la subasta? Las pujas quedan sin efecto."><button class="btn danger" type="submit">Cancelar subasta</button></form>`
    : work.status === 'available' ? html`
    <form method="post" action="/admin/obras/${work.id}/subasta" class="form" id="auction-form">
      <div class="row2">
        <div class="field"><label for="f-starts">Abre</label><input id="f-starts" type="datetime-local" name="starts_local" required data-ms="starts_ms"><input type="hidden" name="starts_ms"></div>
        <div class="field"><label for="f-ends">Cierra</label><input id="f-ends" type="datetime-local" name="ends_local" required data-ms="ends_ms"><input type="hidden" name="ends_ms"></div>
      </div>
      <p class="hint">Las horas se toman en la zona horaria de tu navegador.</p>
      <div class="row2">
        ${field({ label: 'Precio de salida (MXN)', name: 'start', required: true, attrs: 'inputmode="decimal"' })}
        ${field({ label: 'Incremento mínimo (MXN)', name: 'increment', required: true, value: '500', attrs: 'inputmode="decimal"' })}
      </div>
      <div class="row2">
        ${field({ label: 'Precio de reserva (MXN)', name: 'reserve', hint: 'Secreto. Si la puja más alta no lo alcanza, no hay venta.', attrs: 'inputmode="decimal"' })}
        ${field({ label: 'Prórroga (minutos)', name: 'extend', value: '5', hint: 'Una puja en los últimos minutos recorre el cierre.', attrs: 'inputmode="numeric"' })}
      </div>
      <button class="btn" type="submit">Programar subasta</button>
    </form>` : html`<p class="note">Para subastarla, la obra debe estar publicada como «disponible» y sin pedidos en curso.</p>`}

    ${orders.length ? html`<h2>Pedidos de esta obra</h2>
    <ul class="olist">${orders.map((o) => html`<li><a class="link" href="/admin/pedidos/${o.code}">${o.code}</a><span>${STATUS_LABEL[o.status]}</span><span>${fmtMoney(o.total_cents)}</span><span class="m">${fmtDate(o.created_at)}</span></li>`)}</ul>` : ''}

    <h2 class="danger">Borrar</h2>
    <form method="post" action="/admin/obras/${work.id}/eliminar" data-confirm="¿Borrar la obra y sus fotos de forma definitiva?"><button class="btn danger" type="submit">Borrar obra</button></form>`, ['admin.js', 'vc.js', 'cert-sign.js']);
}

export function auctionsAdminPage(req, rows) {
  const L = { scheduled: 'Programada', live: 'En curso', sold: 'Vendida', unsold: 'Sin venta', cancelled: 'Cancelada' };
  return adminPage(req, 'Subastas', html`
    <p class="note">Las subastas se crean desde la ficha de cada obra.</p>
    <table class="tbl">
      <thead><tr><th>#</th><th>Obra</th><th>Estado</th><th>Abre</th><th>Cierra</th><th>Salida</th><th>Reserva</th><th>Pujas</th><th>Más alta</th><th></th></tr></thead>
      <tbody>${rows.map((a) => html`<tr>
        <td>${a.id}</td>
        <td><a class="link" href="/admin/obras/${a.work_id}">${a.work_title}</a></td>
        <td>${L[a.status]}</td>
        <td>${fmtDateTime(a.starts_at)}</td>
        <td>${fmtDateTime(a.ends_at)}</td>
        <td>${fmtMoney(a.start_cents)}</td>
        <td>${a.reserve_cents ? fmtMoney(a.reserve_cents) : '—'}</td>
        <td>${a.bid_count}</td>
        <td>${a.top_cents ? html`${fmtMoney(a.top_cents)}<br><small>${a.top_name} · ${a.top_email}</small>` : '—'}</td>
        <td>${['scheduled', 'live'].includes(a.status) ? html`<form method="post" action="/admin/subastas/${a.id}/cancelar" data-confirm="¿Cancelar la subasta?"><button class="linkbtn" type="submit">Cancelar</button></form>` : ''}</td>
      </tr>`)}</tbody>
    </table>`);
}

export function ordersAdminPage(req, rows) {
  return adminPage(req, 'Pedidos', html`
    <table class="tbl">
      <thead><tr><th>Pedido</th><th>Obra</th><th>Quién</th><th>Total</th><th>Estado</th><th>Pago</th><th>Fecha</th></tr></thead>
      <tbody>${rows.map((o) => html`<tr class="${['payment_review', 'paid', 'refund_due'].includes(o.status) ? 'hot' : ''}">
        <td><a class="link" href="/admin/pedidos/${o.code}">${o.code}</a></td>
        <td>${o.work_title}</td>
        <td>${o.user_name || '(cuenta eliminada)'}</td>
        <td>${fmtMoney(o.total_cents)}</td>
        <td>${STATUS_LABEL[o.status]}</td>
        <td>${o.payment_method || '—'}</td>
        <td>${fmtDate(o.created_at)}</td>
      </tr>`)}</tbody>
    </table>`);
}

export function orderAdminPage(req, { order, buyer, error = null }) {
  const act = (action, label, { cls = 'ghost', confirm = '', extra = '' } = {}) => html`
    <form method="post" action="/admin/pedidos/${order.code}/${action}" class="inline"${confirm ? html` data-confirm="${confirm}"` : ''}>
      ${extra}<button class="btn ${cls}" type="submit">${label}</button></form>`;
  const s = order.status;
  return adminPage(req, `Pedido ${order.code}`, html`
    ${error ? html`<p class="err box" role="alert">${error.message}</p>` : ''}
    <p class="status"><strong>${STATUS_LABEL[s]}</strong>${order.expires_at ? html` · vence ${fmtDateTime(order.expires_at)}` : ''}</p>
    <dl class="kv">
      <dt>Obra</dt><dd><a class="link" href="/admin/obras/${order.work.id}">${order.work.title}</a> (${order.work.code})</dd>
      <dt>Origen</dt><dd>${order.source === 'auction' ? `Subasta #${order.auction_id}` : 'Compra directa'}</dd>
      <dt>Subtotal</dt><dd>${fmtMoney(order.subtotal_cents)}</dd>
      <dt>Envío</dt><dd>${fmtMoney(order.shipping_cents) || '$0'}</dd>
      <dt>Total</dt><dd><strong>${fmtMoney(order.total_cents)}</strong></dd>
      <dt>Pago</dt><dd>${order.payment_method || '—'}${order.payment_ref ? html` · ref. ${order.payment_ref}` : ''}${order.paypal_capture_id ? html` · captura PayPal ${order.paypal_capture_id}` : order.paypal_order_id ? html` · orden PayPal ${order.paypal_order_id}` : ''}</dd>
      <dt>Compra</dt><dd>${buyer ? html`${buyer.name}<br>${buyer.email}${buyer.phone ? html`<br>${buyer.phone}` : ''}` : '(cuenta eliminada)'}</dd>
      <dt>Enviar a</dt><dd>${order.ship_line1 ? html`${order.ship_recipient}<br>${order.ship_line1}${order.ship_line2 ? html`, ${order.ship_line2}` : ''}<br>${order.ship_postal_code} ${order.ship_city}, ${order.ship_state}<br>${countryName(order.ship_country)}<br>${order.ship_phone}` : order.pii_scrubbed_at ? '(datos eliminados por plazo de conservación)' : '(sin dirección todavía)'}</dd>
      <dt>Certificado</dt><dd>${order.owner_name_public ? 'Autorizó mostrar su nombre como propietario/a.' : 'Propietario: «Colección privada» (no autorizó mostrar su nombre).'}</dd>
      ${order.tracking ? html`<dt>Guía</dt><dd>${order.tracking}</dd>` : ''}
      <dt>Fechas</dt><dd>Creado ${fmtDateTime(order.created_at)}${order.paid_at ? html`<br>Pagado ${fmtDateTime(order.paid_at)}` : ''}${order.shipped_at ? html`<br>Enviado ${fmtDateTime(order.shipped_at)}` : ''}${order.delivered_at ? html`<br>Entregado ${fmtDateTime(order.delivered_at)}` : ''}</dd>
    </dl>

    <h2>Acciones</h2>
    <div class="actions">
      ${['pending_payment', 'payment_review'].includes(s) ? act('confirm_payment', 'Confirmar pago recibido', { cls: '', confirm: '¿Confirmas que el dinero ya está en tu cuenta? La obra se marcará como vendida.' }) : ''}
      ${s === 'payment_review' ? act('reject_payment', 'No encuentro el depósito') : ''}
      ${['pending_payment', 'payment_review'].includes(s) ? act('cancel', 'Cancelar pedido', { cls: 'danger', confirm: '¿Cancelar el pedido y liberar la obra?' }) : ''}
      ${s === 'paid' ? act('ship', 'Marcar como enviado', { cls: '', extra: html`<input name="tracking" placeholder="Paquetería y número de guía" aria-label="Paquetería y número de guía" maxlength="120">` }) : ''}
      ${s === 'shipped' ? act('deliver', 'Marcar como entregado', { cls: '' }) : ''}
      ${['paid', 'shipped', 'delivered', 'refund_due'].includes(s) ? act('refund', 'Registrar reembolso hecho', { cls: 'danger', confirm: 'Esto solo REGISTRA el reembolso: primero devuelve el dinero desde PayPal o tu banco. ¿Ya lo hiciste?' }) : ''}
    </div>
    ${s === 'paid' ? html`<p class="note">Antes de enviar: descarga la ficha de la obra con el propietario actualizado, fírmala y publícala desde <a class="link" href="/admin/obras/${order.work.id}">la ficha de la obra</a>.</p>` : ''}

    <h2>Notas internas</h2>
    <form method="post" action="/admin/pedidos/${order.code}/notes" class="form tight">
      <div class="field"><label class="sr" for="f-notes">Notas</label><textarea id="f-notes" name="notes" rows="3" maxlength="2000">${order.admin_notes ?? ''}</textarea></div>
      <button class="btn ghost" type="submit">Guardar notas</button>
    </form>`);
}

export function usersAdminPage(req, rows) {
  return adminPage(req, 'Cuentas', html`
    <p class="note">Solo los datos necesarios para atender pedidos. Para eliminar una cuenta a petición de su titular, usa «Privacidad».</p>
    <table class="tbl">
      <thead><tr><th>Nombre</th><th>Correo</th><th>País</th><th>Verificada</th><th>Avisos</th><th>Alta</th></tr></thead>
      <tbody>${rows.map((u) => html`<tr>
        <td>${u.name}${u.role === 'admin' ? ' (admin)' : ''}</td><td>${u.email}</td><td>${countryName(u.country)}</td>
        <td>${u.email_verified_at ? 'Sí' : 'No'}</td><td>${u.marketing_opt_in ? 'Sí' : 'No'}</td><td>${fmtDate(u.created_at)}</td>
      </tr>`)}</tbody>
    </table>`);
}

export function privacyAdminPage(req, rows) {
  return adminPage(req, 'Solicitudes de privacidad', html`
    <p class="note">Plazos: México, 20 días hábiles para responder y 15 más para hacerla efectiva; RGPD, un mes; Brasil (LGPD), 15 días; California, 45 días. Verifica la identidad de quien solicita antes de entregar o borrar datos.</p>
    ${rows.length ? rows.map((q) => html`<article class="card${q.status === 'open' ? ' hot' : ''}">
      <p class="idline">#${q.id} · ${q.kind} · ${fmtDateTime(q.created_at)} · ${q.status === 'open' ? 'ABIERTA' : `resuelta ${fmtDate(q.resolved_at)}`}</p>
      <p><strong>${q.name}</strong> · ${q.email}${q.user_id ? ' · con cuenta' : ' · sin cuenta'}</p>
      <p class="pre">${q.message}</p>
      ${q.admin_notes ? html`<p class="note">Respuesta registrada: ${q.admin_notes}</p>` : ''}
      ${q.status === 'open' ? html`<form method="post" action="/admin/privacidad/${q.id}/resolver" class="form tight">
        <div class="field"><label for="n-${q.id}">Qué se hizo y cuándo se respondió</label><textarea id="n-${q.id}" name="notes" rows="2" required maxlength="2000"></textarea></div>
        <button class="btn ghost" type="submit">Marcar como resuelta</button>
      </form>` : ''}
    </article>`) : html`<p class="note">No hay solicitudes.</p>`}`);
}

export function auditPage(req, rows) {
  return adminPage(req, 'Bitácora', html`
    <table class="tbl small">
      <thead><tr><th>Fecha</th><th>Evento</th><th>Cuenta</th><th>Sobre</th><th>Detalle</th></tr></thead>
      <tbody>${rows.map((a) => html`<tr>
        <td>${fmtDateTime(a.at)}</td><td>${a.action}</td><td>${a.user_id ?? '—'}</td>
        <td>${a.entity ? `${a.entity} ${a.entity_id ?? ''}` : '—'}</td><td>${a.meta ?? ''}</td>
      </tr>`)}</tbody>
    </table>`);
}

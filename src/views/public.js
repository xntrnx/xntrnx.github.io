// Páginas públicas: portada, galería, obra, subastas y certificado.
import { html, jsonScript } from '../lib/html.js';
import { fmtMoney, fmtDateTime, isoDate } from '../lib/util.js';
import { page, check, formError } from './layout.js';

const vtName = (code) => `obra-${String(code).replace(/[^A-Za-z0-9_-]/g, '_')}`;

const SALE_CLASS = { available: 'open', auction_live: 'live', auction_scheduled: 'soon', reserved: 'held', sold: 'sold', nfs: 'nfs' };

function saleLine(sale) {
  const showAmount = ['available', 'auction_live', 'auction_scheduled'].includes(sale.kind);
  return html`<span class="s ${SALE_CLASS[sale.kind]}">
    <span class="st"><i class="dot"></i>${sale.label}</span>
    ${showAmount ? html`<span class="pr">${sale.kind === 'available' ? '' : sale.hasBids ? 'Puja: ' : 'Salida: '}${fmtMoney(sale.amountCents)}</span>` : ''}
  </span>`;
}

export function homePage(req) {
  const [a, b] = req.site.name.split(',').map((s) => s.trim());
  const words = b ? [a, b] : [req.site.name];
  return page(req, {
    bare: true,
    bodyClass: 'home',
    description: `${req.site.name}. Obra pictórica única con certificado de autenticidad verificable.`,
    scripts: ['home.js'],
    body: html`
    <h1 class="sr">${req.site.name}</h1>
    <div class="stage" aria-hidden="true">
      ${words.map((w, i) => html`<div class="word${i === 0 ? ' active' : ''}"><span data-t="${w}">${w}</span><i class="caret"></i></div>`)}
    </div>
    <a class="enter show" href="/galeria">Entrar a la galería</a>`,
  });
}

export function galleryPage(req, works) {
  return page(req, {
    title: 'Galería',
    description: 'Obra pictórica única con certificado de autenticidad firmado y verificable en línea.',
    scripts: ['gallery.js'],
    body: html`
    <section class="hero">
      <h1 data-decode>Galería</h1>
      <p>Cada pieza es única y viene con un certificado de autenticidad firmado, verificable en línea.</p>
      <p class="count" id="count" aria-live="polite">${works.length === 1 ? '1 obra' : `${works.length} obras`}</p>
      ${works.length ? html`<div class="seg" role="group" aria-label="Filtrar obras">
        <button type="button" data-f="all" aria-pressed="true">Todas</button>
        <button type="button" data-f="open" aria-pressed="false">Disponibles</button>
      </div>` : ''}
    </section>
    <section class="wall${works.length === 1 ? ' solo' : ''}" id="field" aria-label="Obras">
      ${works.length ? works.map((w, i) => html`
      <figure class="fig p${i % 6}" data-id="${w.code}" data-open="${['available', 'auction_live', 'auction_scheduled'].includes(w.sale.kind) ? 1 : 0}">
        <div class="px">
          <a class="piece" href="/obra/${w.code}" aria-label="${w.title}, ver obra">
            <div class="float"><div class="tilt"><div class="frame" style="aspect-ratio:${w.photo ? `${w.photo.width} / ${w.photo.height}` : '4 / 5'}">
              ${w.photo ? html`<img src="/media/${w.photo.file}" alt="${w.title}" width="${w.photo.width}" height="${w.photo.height}"
                ${i < 2 ? html`fetchpriority="high"` : html`loading="lazy"`} decoding="async" style="view-transition-name:${vtName(w.code)}">` : ''}
            </div></div></div>
          </a>
          <figcaption>
            <span class="t">${w.title}</span>
            ${w.technique || w.year ? html`<span class="m">${[w.technique, w.year].filter(Boolean).join(', ')}</span>` : ''}
            ${saleLine(w.sale)}
          </figcaption>
        </div>
      </figure>`) : html`<p class="note">Todavía no hay obras publicadas.</p>`}
    </section>
    <p class="note empty" id="none" hidden>Por ahora no hay obras disponibles. <button type="button" class="linkbtn" id="seeAll">Ver todas</button></p>
    ${works.length ? html`<p class="end">Todas las obras incluyen certificado de autenticidad.</p>` : ''}
    <div class="hud" id="hud" aria-hidden="true"><span id="hudN"></span><span class="tt" id="hudT"></span></div>`,
  });
}

function auctionPanel(req, work, view) {
  const { state, registration, error } = view;
  const a = work.sale.auction;
  const live = state.status === 'live';
  const user = req.user;
  const next = encodeURIComponent(`/obra/${work.code}`);
  let action;
  if (!user) {
    action = html`<p><a class="btn" href="/cuenta/entrar?next=${next}">Entrar para participar</a></p>
      <p class="fine">Necesitas una cuenta con correo confirmado. <a class="link" href="/cuenta/registro?next=${next}">Crear cuenta</a></p>`;
  } else if (!registration) {
    action = html`<form method="post" action="/subastas/${a.id}/registro" class="form tight">
      <h3>Registrarme a esta subasta</h3>
      ${formError(error, ['acceptRules', 'binding'])}
      ${check({ name: 'acceptRules', required: true, error, label: html`Leí y acepto las <a class="link" href="/legal/terminos#subastas" target="_blank" rel="noopener">Reglas de Subasta</a>.` })}
      ${check({ name: 'binding', required: true, error, label: 'Entiendo que cada puja es un compromiso de compra: si gano, debo pagar la obra.' })}
      <button class="btn" type="submit">Registrarme</button>
      <p class="fine">Tus pujas se muestran públicamente solo con un número de paleta, nunca con tu nombre.</p>
    </form>`;
  } else {
    action = html`<form method="post" action="/subastas/${a.id}/pujas" class="form tight" id="bid-form"${live ? '' : ' hidden'}>
      <div class="field">
        <label for="bid-amount">Tu puja (MXN)</label>
        <input id="bid-amount" name="amount" inputmode="decimal" autocomplete="off" required value="${state.minNextCents / 100}">
        <p class="hint">Puja mínima: <span id="a-min">${fmtMoney(state.minNextCents)}</span></p>
      </div>
      <p class="err" id="bid-error" role="alert"${error ? '' : ' hidden'}>${error?.message ?? ''}</p>
      <button class="btn" type="submit">Pujar</button>
      <p class="fine">Participas como <strong>Paleta ${registration.paddle}</strong>. Cada puja es un compromiso de compra.</p>
    </form>
    ${live ? '' : html`<p class="fine" id="a-wait">Ya estás registrado/a como <strong>Paleta ${registration.paddle}</strong>. Podrás pujar cuando la subasta abra.</p>`}`;
  }
  return html`<section class="sale auction ${live ? 'live' : 'soon'}" id="auction" data-id="${a.id}" data-paddle="${registration?.paddle ?? ''}">
    <span class="st"><i class="dot"></i><span id="a-status">${live ? 'En subasta' : 'Subasta próxima'}</span></span>
    <p class="a-label" id="a-label">${state.currentCents === null ? 'Precio de salida' : 'Puja actual'}</p>
    <div class="price" id="a-current">${fmtMoney(state.currentCents ?? state.startCents)}</div>
    <p class="a-meta"><span id="a-count">${state.bidCount === 1 ? '1 puja' : `${state.bidCount} pujas`}</span><span id="a-reserve">${state.hasReserve ? (state.reserveMet ? ' · Reserva alcanzada' : ' · Reserva no alcanzada') : ' · Sin reserva'}</span></p>
    <p class="a-time"><span id="a-timelabel">${live ? 'Cierra en' : 'Abre en'}</span> <strong id="a-countdown">…</strong><br>
      <small><time id="a-when" datetime="${isoDate(live ? state.endsAt : state.startsAt)}">${fmtDateTime(live ? state.endsAt : state.startsAt)}</time></small></p>
    <p class="a-you" id="a-you" hidden></p>
    <div id="a-action">${action}</div>
    <h3 class="a-h">Pujas</h3>
    <ol class="a-bids" id="a-bids">
      ${state.bids.length ? state.bids.map((b) => html`<li><span>Paleta ${b.paddle}</span><span>${fmtMoney(b.amountCents)}</span></li>`) : html`<li class="none">Todavía no hay pujas.</li>`}
    </ol>
    <p class="fine">Si alguien puja en los últimos ${Math.round(a.extend_seconds / 60)} minutos, el cierre se recorre para que todos puedan responder.</p>
    <script type="application/json" id="a-state">${jsonScript(state)}</script>
  </section>`;
}

export function workPage(req, work, view = {}) {
  const sale = work.sale;
  const first = work.photos[0];
  const isAuction = sale.kind === 'auction_live' || sale.kind === 'auction_scheduled';
  let panel;
  if (isAuction) {
    panel = auctionPanel(req, work, view);
  } else {
    panel = html`<section class="sale ${SALE_CLASS[sale.kind]}">
      <span class="st"><i class="dot"></i>${sale.label}</span>
      ${sale.kind === 'available' ? html`<div class="price">${fmtMoney(sale.amountCents)}</div>` : html`<div class="gap"></div>`}
      <div class="actions">
        ${sale.kind === 'available' ? html`<a class="btn" href="/comprar/${work.code}">Comprar</a>` : ''}
        ${work.certificate_json ? html`<a class="link" href="/obra/${work.code}/certificado">Ver certificado de autenticidad</a>` : ''}
      </div>
      ${sale.kind === 'available' ? html`<p class="fine">Incluye certificado de autenticidad firmado.</p>` : ''}
      ${sale.kind === 'reserved' ? html`<p class="fine">Otra persona la apartó y está por completar su pago. Si no lo hace, volverá a estar disponible.</p>` : ''}
    </section>`;
  }
  return page(req, {
    title: work.title,
    description: [work.title, work.technique, work.year].filter(Boolean).join(', '),
    scripts: isAuction ? ['work.js', 'auction.js'] : ['work.js'],
    body: html`
    <div class="wrap">
      <section class="viewer" aria-label="Fotografías de la obra">
        ${first ? html`<div class="canvas"><div class="float"><div class="tilt" id="tilt">
          <img id="hero" class="ready" src="/media/${first.file}" width="${first.width}" height="${first.height}" alt="${work.title}"
            decoding="async" tabindex="0" role="button" aria-label="Ampliar imagen de ${work.title}"
            style="--r:${first.width / first.height};view-transition-name:${vtName(work.code)}">
        </div></div></div>` : html`<p class="note">Esta obra todavía no tiene fotos.</p>`}
        <div class="pager" id="pager"${work.photos.length > 1 ? '' : ' hidden'}>
          <button type="button" id="prev" aria-label="Foto anterior">Anterior</button>
          <span id="pcount">1 / ${work.photos.length}</span>
          <button type="button" id="next" aria-label="Foto siguiente">Siguiente</button>
        </div>
        <script type="application/json" id="photos">${jsonScript(work.photos.map((p) => ({ src: `/media/${p.file}`, w: p.width, h: p.height })))}</script>
      </section>
      <aside class="label">
        <div class="id">${work.code}</div>
        <h1>${work.title}</h1>
        <div class="lines">
          ${work.technique ? html`<div>${work.technique}</div>` : ''}
          ${work.dimensions ? html`<div>${work.dimensions}</div>` : ''}
          ${work.year ? html`<div>${work.year}</div>` : ''}
        </div>
        ${work.description ? html`<p class="desc">${work.description}</p>` : ''}
        ${panel}
        ${isAuction && work.certificate_json ? html`<p class="fine"><a class="link" href="/obra/${work.code}/certificado">Ver certificado de autenticidad</a></p>` : ''}
      </aside>
    </div>
    ${view.adjacent ? html`<nav class="adj" aria-label="Otras obras">
      ${view.adjacent.prev ? html`<a href="/obra/${view.adjacent.prev.code}"><small>Obra anterior</small><span>${view.adjacent.prev.title}</span></a>` : ''}
      ${view.adjacent.next ? html`<a href="/obra/${view.adjacent.next.code}"><small>Obra siguiente</small><span>${view.adjacent.next.title}</span></a>` : ''}
    </nav>` : ''}
    <div class="zoom" id="zoom" role="dialog" aria-modal="true" aria-label="Imagen ampliada" hidden>
      <button type="button" id="zclose">Cerrar</button>
      <img alt="">
    </div>`,
  });
}

export function auctionsPage(req, auctions, states) {
  const row = (a) => {
    const s = states.get(a.id);
    const label = { live: 'En curso', scheduled: 'Próxima', sold: 'Vendida', unsold: 'Sin venta' }[a.status];
    const when = a.status === 'scheduled' ? `Abre: ${fmtDateTime(a.starts_at)}` : a.status === 'live' ? `Cierra: ${fmtDateTime(a.ends_at)}` : `Cerró: ${fmtDateTime(a.ends_at)}`;
    return html`<li class="arow ${a.status === 'live' ? 'live' : a.status === 'scheduled' ? 'soon' : a.status === 'sold' ? 'sold' : 'nfs'}">
      <a href="/obra/${a.work_code}"><span class="t">${a.work_title}</span></a>
      <span class="st"><i class="dot"></i>${label}</span>
      <span class="pr">${s.currentCents === null ? `Salida: ${fmtMoney(s.startCents)}` : `${a.status === 'sold' ? 'Adjudicada en' : 'Puja'}: ${fmtMoney(s.currentCents)}`}</span>
      <span class="m">${when}</span>
    </li>`;
  };
  return page(req, {
    title: 'Subastas',
    description: 'Subastas en línea de obra única.',
    body: html`
    <section class="sheet wide">
      <h1 data-decode>Subastas</h1>
      <p class="lead">Subastas en línea, abiertas y en tiempo real. Para pujar necesitas una cuenta con correo confirmado y aceptar las <a class="link" href="/legal/terminos#subastas">Reglas de Subasta</a>.</p>
      ${auctions.length ? html`<ul class="alist">${auctions.map(row)}</ul>` : html`<p class="note">Por ahora no hay subastas programadas.</p>`}
    </section>`,
  });
}

export function certificatePage(req, { work = null, serverCheck = null } = {}) {
  return page(req, {
    title: work ? `Certificado: ${work.title}` : 'Verificar certificado',
    scripts: ['verify.js'],
    body: html`
    <section class="sheet" id="verify" data-cert-url="${work ? `/obra/${work.code}/certificado.json` : ''}" data-work-url="${work ? `/obra/${work.code}` : ''}">
      <div id="content">
        ${work ? html`<p class="note">Verificando certificado…</p>` : html`
          <h1>Verificar un certificado</h1>
          <p class="desc">Pega o sube la ficha JSON de una obra para comprobar su firma.</p>`}
      </div>
      <details class="fallback"${work ? '' : ' open'}>
        <summary>${work ? 'Verificar otra ficha manualmente' : 'Ficha a verificar'}</summary>
        <label class="sr" for="manualJson">JSON de la obra</label>
        <textarea id="manualJson" placeholder="Pega aquí el JSON de la obra"></textarea>
        <input type="file" id="manualFile" accept="application/json,.json" aria-label="Subir archivo JSON">
        <button type="button" class="btn" id="manualBtn">Verificar</button>
      </details>
      <noscript><p class="note">${serverCheck
        ? (serverCheck.ok ? 'El servidor comprobó la firma de este certificado y es auténtica. Activa JavaScript para verificarla tú mismo/a en tu navegador.' : `El servidor no pudo validar este certificado: ${serverCheck.reason}`)
        : 'Activa JavaScript para verificar certificados en tu navegador.'}</p></noscript>
      <p class="fine">La verificación ocurre en tu navegador: comprueba la firma Ed25519 de la ficha contra el <a class="link" href="/llaves.json">historial público de llaves</a> del artista y la huella SHA-256 de cada foto.</p>
    </section>`,
  });
}

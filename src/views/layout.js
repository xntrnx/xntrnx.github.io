// Estructura común de todas las páginas + componentes de formulario.
import { html, raw } from '../lib/html.js';
import { COUNTRIES } from '../lib/util.js';

// Avisos que se muestran tras una redirección (?m=clave). Solo claves conocidas: nunca texto de la URL.
const MESSAGES = {
  verified: ['ok', 'Correo confirmado. Tu cuenta ya está activa.'],
  bad_token: ['err', 'El enlace ya no es válido o venció. Pide uno nuevo.'],
  verify_sent: ['ok', 'Te enviamos un nuevo enlace de confirmación.'],
  reset_done: ['ok', 'Contraseña actualizada. Ya puedes entrar.'],
  bye: ['ok', 'Cerraste sesión.'],
  deleted: ['ok', 'Tu cuenta fue eliminada.'],
  saved: ['ok', 'Cambios guardados.'],
  pw_changed: ['ok', 'Contraseña actualizada. Cerramos tus otras sesiones.'],
  address_deleted: ['ok', 'Dirección eliminada.'],
  order_created: ['ok', 'Apartamos la obra para ti. Completa el pago antes de la fecha límite.'],
  order_cancelled: ['ok', 'Pedido cancelado. La obra volvió a quedar disponible.'],
  paid: ['ok', 'Pago confirmado. ¡Gracias!'],
  refund_due: ['err', 'Recibimos tu pago, pero el pedido ya había vencido y la obra ya no estaba disponible. Te reembolsaremos el importe completo; te escribiremos por correo.'],
  paypal_cancel: ['err', 'Cancelaste el pago en PayPal. No se hizo ningún cargo.'],
  spei_sent: ['ok', 'Recibimos tu aviso. Confirmaremos el depósito y te avisaremos por correo.'],
  registered_auction: ['ok', 'Quedaste registrado/a en la subasta. Ya puedes pujar.'],
  bid_ok: ['ok', 'Puja registrada.'],
  request_sent: ['ok', 'Recibimos tu solicitud. Te responderemos dentro del plazo legal.'],
  need_verify: ['err', 'Confirma tu correo para continuar. Revisa tu bandeja de entrada.'],
};

function head({ title, description, noindex, site }) {
  return html`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${title} · ${site.name}` : site.name}</title>
${description ? html`<meta name="description" content="${description}">` : ''}
${noindex ? raw('<meta name="robots" content="noindex">') : ''}
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/courier-prime-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css">
</head>`;
}

function nav(req) {
  const u = req.user;
  return html`<header class="bar">
  <nav class="bar-l" aria-label="Principal">
    <a href="/">Inicio</a>
    <a href="/galeria">Galería</a>
    <a href="/subastas">Subastas</a>
  </nav>
  <nav class="bar-r" aria-label="Cuenta">
    ${u?.role === 'admin' ? html`<a href="/admin">Admin</a>` : ''}
    ${u ? html`<a href="/cuenta">Mi cuenta</a>` : html`<a href="/cuenta/entrar">Entrar</a>`}
  </nav>
</header>`;
}

function footer(req) {
  const year = new Date().getFullYear();
  return html`<footer class="foot">
  <nav aria-label="Legal">
    <a href="/legal/privacidad">Aviso de privacidad</a>
    <a href="/legal/terminos">Términos y condiciones</a>
    <a href="/legal/cookies">Cookies</a>
    <a href="/privacidad/solicitud">Tus datos</a>
    ${req.site.contactEmail ? html`<a href="mailto:${req.site.contactEmail}">Contacto</a>` : ''}
  </nav>
  <p>© ${year} ${req.site.artist}. Todas las obras y sus imágenes están protegidas por derechos de autor.</p>
</footer>`;
}

export function page(req, { title = '', description = '', body, scripts = [], bodyClass = '', noindex = false, bare = false }) {
  const m = MESSAGES[req.query?.m];
  return html`${head({ title, description, noindex, site: req.site })}
<body class="${bodyClass}">
<a class="skip" href="#main">Saltar al contenido</a>
${bare ? '' : nav(req)}
${m ? html`<div class="flash ${m[0]}" role="status">${m[1]}</div>` : ''}
<main id="main">
${body}
</main>
${footer(req)}
<script src="/js/site.js" defer></script>
${scripts.map((s) => html`<script src="/js/${s}" defer></script>`)}
</body>
</html>`;
}

export function errorPage(req, status, title, message) {
  req.site ??= { name: 'Galería', artist: '', contactEmail: '' };
  return page(req, {
    title,
    noindex: true,
    body: html`<section class="sheet center">
      <p class="idline">${status}</p>
      <h1>${title}</h1>
      <p class="note">${message}</p>
      <p class="mt"><a class="btn" href="/galeria">Ir a la galería</a></p>
    </section>`,
  });
}

// ---------- Componentes de formulario ----------
export function field({ label, name, type = 'text', value = '', error = null, hint = '', autocomplete = '', required = false, attrs = '' }) {
  const bad = error && error.field === name;
  return html`<div class="field${bad ? ' bad' : ''}">
    <label for="f-${name}">${label}${required ? '' : html` <small>(opcional)</small>`}</label>
    <input id="f-${name}" name="${name}" type="${type}" value="${type === 'password' ? '' : value ?? ''}"
      ${autocomplete ? html`autocomplete="${autocomplete}"` : ''} ${required ? 'required' : ''} ${raw(attrs)}
      ${bad ? html`aria-invalid="true" aria-describedby="e-${name}"` : ''}>
    ${hint ? html`<p class="hint">${hint}</p>` : ''}
    ${bad ? html`<p class="err" id="e-${name}">${error.message}</p>` : ''}
  </div>`;
}

export function countrySelect({ label = 'País', name = 'country', value = '', error = null, autocomplete = 'country' }) {
  const bad = error && error.field === name;
  return html`<div class="field${bad ? ' bad' : ''}">
    <label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}" required autocomplete="${autocomplete}">
      <option value="">Elige…</option>
      ${COUNTRIES.map((c) => html`<option value="${c.code}"${c.code === value ? ' selected' : ''}>${c.name}</option>`)}
    </select>
    ${bad ? html`<p class="err">${error.message}</p>` : ''}
  </div>`;
}

export function check({ name, label, checked = false, required = false, error = null }) {
  const bad = error && error.field === name;
  return html`<div class="check${bad ? ' bad' : ''}">
    <input type="checkbox" id="c-${name}" name="${name}" value="1"${checked ? ' checked' : ''}${required ? ' required' : ''}>
    <label for="c-${name}">${label}</label>
    ${bad ? html`<p class="err">${error.message}</p>` : ''}
  </div>`;
}

// Error general del formulario (los errores de un campo se muestran junto al campo).
export function formError(error, fieldNames = []) {
  if (!error || (error.field && fieldNames.includes(error.field))) return '';
  return html`<p class="err box" role="alert">${error.message}</p>`;
}

export function addressFields(a = {}, error = null) {
  return html`
    ${field({ label: 'Nombre de quien recibe', name: 'recipient', value: a.recipient, error, autocomplete: 'name', required: true })}
    ${field({ label: 'Teléfono de contacto para la entrega', name: 'phone', type: 'tel', value: a.phone, error, autocomplete: 'tel', required: true, hint: 'Con clave de país, por ejemplo +52 55 1234 5678.' })}
    ${field({ label: 'Calle y número', name: 'line1', value: a.line1, error, autocomplete: 'address-line1', required: true })}
    ${field({ label: 'Interior, colonia, referencias', name: 'line2', value: a.line2, error, autocomplete: 'address-line2' })}
    <div class="row2">
      ${field({ label: 'Ciudad', name: 'city', value: a.city, error, autocomplete: 'address-level2', required: true })}
      ${field({ label: 'Estado o provincia', name: 'state', value: a.state, error, autocomplete: 'address-level1', required: true })}
    </div>
    <div class="row2">
      ${field({ label: 'Código postal', name: 'postal_code', value: a.postal_code, error, autocomplete: 'postal-code', required: true })}
      ${countrySelect({ label: 'País de envío', name: 'country', value: a.country, error })}
    </div>`;
}

export const ADDRESS_FIELDS = ['recipient', 'phone', 'line1', 'line2', 'city', 'state', 'postal_code', 'country'];

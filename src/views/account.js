// Páginas de cuenta: registro, acceso, perfil y privacidad.
import { html } from '../lib/html.js';
import { fmtMoney, fmtDate } from '../lib/util.js';
import { PASSWORD_MIN } from '../lib/security.js';
import { STATUS_LABEL } from '../services/orders.js';
import { page, field, countrySelect, check, formError, addressFields, ADDRESS_FIELDS } from './layout.js';

const pwHint = `Mínimo ${PASSWORD_MIN} caracteres. Una frase larga es mejor que símbolos raros.`;

export function registerPage(req, { values = {}, error = null, next = '' } = {}) {
  return page(req, {
    title: 'Crear cuenta',
    noindex: true,
    body: html`<section class="sheet">
      <h1>Crear cuenta</h1>
      <p class="lead">Con una cuenta puedes comprar obra y participar en subastas. Solo pedimos lo necesario.</p>
      <form method="post" action="/cuenta/registro" class="form" novalidate>
        <input type="hidden" name="next" value="${next}">
        ${formError(error, ['name', 'email', 'country', 'password', 'adult', 'acceptLegal'])}
        ${field({ label: 'Nombre completo', name: 'name', value: values.name, error, autocomplete: 'name', required: true })}
        ${field({ label: 'Correo electrónico', name: 'email', type: 'email', value: values.email, error, autocomplete: 'email', required: true })}
        ${countrySelect({ label: 'País de residencia', value: values.country, error })}
        ${field({ label: 'Contraseña', name: 'password', type: 'password', error, autocomplete: 'new-password', required: true, hint: pwHint, attrs: `minlength="${PASSWORD_MIN}"` })}
        <fieldset class="consents">
          <legend class="sr">Consentimientos</legend>
          ${check({ name: 'adult', required: true, checked: values.adult, error, label: 'Confirmo que soy mayor de 18 años.' })}
          ${check({ name: 'acceptLegal', required: true, checked: values.acceptLegal, error, label: html`Acepto los <a class="link" href="/legal/terminos" target="_blank" rel="noopener">Términos y Condiciones</a> y confirmo que leí el <a class="link" href="/legal/privacidad" target="_blank" rel="noopener">Aviso de Privacidad</a>.` })}
          ${check({ name: 'marketing', checked: values.marketing, error, label: html`Quiero recibir por correo avisos de obra nueva y de próximas subastas. <small>(Opcional; puedes darte de baja cuando quieras.)</small>` })}
        </fieldset>
        <button class="btn" type="submit">Crear cuenta</button>
      </form>
      <p class="fine">¿Ya tienes cuenta? <a class="link" href="/cuenta/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}">Entrar</a></p>
    </section>`,
  });
}

export function checkEmailPage(req) {
  return page(req, {
    title: 'Revisa tu correo',
    noindex: true,
    body: html`<section class="sheet center">
      <h1>Revisa tu correo</h1>
      <p class="lead">Si el correo que escribiste es válido, en unos minutos recibirás un mensaje con un enlace para confirmar tu cuenta. El enlace vence en 48 horas.</p>
      <p class="note">¿No llega? Revisa la carpeta de correo no deseado.</p>
      <p class="mt"><a class="btn" href="/cuenta/entrar">Entrar</a></p>
    </section>`,
  });
}

export function loginPage(req, { values = {}, error = null, next = '' } = {}) {
  return page(req, {
    title: 'Entrar',
    noindex: true,
    body: html`<section class="sheet">
      <h1>Entrar</h1>
      <form method="post" action="/cuenta/entrar" class="form" novalidate>
        <input type="hidden" name="next" value="${next}">
        ${formError(error)}
        ${field({ label: 'Correo electrónico', name: 'email', type: 'email', value: values.email, autocomplete: 'username', required: true })}
        ${field({ label: 'Contraseña', name: 'password', type: 'password', autocomplete: 'current-password', required: true })}
        <button class="btn" type="submit">Entrar</button>
      </form>
      <p class="fine"><a class="link" href="/cuenta/recuperar">Olvidé mi contraseña</a> · <a class="link" href="/cuenta/registro${next ? `?next=${encodeURIComponent(next)}` : ''}">Crear cuenta</a></p>
    </section>`,
  });
}

export function forgotPage(req, { sent = false } = {}) {
  return page(req, {
    title: 'Recuperar contraseña',
    noindex: true,
    body: html`<section class="sheet">
      <h1>Recuperar contraseña</h1>
      ${sent ? html`<p class="lead">Si existe una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. Vence en 1 hora.</p>
        <p class="mt"><a class="link" href="/cuenta/entrar">Volver a entrar</a></p>` : html`
      <form method="post" action="/cuenta/recuperar" class="form">
        ${field({ label: 'Correo electrónico', name: 'email', type: 'email', autocomplete: 'email', required: true })}
        <button class="btn" type="submit">Enviar enlace</button>
      </form>`}
    </section>`,
  });
}

export function resetPage(req, { token, error = null }) {
  return page(req, {
    title: 'Nueva contraseña',
    noindex: true,
    body: html`<section class="sheet">
      <h1>Nueva contraseña</h1>
      <form method="post" action="/cuenta/restablecer" class="form">
        <input type="hidden" name="token" value="${token}">
        ${formError(error, ['password'])}
        ${field({ label: 'Contraseña nueva', name: 'password', type: 'password', error, autocomplete: 'new-password', required: true, hint: pwHint, attrs: `minlength="${PASSWORD_MIN}"` })}
        <button class="btn" type="submit">Guardar contraseña</button>
      </form>
    </section>`,
  });
}

export function accountPage(req, { user, address, orders, auctions, error = null, form = '', values = null }) {
  const pv = form === 'profile' && values ? values : user;
  const av = form === 'address' && values ? values : address || { recipient: user.name, phone: user.phone, country: user.country };
  return page(req, {
    title: 'Mi cuenta',
    noindex: true,
    body: html`<section class="sheet wide">
      <h1>Mi cuenta</h1>
      <p class="lead">${user.email}</p>
      ${user.email_verified_at ? '' : html`<div class="callout">
        <p><strong>Falta confirmar tu correo.</strong> Te enviamos un enlace al crear la cuenta; sin confirmarlo no puedes comprar ni pujar.</p>
        <form method="post" action="/cuenta/reenviar-verificacion"><button class="linkbtn" type="submit">Reenviar enlace de confirmación</button></form>
      </div>`}

      <h2>Pedidos</h2>
      ${orders.length ? html`<ul class="olist">${orders.map((o) => html`<li>
        <a class="link" href="/pedidos/${o.code}">${o.code}</a>
        <span>${o.work_title}</span>
        <span>${fmtMoney(o.total_cents)}</span>
        <span class="m">${STATUS_LABEL[o.status]} · ${fmtDate(o.created_at)}</span>
      </li>`)}</ul>` : html`<p class="note">Todavía no tienes pedidos.</p>`}

      ${auctions.length ? html`<h2>Subastas</h2>
      <ul class="olist">${auctions.map((a) => html`<li>
        <a class="link" href="/obra/${a.work_code}">${a.work_title}</a>
        <span>Paleta ${a.paddle}</span>
        <span>${a.my_top ? `Tu puja más alta: ${fmtMoney(a.my_top)}` : 'Sin pujas'}</span>
        <span class="m">${{ live: a.leading ? 'En curso · vas ganando' : 'En curso', scheduled: 'Próxima', sold: a.won ? 'Ganaste' : 'Concluida', unsold: 'Concluida sin venta', cancelled: 'Cancelada' }[a.status]}</span>
      </li>`)}</ul>` : ''}

      <h2 id="perfil">Perfil</h2>
      <form method="post" action="/cuenta/perfil" class="form">
        ${form === 'profile' ? formError(error, ['name', 'phone', 'country']) : ''}
        ${field({ label: 'Nombre completo', name: 'name', value: pv.name, error: form === 'profile' ? error : null, autocomplete: 'name', required: true })}
        ${field({ label: 'Teléfono', name: 'phone', type: 'tel', value: pv.phone, error: form === 'profile' ? error : null, autocomplete: 'tel', hint: 'Necesario para participar en subastas y para coordinar entregas. Con clave de país.' })}
        ${countrySelect({ label: 'País de residencia', value: pv.country, error: form === 'profile' ? error : null })}
        <button class="btn ghost" type="submit">Guardar perfil</button>
      </form>

      <h2 id="direccion">Dirección de envío</h2>
      <form method="post" action="/cuenta/direccion" class="form">
        ${form === 'address' ? formError(error, ADDRESS_FIELDS) : ''}
        ${addressFields(av, form === 'address' ? error : null)}
        <button class="btn ghost" type="submit">Guardar dirección</button>
      </form>
      ${address ? html`<form method="post" action="/cuenta/direccion/eliminar" class="inline"><button class="linkbtn" type="submit">Eliminar dirección guardada</button></form>` : ''}

      <h2>Seguridad y privacidad</h2>
      <p><a class="link" href="/cuenta/privacidad">Contraseña, consentimientos, descarga y eliminación de tus datos</a></p>
      <form method="post" action="/cuenta/salir" class="mt"><button class="btn ghost" type="submit">Cerrar sesión</button></form>
    </section>`,
  });
}

export function privacyCenterPage(req, { user, consents, error = null, form = '' }) {
  const KIND = { privacy: 'Aviso de Privacidad', terms: 'Términos y Condiciones', auction_rules: 'Reglas de Subasta', marketing: 'Avisos por correo', owner_name_public: 'Nombre público en certificado' };
  return page(req, {
    title: 'Seguridad y privacidad',
    noindex: true,
    body: html`<section class="sheet wide">
      <p class="idline"><a class="link" href="/cuenta">Mi cuenta</a></p>
      <h1>Seguridad y privacidad</h1>
      <p class="lead">Aquí ejerces directamente tus derechos sobre tus datos personales. Para cualquier otra solicitud usa el <a class="link" href="/privacidad/solicitud">formulario de derechos</a>.</p>

      <h2>Cambiar contraseña</h2>
      <form method="post" action="/cuenta/contrasena" class="form">
        ${form === 'password' ? formError(error, ['current', 'password']) : ''}
        ${field({ label: 'Contraseña actual', name: 'current', type: 'password', error: form === 'password' ? error : null, autocomplete: 'current-password', required: true })}
        ${field({ label: 'Contraseña nueva', name: 'password', type: 'password', error: form === 'password' ? error : null, autocomplete: 'new-password', required: true, hint: pwHint })}
        <button class="btn ghost" type="submit">Cambiar contraseña</button>
      </form>

      <h2>Avisos por correo (opcional)</h2>
      <form method="post" action="/cuenta/consentimientos" class="form">
        ${check({ name: 'marketing', checked: Boolean(user.marketing_opt_in), label: 'Quiero recibir avisos de obra nueva y de próximas subastas.' })}
        <button class="btn ghost" type="submit">Guardar preferencia</button>
        <p class="fine">Los correos sobre tus pedidos y pujas son parte del servicio y se envían siempre.</p>
      </form>

      <h2>Descargar mis datos</h2>
      <p>Obtén una copia completa de los datos personales que tenemos sobre ti, en un formato estructurado y legible por máquina (JSON).</p>
      <p><a class="btn ghost" href="/cuenta/mis-datos.json" download>Descargar mis datos</a></p>

      <h2>Corregir mis datos</h2>
      <p>Puedes corregir tu nombre, teléfono, país y dirección en <a class="link" href="/cuenta#perfil">tu cuenta</a>. Para cambiar tu correo, usa el <a class="link" href="/privacidad/solicitud">formulario de derechos</a>.</p>

      <h2>Historial de consentimientos</h2>
      <ul class="olist">${consents.map((c) => html`<li>
        <span>${KIND[c.kind] || c.kind}</span><span>${c.granted ? 'Otorgado' : 'Retirado'}</span><span class="m">versión ${c.version} · ${fmtDate(c.created_at)}</span>
      </li>`)}</ul>

      <h2 class="danger">Eliminar mi cuenta</h2>
      <p>Se borran tu perfil, tu dirección y tus sesiones, y tu historial de pujas queda anónimo. Los comprobantes de compras se conservan bloqueados durante el plazo que exige la ley fiscal y después se eliminan. Esta acción no se puede deshacer.</p>
      <form method="post" action="/cuenta/eliminar" class="form" data-confirm="¿Eliminar tu cuenta de forma definitiva?">
        ${form === 'delete' ? formError(error, ['password']) : ''}
        ${field({ label: 'Escribe tu contraseña para confirmar', name: 'password', type: 'password', error: form === 'delete' ? error : null, autocomplete: 'current-password', required: true })}
        <button class="btn danger" type="submit">Eliminar mi cuenta</button>
      </form>
    </section>`,
  });
}

export function privacyRequestPage(req, { values = {}, error = null }) {
  const kinds = [
    ['acceso', 'Acceso: saber qué datos tienen de mí y obtener copia'],
    ['rectificacion', 'Rectificación: corregir datos inexactos o incompletos'],
    ['cancelacion', 'Cancelación / supresión: eliminar mis datos'],
    ['oposicion', 'Oposición: que dejen de usar mis datos para algún fin'],
    ['limitacion', 'Limitación del uso o divulgación de mis datos'],
    ['portabilidad', 'Portabilidad: recibir mis datos en formato reutilizable'],
    ['revocacion', 'Revocar un consentimiento'],
    ['otro', 'Otra consulta o queja de privacidad'],
  ];
  return page(req, {
    title: 'Ejercer tus derechos de privacidad',
    body: html`<section class="sheet">
      <h1>Tus datos, tus derechos</h1>
      <p class="lead">Usa este formulario para ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO), así como los de supresión, limitación, portabilidad y revocación del consentimiento, conforme a nuestro <a class="link" href="/legal/privacidad">Aviso de Privacidad</a>.</p>
      ${req.user ? html`<p class="note">Si tienes cuenta, muchas de estas acciones puedes hacerlas tú al instante en <a class="link" href="/cuenta/privacidad">Seguridad y privacidad</a>.</p>` : ''}
      <form method="post" action="/privacidad/solicitud" class="form">
        ${formError(error, ['name', 'email', 'kind', 'message'])}
        ${field({ label: 'Nombre completo', name: 'name', value: values.name ?? req.user?.name, error, autocomplete: 'name', required: true })}
        ${field({ label: 'Correo electrónico (el de tu cuenta, si tienes)', name: 'email', type: 'email', value: values.email ?? req.user?.email, error, autocomplete: 'email', required: true })}
        <div class="field${error?.field === 'kind' ? ' bad' : ''}">
          <label for="f-kind">¿Qué derecho quieres ejercer?</label>
          <select id="f-kind" name="kind" required>
            <option value="">Elige…</option>
            ${kinds.map(([v, l]) => html`<option value="${v}"${values.kind === v ? ' selected' : ''}>${l}</option>`)}
          </select>
          ${error?.field === 'kind' ? html`<p class="err">${error.message}</p>` : ''}
        </div>
        <div class="field${error?.field === 'message' ? ' bad' : ''}">
          <label for="f-message">Describe tu solicitud</label>
          <textarea id="f-message" name="message" rows="6" required maxlength="4000">${values.message ?? ''}</textarea>
          <p class="hint">Indica con claridad los datos a los que se refiere. No incluyas documentos ni datos sensibles aquí: si necesitamos acreditar tu identidad, te lo pediremos por correo.</p>
          ${error?.field === 'message' ? html`<p class="err">${error.message}</p>` : ''}
        </div>
        <button class="btn" type="submit">Enviar solicitud</button>
      </form>
      <p class="fine">Respondemos en un máximo de 20 días hábiles (o en el plazo menor que marque la ley de tu país, por ejemplo un mes bajo el RGPD). Ejercer tus derechos es gratuito.</p>
    </section>`,
  });
}

// Piezas comunes de los documentos legales.
import { html } from '../lib/html.js';
import { page } from './layout.js';

// Dato que la persona titular del sitio debe configurar antes de publicar.
export const ph = (value, label) => (value ? value : html`<mark class="todo">[PENDIENTE: ${label}]</mark>`);

const fmtVersion = (v, locale) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}T00:00:00Z`));

export function legalDoc(req, { title, lang, other, version, body }) {
  return page(req, {
    title,
    body: html`<article class="sheet legal" lang="${lang}">
      <p class="idline">${lang === 'es'
        ? html`Versión vigente desde el ${fmtVersion(version, 'es-MX')} · <a class="link" href="${other}" hreflang="en" lang="en">English version</a>`
        : html`In force since ${fmtVersion(version, 'en-GB')} · <a class="link" href="${other}" hreflang="es" lang="es">Versión en español</a>`}</p>
      ${body}
    </article>`,
  });
}

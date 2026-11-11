// Plantillas con escape automático: todo valor interpolado en html`...` se escapa,
// salvo que ya sea un fragmento seguro (otro html`...` o raw()).

export class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += render(vals[i]);
  }
  return new Safe(out);
}

export const raw = (s) => new Safe(String(s));

// JSON seguro para incrustar en <script type="application/json">.
export function jsonScript(data) {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return raw(JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll(LS, '\\u2028').replaceAll(PS, '\\u2029'));
}

// Utilidades compartidas: errores, dinero, fechas, limpieza y validación de entradas.

// Error con mensaje apto para mostrarse a la persona usuaria.
export class AppError extends Error {
  constructor(message, { code = 'invalid', status = 400, field = null, data = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.field = field;
    this.data = data;
  }
}

// ---------- Dinero (centavos enteros) ----------
const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function fmtMoney(cents) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return moneyFmt.format(cents / 100) + ' MXN';
}

// "8,500" | "8500.50" | "$8,500.00" -> centavos. Devuelve null si no es una cantidad válida.
export function parsePesos(input) {
  const s = String(input ?? '').replace(/[$\s,]/g, '').replace(/MXN/i, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

// Importe en formato decimal para APIs de pago: 850000 -> "8500.00"
export const centsToDecimal = (cents) => (cents / 100).toFixed(2);

// ---------- Fechas ----------
const TZ = 'America/Mexico_City';
const dateFmt = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtDate = (ms) => (ms ? dateFmt.format(new Date(ms)) : '');
export const fmtDateTime = (ms) => (ms ? `${dateTimeFmt.format(new Date(ms))} (hora del centro de México)` : '');
export const isoDate = (ms) => new Date(ms).toISOString();

// ---------- Texto ----------
// Recorta, quita caracteres de control y limita el largo.
export function clean(v, max = 200) {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
export function cleanLine(v, max = 200) {
  return clean(v, max).replace(/[\r\n\t]+/g, ' ');
}

export function normalizeEmail(v) {
  return cleanLine(v, 254).toLowerCase();
}
export function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(v);
}

// Solo permite redirecciones a rutas internas.
export function safeNext(v, fallback = '/cuenta') {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.includes('\\') || v.length > 300) return fallback;
  return v;
}

// ---------- Países (ISO 3166-1 alfa-2) ----------
const CODES = ('MX US CA ES AR BO BR CL CO CR CU DO EC SV GT HN NI PA PY PE PR UY VE ' +
  'AD AE AF AG AI AL AM AO AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BS BT BW BY BZ CD CF CG CH CI CM CN CV CW CY CZ ' +
  'DE DJ DK DM DZ EE EG ER ET FI FJ FO FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GW GY HK HR HT HU ID IE IL IN IQ IR IS IT ' +
  'JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MS MT MU MV ' +
  'MW MY MZ NA NC NE NG NL NO NP NR NZ OM PF PG PH PK PL PT PW QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST ' +
  'SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG UZ VA VC VG VI VN VU WS YE YT ZA ZM ZW').split(' ');
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
const collator = new Intl.Collator('es');
export const COUNTRIES = CODES.map((code) => ({ code, name: regionNames.of(code) }))
  .sort((a, b) => (a.code === 'MX' ? -1 : b.code === 'MX' ? 1 : collator.compare(a.name, b.name)));
const COUNTRY_SET = new Set(CODES);
export const isCountry = (c) => COUNTRY_SET.has(c);
export const countryName = (c) => (COUNTRY_SET.has(c) ? regionNames.of(c) : c || '');

// Estados miembros del EEE + Reino Unido + Suiza (para avisos de consumo/privacidad).
export const EEA_UK = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH'.split(' '));

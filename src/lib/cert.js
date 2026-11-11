// Certificados de autenticidad: fichas JSON firmadas con Ed25519.
// El formato es el mismo del sitio anterior, así que las fichas ya firmadas siguen valiendo.
// La llave privada nunca toca el servidor: se firma fuera de línea con tools/sign-work.js.
import crypto from 'node:crypto';
import fs from 'node:fs';

// Orden determinista de llaves: el mismo contenido produce siempre el mismo texto.
export function canonicalize(obj) {
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = canonicalize(obj[k]); return acc; }, {});
  }
  return obj;
}

export function canonicalText(cert) {
  const copy = { ...cert };
  delete copy.signature;
  delete copy.publicKeyBase64;
  return JSON.stringify(canonicalize(copy));
}

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
function publicKeyFromRaw(b64) {
  const raw = Buffer.from(b64, 'base64');
  if (raw.length !== 32) throw new Error('llave pública inválida');
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
}

export function loadKeys(file) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Devuelve { ok, reason }. `keys` es el historial público de llaves (certs/keys.json).
export function verifyCertificate(cert, keys) {
  if (!cert || typeof cert !== 'object' || Array.isArray(cert)) return { ok: false, reason: 'La ficha no es un objeto JSON.' };
  if (!cert.signature || !cert.publicKeyBase64) return { ok: false, reason: 'La ficha no trae firma.' };
  let valid = false;
  try {
    valid = crypto.verify(null, Buffer.from(canonicalText(cert), 'utf8'), publicKeyFromRaw(cert.publicKeyBase64), Buffer.from(cert.signature, 'base64'));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'Firma no válida: el contenido no coincide con lo firmado.' };
  const entry = keys.find((k) => k.publicKeyBase64 === cert.publicKeyBase64);
  if (!entry) return { ok: false, reason: 'La llave que firmó no está en el historial de llaves del artista (certs/keys.json).' };
  if (entry.revoked) return { ok: false, reason: 'La llave que firmó está revocada.' };
  return { ok: true };
}

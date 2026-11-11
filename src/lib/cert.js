// Certificados de autenticidad como Credenciales Verificables del W3C.
//
// Estándares que se siguen:
//   - W3C Verifiable Credentials Data Model 2.0 (formato de la credencial).
//   - W3C Data Integrity, suite criptográfica "eddsa-jcs-2022": firma Ed25519 (RFC 8032)
//     sobre el documento canonizado con JCS (RFC 8785).
//   - Identidad del emisor: DID "did:web" (el dominio del sitio) con llaves en formato Multikey.
//   - Huella de cada foto: Subresource Integrity (digestSRI, SHA-256).
//   - Descripción de la obra: vocabulario schema.org/VisualArtwork + campos de Object ID
//     (norma internacional ICOM/Getty para describir objetos de arte).
//
// La llave privada nunca toca el servidor: se firma en el equipo del artista.
// El formato anterior del sitio (ficha con "signature" y "publicKeyBase64") se sigue
// pudiendo verificar, pero ya no se emite.
import crypto from 'node:crypto';
import fs from 'node:fs';

export const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const CRYPTOSUITE = 'eddsa-jcs-2022';

// ---------- base58btc / Multikey ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
  return out;
}

export function base58Decode(str) {
  let n = 0n;
  for (const ch of str) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error('base58 inválido');
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of str) { if (ch !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}

const ED25519_PUB = Buffer.from([0xed, 0x01]); // prefijo multicodec de una llave pública Ed25519
const ED25519_PRIV = Buffer.from([0x80, 0x26]);

// Llave pública cruda (32 bytes) <-> Multikey ("z6Mk…").
export const multikeyFromRaw = (raw) => 'z' + base58Encode(Buffer.concat([ED25519_PUB, raw]));
export function rawFromMultikey(mk) {
  if (typeof mk !== 'string' || mk[0] !== 'z') throw new Error('Multikey inválida');
  const bytes = base58Decode(mk.slice(1));
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) throw new Error('No es una llave Ed25519');
  return bytes.subarray(2);
}
export const multikeyFromBase64 = (b64) => multikeyFromRaw(Buffer.from(b64, 'base64'));

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const publicKeyObject = (raw) => crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });

export function rawPublicKeyOf(privateKey) {
  const der = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return der.subarray(der.length - 32);
}
// Llave privada en Multikey ("z3u2…"), como la publican los vectores de prueba del W3C.
export function privateKeyFromMultibase(mb) {
  const bytes = base58Decode(mb.slice(1));
  if (bytes.length !== 34 || !bytes.subarray(0, 2).equals(ED25519_PRIV)) throw new Error('Llave privada inválida');
  return crypto.createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, bytes.subarray(2)]), format: 'der', type: 'pkcs8' });
}

// ---------- JCS (RFC 8785) ----------
// Llaves ordenadas por unidades de código UTF-16 y serialización ECMAScript de números y cadenas.
export function jcs(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS no admite NaN ni infinitos');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map((v) => jcs(v === undefined ? null : v)).join(',') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ':' + jcs(value[k])).join(',') + '}';
  }
  throw new Error('Valor no serializable');
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

// Datos que se firman: SHA-256(configuración de la prueba) || SHA-256(documento).
function hashData(document, proofConfig) {
  return Buffer.concat([sha256(jcs(proofConfig)), sha256(jcs(document))]);
}

// ---------- DID del emisor ----------
// did:web del sitio: https://ejemplo.com -> did:web:ejemplo.com (documento en /.well-known/did.json).
export function didWeb(baseUrl) {
  return 'did:web:' + new URL(baseUrl).host.replace(':', '%3A');
}

export function loadKeys(file) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(list) ? list.filter((k) => k && typeof k.publicKeyBase64 === 'string') : [];
  } catch {
    return [];
  }
}

// Documento DID: publica las llaves de firma. Las revocadas se conservan (para explicar por
// qué un certificado antiguo ya no vale) pero salen de "assertionMethod".
export function didDocument(did, keys) {
  const vm = keys.map((k) => {
    const mk = multikeyFromBase64(k.publicKeyBase64);
    return {
      id: `${did}#${mk}`, type: 'Multikey', controller: did, publicKeyMultibase: mk,
      ...(k.revoked ? { revoked: `${k.revokedDate || k.created || '1970-01-01'}T00:00:00Z` } : {}),
    };
  });
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    verificationMethod: vm,
    assertionMethod: vm.filter((m) => !m.revoked).map((m) => m.id),
  };
}

// ---------- Firmar ----------
export function signCredential(credential, privateKey, { verificationMethod, created = new Date().toISOString().replace(/\.\d+Z$/, 'Z') } = {}) {
  const document = { ...credential };
  delete document.proof;
  const proof = {
    type: 'DataIntegrityProof',
    cryptosuite: CRYPTOSUITE,
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
    ...(document['@context'] ? { '@context': document['@context'] } : {}),
  };
  const signature = crypto.sign(null, hashData(document, proof), privateKey);
  return { ...document, proof: { ...proof, proofValue: 'z' + base58Encode(signature) } };
}

// ---------- Verificar ----------
const issuerId = (c) => (typeof c.issuer === 'string' ? c.issuer : c.issuer?.id);

// Comprueba solo la criptografía de la prueba contra una llave pública cruda.
export function verifyProof(credential, rawPublicKey) {
  const { proof, ...document } = credential;
  if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== CRYPTOSUITE || typeof proof.proofValue !== 'string') return false;
  if (proof['@context']) {
    // El contexto de la prueba debe ser el inicio del contexto del documento.
    const a = [].concat(proof['@context']); const b = [].concat(document['@context'] ?? []);
    if (a.length > b.length || a.some((v, i) => jcs(v) !== jcs(b[i]))) return false;
  }
  const { proofValue, ...proofConfig } = proof;
  try {
    if (proofValue[0] !== 'z') return false;
    return crypto.verify(null, hashData(document, proofConfig), publicKeyObject(rawPublicKey), base58Decode(proofValue.slice(1)));
  } catch {
    return false;
  }
}

function verifyVc(credential, keys, did) {
  const types = [].concat(credential.type ?? []);
  const ctx = [].concat(credential['@context'] ?? []);
  if (ctx[0] !== VC_CONTEXT || !types.includes('VerifiableCredential')) return { ok: false, reason: 'No es una Credencial Verificable (W3C VC 2.0).' };
  const proof = credential.proof;
  if (!proof || Array.isArray(proof)) return { ok: false, reason: 'La credencial no trae una prueba (firma).' };
  if (proof.proofPurpose !== 'assertionMethod') return { ok: false, reason: 'La prueba no es de tipo «assertionMethod».' };
  const [vmDid, fragment] = String(proof.verificationMethod ?? '').split('#');
  if (did && (issuerId(credential) !== did || vmDid !== did)) {
    return { ok: false, reason: `El emisor de la credencial no es este sitio (${did}).` };
  }
  if (vmDid !== issuerId(credential)) return { ok: false, reason: 'La llave que firma no pertenece al emisor declarado.' };
  let raw;
  try { raw = rawFromMultikey(fragment); } catch { return { ok: false, reason: 'La prueba no identifica una llave Ed25519 válida.' }; }
  if (!verifyProof(credential, raw)) return { ok: false, reason: 'Firma no válida: el contenido no coincide con lo firmado.' };
  const entry = keys.find((k) => k.publicKeyBase64 === raw.toString('base64'));
  if (!entry) return { ok: false, reason: 'La llave que firmó no está en el historial de llaves del artista.' };
  if (entry.revoked) return { ok: false, reason: 'La llave que firmó está revocada.' };
  return { ok: true, format: 'vc' };
}

// Formato anterior del sitio: JSON con "signature" + "publicKeyBase64" (Ed25519 sobre JCS).
function verifyLegacy(cert, keys) {
  const { signature, publicKeyBase64, ...body } = cert;
  let valid = false;
  try {
    valid = crypto.verify(null, Buffer.from(jcs(body), 'utf8'), publicKeyObject(Buffer.from(publicKeyBase64, 'base64')), Buffer.from(signature, 'base64'));
  } catch { valid = false; }
  if (!valid) return { ok: false, reason: 'Firma no válida: el contenido no coincide con lo firmado.' };
  const entry = keys.find((k) => k.publicKeyBase64 === publicKeyBase64);
  if (!entry) return { ok: false, reason: 'La llave que firmó no está en el historial de llaves del artista.' };
  if (entry.revoked) return { ok: false, reason: 'La llave que firmó está revocada.' };
  return { ok: true, format: 'legacy' };
}

// Devuelve { ok, reason, format }. `keys` es el historial público de llaves; `did`, el del sitio.
export function verifyCertificate(cert, keys, { did = null } = {}) {
  if (!cert || typeof cert !== 'object' || Array.isArray(cert)) return { ok: false, reason: 'El archivo no es un objeto JSON.' };
  if (cert.proof || cert['@context']) return verifyVc(cert, keys, did);
  if (cert.signature && cert.publicKeyBase64) return verifyLegacy(cert, keys);
  return { ok: false, reason: 'El archivo no trae firma.' };
}

// Huella de un recurso en formato Subresource Integrity.
export const sriFromHex = (hex) => 'sha256-' + Buffer.from(hex, 'hex').toString('base64');

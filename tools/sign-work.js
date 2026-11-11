// sign-work.js — firma el certificado de una obra con tu llave privada, en tu equipo.
//
//   npm run cert:sign -- TLK-2026-014.json
//
// 1. En el panel de administración, descarga la "credencial sin firmar" de la obra.
// 2. Corre este comando: agrega al archivo la prueba ("proof") según el estándar W3C
//    Verifiable Credentials 2.0 / Data Integrity eddsa-jcs-2022 (Ed25519 sobre JCS).
// 3. Sube el archivo firmado en el panel de administración.
//
// (También puedes firmar directamente en el panel, sin usar este comando.)
// Cualquier cambio posterior al archivo invalida la firma.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signCredential, rawPublicKeyOf, multikeyFromRaw } from '../src/lib/cert.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: npm run cert:sign -- ruta/a/la-ficha.json');
  process.exit(1);
}
const privatePath = process.env.CERTIFY_PRIVATE_KEY || path.join(root, 'private-key.pem');
const keysPath = path.join(root, 'certs', 'keys.json');
if (!fs.existsSync(privatePath)) {
  console.error('No encuentro private-key.pem. Corre primero: npm run cert:keygen');
  process.exit(1);
}

const privateKey = crypto.createPrivateKey(fs.readFileSync(privatePath, 'utf8'));
const raw = rawPublicKeyOf(privateKey);
const publicKeyBase64 = raw.toString('base64');

const keys = fs.existsSync(keysPath) ? JSON.parse(fs.readFileSync(keysPath, 'utf8')) : [];
const entry = keys.find((k) => k.publicKeyBase64 === publicKeyBase64);
if (!entry) {
  console.error('Esta llave no está en certs/keys.json, así que el sitio rechazaría la firma.\nAgrégala con `npm run cert:keygen` (llave nueva) o restaura tu keys.json.');
  process.exit(1);
}
if (entry.revoked) {
  console.error('La llave privada que estás usando está marcada como REVOCADA en certs/keys.json. No se firmó nada.');
  process.exit(1);
}

const credential = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const issuer = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer?.id;
if (!credential['@context'] || !issuer) {
  console.error('Ese archivo no es una credencial sin firmar. Descárgala desde el panel de administración (página de la obra).');
  process.exit(1);
}
const signed = signCredential(credential, privateKey, { verificationMethod: `${issuer}#${multikeyFromRaw(raw)}` });
fs.writeFileSync(filePath, JSON.stringify(signed, null, 2) + '\n');

console.log(`Firmado: ${filePath}`);
console.log(`Obra: ${signed.credentialSubject?.identifier} · Propietario: ${signed.credentialSubject?.currentOwner || '(vacío)'}`);
console.log(`Emisor: ${issuer}`);

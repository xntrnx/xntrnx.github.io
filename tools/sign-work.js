// sign-work.js — firma la ficha de una obra con tu llave privada (fuera de línea).
//
//   npm run cert:sign -- TLK-2026-014.json
//
// 1. En el panel de administración, descarga la "ficha sin firmar" de la obra.
// 2. Corre este comando: quita cualquier firma anterior, ordena las llaves de forma
//    determinista, firma ese texto exacto con Ed25519 y reescribe el archivo agregando
//    "signature" y "publicKeyBase64".
// 3. Sube el archivo firmado en el panel de administración.
//
// Cualquier cambio posterior al archivo (una fecha, una palabra) invalida la firma.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalText } from '../src/lib/cert.js';

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
const publicRaw = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
const publicKeyBase64 = publicRaw.subarray(publicRaw.length - 32).toString('base64');

const keys = fs.existsSync(keysPath) ? JSON.parse(fs.readFileSync(keysPath, 'utf8')) : [];
const entry = keys.find((k) => k.publicKeyBase64 === publicKeyBase64);
if (!entry) {
  console.error('Esta llave no está en certs/keys.json, así que el sitio rechazaría la firma.\nAgrégala con `npm run cert:keygen` (llave nueva) o restaura tu keys.json, y vuelve a desplegar.');
  process.exit(1);
}
if (entry.revoked) {
  console.error('La llave privada que estás usando está marcada como REVOCADA en certs/keys.json. No se firmó nada.');
  process.exit(1);
}

const work = JSON.parse(fs.readFileSync(filePath, 'utf8'));
delete work.signature;
delete work.publicKeyBase64;
const signature = crypto.sign(null, Buffer.from(canonicalText(work), 'utf8'), privateKey);
work.publicKeyBase64 = publicKeyBase64;
work.signature = signature.toString('base64');
fs.writeFileSync(filePath, JSON.stringify(work, null, 2) + '\n');

console.log(`Firmado: ${filePath}`);
console.log(`Obra: ${work.id || "(sin campo 'id')"} · Propietario en la ficha: ${work.propietarioActual || '(vacío)'}`);

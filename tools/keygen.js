// keygen.js — genera un par de llaves Ed25519 para firmar certificados y agrega la
// llave pública a certs/keys.json.
//
//   npm run cert:keygen
//
// Produce / actualiza:
//   private-key.pem   -> GUÁRDALA FUERA DE LÍNEA. Nunca se sube (está en .gitignore)
//                        y nunca debe copiarse al servidor.
//   certs/keys.json   -> Historial de llaves públicas. Esta SÍ va al repositorio:
//                        el sitio la usa para comprobar firmas.
//
// Rotar llave: mueve o borra tu private-key.pem y vuelve a correr este script. La llave
// anterior se conserva en el historial, así que las obras ya firmadas siguen verificándose.
// Si te ROBARON la llave, además revócala:  npm run cert:revoke -- LLAVE_PUBLICA_BASE64
//
// Otra ubicación para la llave privada (por ejemplo, una USB):
//   CERTIFY_PRIVATE_KEY=/Volumes/USB/private-key.pem npm run cert:keygen
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privatePath = process.env.CERTIFY_PRIVATE_KEY || path.join(root, 'private-key.pem');
const keysPath = path.join(root, 'certs', 'keys.json');

if (fs.existsSync(privatePath)) {
  console.error(`Ya existe ${privatePath}.\nSi es la que usas para firmar, no hay nada que hacer.\nPara reemplazarla, muévela o bórrala y vuelve a correr este comando.`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicRaw = publicKey.export({ type: 'spki', format: 'der' });
// Los últimos 32 bytes del SPKI DER son la llave pública Ed25519 cruda.
const publicKeyBase64 = publicRaw.subarray(publicRaw.length - 32).toString('base64');

let keys = [];
if (fs.existsSync(keysPath)) {
  try { keys = JSON.parse(fs.readFileSync(keysPath, 'utf8')); } catch {
    console.error('certs/keys.json existe pero no es JSON válido. Revísalo a mano.');
    process.exit(1);
  }
}
const isRotation = keys.length > 0;
keys.push({ publicKeyBase64, created: new Date().toISOString().slice(0, 10), revoked: false });

fs.writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2) + '\n');

console.log(isRotation ? 'Llave rotada.' : 'Llave generada.');
console.log(`\n  ${privatePath}  (NO subir a git ni al servidor)`);
console.log(`  ${keysPath}  (sí va al repositorio; vuelve a desplegar el sitio)`);
console.log('\nLlave pública nueva (base64):', publicKeyBase64);

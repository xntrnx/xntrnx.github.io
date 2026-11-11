// revoke-key.js — marca una llave pública como revocada (por ejemplo, si te robaron la
// llave privada). Los certificados firmados con ella dejarán de verificarse como auténticos.
//
//   npm run cert:revoke -- LLAVE_PUBLICA_BASE64
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const keysPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'certs', 'keys.json');
const pub = process.argv[2];
if (!pub) {
  console.error('Uso: npm run cert:revoke -- LLAVE_PUBLICA_BASE64');
  process.exit(1);
}
const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
const entry = keys.find((k) => k.publicKeyBase64 === pub);
if (!entry) {
  console.error('Esa llave no está en certs/keys.json.');
  process.exit(1);
}
entry.revoked = true;
entry.revokedDate = new Date().toISOString().slice(0, 10);
fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2) + '\n');
console.log(`Llave revocada con fecha ${entry.revokedDate}. Sube certs/keys.json al repositorio y vuelve a desplegar.`);
console.log('Después, firma de nuevo con tu llave nueva las fichas de las obras afectadas.');

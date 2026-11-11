// backup.js — respaldo consistente de la base de datos (se puede correr con el sitio encendido).
//
//   npm run backup            -> DATA_DIR/backups/galeria-AAAA-MM-DD-HHMMSS.db
//
// Prográmalo a diario (cron o el programador de tu hosting) y copia el archivo, junto con
// DATA_DIR/uploads, a un almacenamiento fuera del servidor. El respaldo contiene datos
// personales: guárdalo cifrado y bórralo cuando ya no haga falta. Conserva los últimos 14.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';

const config = loadConfig();
const dir = path.join(config.dataDir, 'backups');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(/-(\d\d)-(\d\d)-(\d\d)$/, '-$1$2$3');
const file = path.join(dir, `galeria-${stamp}.db`);

const db = openDb(config.dbFile);
await db.backup(file);
db.close();
fs.chmodSync(file, 0o600);
console.log(`Respaldo listo: ${file}`);

const old = fs.readdirSync(dir).filter((f) => /^galeria-.*\.db$/.test(f)).sort().slice(0, -14);
for (const f of old) fs.rmSync(path.join(dir, f));
if (old.length) console.log(`Se borraron ${old.length} respaldos antiguos.`);

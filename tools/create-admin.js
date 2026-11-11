// create-admin.js — crea (o convierte) la cuenta de administración.
//
//   npm run admin:create -- correo@ejemplo.com "Nombre"
//
// La contraseña se pide por teclado (o se toma de la variable ADMIN_PASSWORD).
import readline from 'node:readline';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { hashPassword, PASSWORD_MIN } from '../src/lib/security.js';
import { normalizeEmail, isEmail } from '../src/lib/util.js';

const email = normalizeEmail(process.argv[2] || '');
const name = process.argv[3] || 'Administración';
if (!isEmail(email)) {
  console.error('Uso: npm run admin:create -- correo@ejemplo.com "Nombre"');
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // No mostrar lo que se escribe.
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const password = process.env.ADMIN_PASSWORD || await ask(`Contraseña para ${email} (mínimo ${PASSWORD_MIN} caracteres): `);
if (password.length < PASSWORD_MIN) {
  console.error(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
  process.exit(1);
}

const config = loadConfig();
const db = openDb(config.dbFile);
const hash = await hashPassword(password);
const now = Date.now();
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare(`UPDATE users SET role = 'admin', password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), deleted_at = NULL, updated_at = ? WHERE id = ?`)
    .run(hash, now, now, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`La cuenta ${email} ahora es de administración (contraseña actualizada).`);
} else {
  db.prepare(`INSERT INTO users (email, password_hash, name, country, role, email_verified_at, created_at, updated_at) VALUES (?,?,?,?, 'admin', ?,?,?)`)
    .run(email, hash, name, 'MX', now, now, now);
  console.log(`Cuenta de administración creada: ${email}`);
}
db.close();

// Contraseñas (scrypt), tokens de un solo uso y utilidades criptográficas.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// Parámetros recomendados por OWASP para scrypt (N=2^15, r=8, p=3) ≈ 32 MB por hash.
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 128 * 1024 * 1024 };
const KEYLEN = 32;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  let key;
  try {
    key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Hash "de relleno" para que el tiempo de respuesta no revele si un correo existe.
let dummyHash = null;
export async function burnPasswordTime(password) {
  dummyHash ??= await hashPassword('relleno-para-tiempo-constante');
  await verifyPassword(String(password ?? ''), dummyHash);
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Token aleatorio: al usuario se le entrega `token`; en la base solo se guarda `hash`.
export function newToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: sha256(token) };
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O/1/I
export function randomCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

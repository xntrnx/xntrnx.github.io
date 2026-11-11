/* vc.js — Credenciales Verificables del W3C en el navegador (sin dependencias).
   Implementa lo mismo que src/lib/cert.js: Data Integrity "eddsa-jcs-2022"
   (Ed25519 sobre JCS, RFC 8785), llaves Multikey y huellas digestSRI. */
(function () {
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const enc = new TextEncoder();

  function b58encode(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let out = '';
    while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
    for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
    return out;
  }
  function b58decode(str) {
    let n = 0n;
    for (const ch of str) {
      const i = B58.indexOf(ch);
      if (i < 0) throw new Error('base58 inválido');
      n = n * 58n + BigInt(i);
    }
    const bytes = [];
    while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
    for (const ch of str) { if (ch !== '1') break; bytes.unshift(0); }
    return new Uint8Array(bytes);
  }
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

  function multikeyFromRaw(raw) {
    const b = new Uint8Array(34); b[0] = 0xed; b[1] = 0x01; b.set(raw, 2);
    return 'z' + b58encode(b);
  }
  function rawFromMultikey(mk) {
    const b = b58decode(String(mk).slice(1));
    if (String(mk)[0] !== 'z' || b.length !== 34 || b[0] !== 0xed || b[1] !== 0x01) throw new Error('No es una llave Ed25519');
    return b.slice(2);
  }

  // JCS (RFC 8785).
  function jcs(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('número no válido'); return JSON.stringify(v); }
    if (Array.isArray(v)) return '[' + v.map((x) => jcs(x === undefined ? null : x)).join(',') + ']';
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';
  }
  const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));

  async function hashData(document, proofConfig) {
    const a = await sha256(jcs(proofConfig)), b = await sha256(jcs(document));
    const out = new Uint8Array(64); out.set(a, 0); out.set(b, 32);
    return out;
  }

  async function verifyProof(credential, rawPublicKey) {
    const document = Object.assign({}, credential);
    const proof = document.proof;
    delete document.proof;
    if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return false;
    if (proof['@context']) {
      const a = [].concat(proof['@context']), b = [].concat(document['@context'] || []);
      if (a.length > b.length || a.some((x, i) => jcs(x) !== jcs(b[i]))) return false;
    }
    const config = Object.assign({}, proof);
    delete config.proofValue;
    const key = await crypto.subtle.importKey('raw', rawPublicKey, { name: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify('Ed25519', key, b58decode(proof.proofValue.slice(1)), await hashData(document, config));
  }

  // Firma con una llave privada en PEM (PKCS#8). La llave no sale de esta página.
  async function importPrivateKeyPem(pem) {
    const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
    const key = await crypto.subtle.importKey('pkcs8', b64ToBytes(body), { name: 'Ed25519' }, true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', key);
    return { key, multikey: multikeyFromRaw(b64ToBytes(jwk.x)) };
  }
  async function sign(credential, key, verificationMethod) {
    const document = Object.assign({}, credential);
    delete document.proof;
    const proof = {
      type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022',
      created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      verificationMethod, proofPurpose: 'assertionMethod',
    };
    if (document['@context']) proof['@context'] = document['@context'];
    const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', key, await hashData(document, proof)));
    proof.proofValue = 'z' + b58encode(sig);
    document.proof = proof;
    return document;
  }

  const sri = async (buffer) => 'sha256-' + bytesToB64(await sha256(buffer));

  window.VC = { jcs, sha256, sri, b64ToBytes, multikeyFromRaw, rawFromMultikey, verifyProof, importPrivateKeyPem, sign };
})();

// Conformidad con el estándar: vector de prueba oficial del W3C para la suite
// "eddsa-jcs-2022" (Data Integrity EdDSA Cryptosuites v1.0, repositorio w3c/vc-di-eddsa,
// carpeta TestVectors). Si esta prueba pasa, las firmas del sitio son interoperables
// con cualquier verificador que implemente el estándar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jcs, signCredential, verifyProof, verifyCertificate, privateKeyFromMultibase, rawPublicKeyOf, multikeyFromRaw, rawFromMultikey, didWeb, base58Encode, base58Decode } from '../src/lib/cert.js';

const W3C = {
  publicKeyMultibase: 'z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2',
  privateKeyMultibase: 'z3u2en7t5LR2WtQH5PfFqMqwVHBeXouLzo6haApm8XHqvjxq',
  document: {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/examples/v2'],
    id: 'urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33',
    type: ['VerifiableCredential', 'AlumniCredential'],
    name: 'Alumni Credential',
    description: 'A minimum viable example of an Alumni Credential.',
    issuer: 'https://vc.example/issuers/5678',
    validFrom: '2023-01-01T00:00:00Z',
    credentialSubject: { id: 'did:example:abcdefgh', alumniOf: 'The School of Examples' },
  },
  created: '2023-02-24T23:36:38Z',
  verificationMethod: 'did:key:z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2#z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2',
  proofCanon: '{"@context":["https://www.w3.org/ns/credentials/v2","https://www.w3.org/ns/credentials/examples/v2"],"created":"2023-02-24T23:36:38Z","cryptosuite":"eddsa-jcs-2022","proofPurpose":"assertionMethod","type":"DataIntegrityProof","verificationMethod":"did:key:z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2#z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2"}',
  proofValue: 'z2HnFSSPPBzR36zdDgK8PbEHeXbR56YF24jwMpt3R1eHXQzJDMWS93FCzpvJpwTWd3GAVFuUfjoJdcnTMuVor51aX',
};

test('eddsa-jcs-2022: reproduce exactamente la firma del vector oficial del W3C', () => {
  const priv = privateKeyFromMultibase(W3C.privateKeyMultibase);
  assert.equal(multikeyFromRaw(rawPublicKeyOf(priv)), W3C.publicKeyMultibase);
  const signed = signCredential(W3C.document, priv, { verificationMethod: W3C.verificationMethod, created: W3C.created });
  const { proofValue, ...config } = signed.proof;
  assert.equal(jcs(config), W3C.proofCanon);
  assert.equal(proofValue, W3C.proofValue);
});

test('eddsa-jcs-2022: verifica el documento firmado oficial y rechaza cualquier alteración', () => {
  const raw = rawFromMultikey(W3C.publicKeyMultibase);
  const official = { ...W3C.document, proof: {
    type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created: W3C.created, verificationMethod: W3C.verificationMethod,
    proofPurpose: 'assertionMethod', '@context': W3C.document['@context'], proofValue: W3C.proofValue,
  } };
  assert.equal(verifyProof(official, raw), true);
  assert.equal(verifyProof({ ...official, name: 'Otro' }, raw), false);
  assert.equal(verifyProof({ ...official, proof: { ...official.proof, created: '2024-01-01T00:00:00Z' } }, raw), false);
  assert.equal(verifyProof({ ...official, '@context': ['https://www.w3.org/ns/credentials/v2'] }, raw), false, 'el contexto forma parte de lo firmado');
  assert.equal(verifyProof({ ...official, proof: { ...official.proof, cryptosuite: 'otra' } }, raw), false);
});

test('JCS (RFC 8785): orden de llaves, números y cadenas', () => {
  assert.equal(jcs({ b: 1, a: [true, null, 'x'], 'á': 1.5, A: 1e21, c: { z: 0, y: -0 } }), '{"A":1e+21,"a":[true,null,"x"],"b":1,"c":{"y":0,"z":0},"á":1.5}');
  assert.equal(jcs({ t: '€$\u000f\nA\'B"\\' }), '{"t":"€$\\u000f\\nA\'B\\"\\\\"}');
  assert.throws(() => jcs({ n: NaN }));
});

test('base58btc y did:web', () => {
  const bytes = Buffer.from([0, 0, 1, 2, 255, 254]);
  assert.ok(base58Decode(base58Encode(bytes)).equals(bytes));
  assert.equal(didWeb('https://galeria.example'), 'did:web:galeria.example');
  assert.equal(didWeb('http://localhost:3000'), 'did:web:localhost%3A3000');
});

test('el formato anterior del sitio se sigue pudiendo verificar', async () => {
  const crypto = await import('node:crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = der.subarray(der.length - 32).toString('base64');
  const ficha = { id: 'TLK-2026-014', titulo: 'Obra', anio: 2026, fotos: [] };
  const signature = crypto.sign(null, Buffer.from(jcs(ficha)), privateKey).toString('base64');
  const keys = [{ publicKeyBase64, created: '2026-01-01', revoked: false }];
  assert.deepEqual(verifyCertificate({ ...ficha, publicKeyBase64, signature }, keys), { ok: true, format: 'legacy' });
  assert.equal(verifyCertificate({ ...ficha, titulo: 'Otra', publicKeyBase64, signature }, keys).ok, false);
  assert.equal(verifyCertificate({ ...ficha, publicKeyBase64, signature }, []).ok, false);
});

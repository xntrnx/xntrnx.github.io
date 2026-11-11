# una pausa, Cecahuitl — digital gallery

Full-stack rebuild of the gallery: public catalogue of unique works, customer accounts,
direct purchases, live online auctions, and digitally signed certificates of authenticity
that anyone can verify in their browser.

The site's interface is in Spanish. Legal documents are published in Spanish and English.

## What is in here

| Area | What it does |
| --- | --- |
| Gallery | Landing page, gallery, artwork pages with photo viewer and zoom (same visual identity as the previous static site). |
| Accounts | Sign-up with e-mail verification, sign-in, password reset, profile, saved shipping address. |
| Orders | Buying reserves the unique work for 24 h; pay by PayPal (server-side, amount fixed by the server) or SPEI transfer (confirmed by hand); shipping and delivery tracking. |
| Auctions | Real-time ascending auctions: pseudonymous paddle numbers, optional secret reserve, anti-sniping extension, automatic order for the winner (72 h to pay). |
| Certificates | Each certificate is a **W3C Verifiable Credential 2.0** signed with Ed25519 (Data Integrity `eddsa-jcs-2022`), issued under the site's `did:web` identity. Signed on the artist's own computer (one click in the admin, key never uploaded), checked by the server before publishing, and re-verified in every visitor's browser, including a SHA-256 check of each photo. Printable one-page certificate with QR code. |
| Privacy | Privacy Notice (ES/EN), Terms with Auction Rules (ES/EN), cookies page, rights-request form, self-service data download / correction / consent withdrawal / account deletion, consent log, automatic retention clean-up. |
| Admin | Works, photos, certificates, auctions, orders, accounts, privacy requests, audit log, launch checklist. |

No third-party scripts, fonts, analytics or trackers. One strictly necessary cookie, set only at sign-in.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run seed                                  # optional: demo works with generated "paintings"
npm run admin:create -- you@example.com "Your name"
npm run dev                                   # http://localhost:3000
```

Without `SMTP_URL`, outgoing e-mails (including the account verification link) are written
to `data/outbox/` as text files.

```bash
npm test                                      # 52 automated tests
```

## Configure

Copy `.env.example` to `.env` and fill it in (`node --env-file=.env src/server.js`), or set the
same variables in your host's dashboard. The admin dashboard (`/admin`) lists whatever is still
missing before launch.

## Certificates of authenticity

```bash
npm run cert:keygen     # once: creates private-key.pem (never commit or share it) + certs/keys.json
```

Then, in `/admin` → a work → **Firmar y publicar aquí**, choose `private-key.pem` and press the
button. The key is read inside the browser only; the server receives just the signed credential.
(Command-line alternative: download the unsigned credential, `npm run cert:sign -- CODE.json`, upload it.)

Standards used, so a certificate can be checked by tools other than this site:

| Layer | Standard |
| --- | --- |
| Credential format | W3C Verifiable Credentials Data Model 2.0 |
| Signature | W3C Data Integrity, cryptosuite `eddsa-jcs-2022`: Ed25519 (RFC 8032) over JCS-canonical JSON (RFC 8785). `test/vc.test.js` reproduces the official W3C test vector byte for byte. |
| Issuer identity and keys | `did:web` (DID document at `/.well-known/did.json`), keys in Multikey format; revoked keys are marked there |
| Photo integrity | Subresource Integrity digests (`digestSRI`, SHA-256) in `relatedResource` |
| Artwork description | schema.org `VisualArtwork` plus the Object ID fields (the ICOM/Getty checklist for identifying art objects): type, materials, measurements, inscriptions, distinguishing features, title, date, maker, description, photographs |

Re-sign a work whenever its data, photos or owner change; the previous certificate is then
reported as superseded. Fichas signed by the previous site's format can still be verified at `/verificar`.

## Going to production

See [docs/DEPLOY.md](docs/DEPLOY.md) (step-by-step for a Mac mini) and, before accepting real customers,
[docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).

## Layout

```
src/server.js        entry point            src/services/   business rules (users, works, orders, auctions)
src/app.js           Express app + jobs     src/routes/     HTTP routes
src/config.js        environment config     src/views/      server-rendered pages (auto-escaped templates)
src/migrations/      database schema        src/views/legal*.js   legal documents
public/              CSS, browser JS, fonts tools/          CLI tools (admin, seed, backup, certificates)
test/                automated tests        certs/keys.json public signing-key history
```

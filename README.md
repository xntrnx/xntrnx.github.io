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
| Certificates | Ed25519-signed record per work, signed **offline**; verified on the server before publishing and again in the visitor's browser, including a SHA-256 check of every photo. Same format as the previous site. |
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
npm test                                      # 46 automated tests
```

## Configure

Copy `.env.example` to `.env` and fill it in (`node --env-file=.env src/server.js`), or set the
same variables in your host's dashboard. The admin dashboard (`/admin`) lists whatever is still
missing before launch.

## Certificates of authenticity

```bash
npm run cert:keygen                 # once: creates private-key.pem (never commit it) + certs/keys.json
# in /admin → a work → "Descarga la ficha sin firmar"
npm run cert:sign -- TLK-2026-014.json
# upload the signed file on the same admin page
```

If you already signed works on the previous site, copy its `keys.json` to `certs/keys.json`
and keep using the same `private-key.pem`; the old signed records remain valid.

## Going to production

See [docs/DEPLOY.md](docs/DEPLOY.md) and, before accepting real customers,
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

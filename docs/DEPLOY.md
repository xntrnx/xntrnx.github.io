# Deploying

## Important: this cannot run on GitHub Pages

GitHub Pages only serves static files. This project is a Node.js server with a database, so it
needs a host that runs a long-lived process and offers a **persistent disk**. This repository is
named `xntrnx.github.io`, so GitHub will try to publish whatever is on its default branch as a
static site; that will not produce a working gallery. Either deploy from this repository to one
of the hosts below and point your domain there, or move the code to a repository with a different name.

## What the host must provide

- Node.js 22+ (or Docker: a `Dockerfile` is included).
- A persistent volume mounted at `DATA_DIR` (database, uploaded photos, backups).
- HTTPS (all the hosts below provide it).
- **Exactly one instance.** The auction clock, live updates and rate limits live in the
  server's memory, and the database is a single SQLite file. Do not scale to several instances.

Fly.io, Railway, Render (with a paid disk) or any small VPS all fit. A work-a-day setup:

1. Create the app from this repository (Dockerfile build).
2. Attach a volume and mount it at `/data`.
3. Set the environment variables from `.env.example` (`BASE_URL` must be your final `https://` address).
4. Deploy, then open a shell on the host and run `npm run admin:create -- you@example.com "Your name"`.
5. Sign in at `/cuenta/entrar`; `/admin` shows the remaining launch checklist.

The health check endpoint is `/healthz`.

## Backups

`npm run backup` writes a consistent copy of the database to `DATA_DIR/backups/` (keeps the
last 14). Schedule it daily and copy that file **and** `DATA_DIR/uploads/` off the server.
Backups contain personal data: store them encrypted and delete them when no longer needed.
Photos must be restored byte-for-byte, or certificate photo checks will fail.

## E-mail

Set `SMTP_URL` to a transactional e-mail provider (Postmark, Amazon SES, Resend, Mailgun…).
Set up SPF/DKIM for your domain or verification e-mails will land in spam. Name the provider
and its country in `EMAIL_PROVIDER`; the Privacy Notice prints it.

## PayPal

Create a REST app at developer.paypal.com, start with `PAYPAL_ENV=sandbox`, run a full purchase
with a sandbox buyer, then switch to `live` credentials. The server creates the PayPal order
with the amount from the database, sends the buyer to PayPal, and on return captures the payment
and checks amount, currency and order reference before marking the order paid.

## Updating

Deploy the new code; database migrations in `src/migrations/` apply automatically at start.
If you change a legal document, bump its version in `src/legal/versions.js`.

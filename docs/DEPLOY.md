# Putting the gallery online from a Mac mini

This guide assumes you have never run a server. Follow it top to bottom; every step says
what to type and what you should see. It takes about an hour, plus waiting time for the domain.

> **Honest note.** The installer script in step 8 was written carefully but could not be
> run on a real Mac while this guide was written (the project was built on Linux). If a step
> does not behave as described, stop and ask before improvising. Everything else in the
> project is covered by automated tests.

## How it will work

```
visitor's browser ──https──▶ Cloudflare ──secure tunnel──▶ your Mac mini ──▶ the gallery
```

- The gallery runs on the Mac mini, at home or in the studio.
- **Cloudflare Tunnel** (free) connects it to the internet. You do **not** open ports on your
  router, you do not need a fixed IP address, and Cloudflare provides the padlock (HTTPS).
- If the Mac is off or offline, the site is offline. That is the trade-off of hosting at home.

## What you need before starting

| | |
| --- | --- |
| A Mac mini | Any model from 2018 on, with macOS 13 or newer, plugged in and on the internet (cable is better than Wi-Fi). |
| A domain name | For example `tunombre.art`. Buy it from any registrar, or directly inside Cloudflare (step 9). About 10–20 USD a year. |
| A free Cloudflare account | https://dash.cloudflare.com/sign-up |
| An e-mail sending service | The site must send e-mails (account confirmation, order notices). Create an account with a "transactional e-mail" provider such as Postmark, Resend or Amazon SES and get its **SMTP address, user and password**. A home internet connection cannot send e-mail reliably by itself. |
| The administrator password of the Mac | You will be asked for it a few times. |

---

## Step 1 — Prepare the Mac so it never sleeps

Open **System Settings** () and set:

1. **Energy** (on some versions: *Energy Saver*):
   - "Prevent automatic sleeping when the display is off": **on**
   - "Start up automatically after a power failure": **on**
   - "Wake for network access": **on**
2. **General → Software Update → Automatic Updates**: turn on *Install Security Responses and system files*.
   Install full macOS updates yourself, at a quiet hour (the site is offline while the Mac restarts).
3. **Network → Firewall**: **on**.
4. **Privacy & Security → FileVault**: leave it **on** if it already is (it protects your
   customers' data if the Mac is stolen). Be aware of the consequence: after a power cut the
   Mac waits at the login screen until someone types the password, and the site stays offline
   until then. If the Mac must come back alone, turn FileVault off and keep the Mac in a locked place.

Ideally use this Mac only for the gallery, or at least under its own user account.

## Step 2 — Open Terminal

Press **⌘ + Space**, type `Terminal`, press **Return**. A window with text appears. In the
following steps, "run" means: copy the grey line, paste it in Terminal, press **Return**.

When Terminal asks for `Password:`, type the Mac's password and press Return. **Nothing shows
while you type**; that is normal.

## Step 3 — Install the tools (Homebrew, Node.js, Git)

Run this (it installs Homebrew, the standard installer for developer tools on Mac):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It takes a few minutes. When it finishes it prints a section called **"Next steps"** with two
or three lines starting with `echo` and `eval`. **Copy those lines from your own Terminal and run them.**

Then run:

```bash
brew install node@22 git
echo 'export PATH="'"$(brew --prefix node@22)"'/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
node --version
```

The last line must print something starting with `v22`. If it does, the tools are ready.

## Step 4 — Download the gallery

```bash
cd ~
git clone https://github.com/xntrnx/xntrnx.github.io.git galeria
cd galeria
npm ci
```

`npm ci` downloads the project's building blocks; it ends with a line like `added 90 packages`.

> From now on, **every command is run inside the `galeria` folder**. If you close Terminal,
> open it again and run `cd ~/galeria` first.
>
> If the code lives on a branch that has not been merged yet, add
> `-b claude/digital-gallery-rebuild-lgtfyx` after `git clone`.

## Step 5 — Write the configuration

Create your settings file from the template and open it in TextEdit:

```bash
cp .env.example .env
mkdir -p ~/galeria-data
open -e .env
```

Change these lines (leave the rest as it is for now). Replace the examples with your real data:

```ini
BASE_URL=https://tunombre.art
DATA_DIR=/Users/YOUR-MAC-USER/galeria-data
TRUST_PROXY=1

CONTACT_EMAIL=hola@tunombre.art
LEGAL_NAME=Your full legal name
LEGAL_ADDRESS=Street and number, postcode, city, state, México
PRIVACY_EMAIL=privacidad@tunombre.art
HOSTING_LOCATION=México (servidor propio del artista), con Cloudflare, Inc. (EE. UU.) como red de entrega y protección
EMAIL_PROVIDER=Postmark (EE. UU.)

SMTP_URL=smtps://USER:PASSWORD@smtp.your-provider.com:465
MAIL_FROM="una pausa, Cecahuitl <hola@tunombre.art>"
ADMIN_NOTIFY_EMAIL=hola@tunombre.art

SPEI_CLABE=your 18-digit CLABE
SPEI_BANCO=Your bank
SPEI_BENEFICIARIO=Account holder name
```

- To see your Mac user name for `DATA_DIR`, run `whoami` in Terminal.
- `HOSTING_LOCATION` and `EMAIL_PROVIDER` are printed in the Privacy Notice, because visitors
  have the right to know who handles their data. Cloudflare must be named: all traffic passes through it.
- PayPal can wait: leave `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` empty and buyers will pay by SPEI.
- Save with **⌘ + S** and close TextEdit. This file contains passwords: never share it or upload it.

## Step 6 — Create your administrator account

```bash
node --env-file=.env tools/create-admin.js you@example.com "Your name"
```

It asks for a password (at least 10 characters; nothing shows while you type). Use a long one
that you do not use anywhere else. It should answer `Cuenta de administración creada`.

## Step 7 — Try it on the Mac

```bash
node --env-file=.env src/server.js
```

You should see `Galería en https://tunombre.art (puerto 3000, producción)`, possibly followed by
a list of pending settings. Open Safari at **http://localhost:3000**: the gallery appears.
(Signing in may not work yet at this address, depending on the browser: in production the
sign-in cookie is only sent over the secure `https` address, which you set up in step 9.)

Go back to Terminal and press **Control + C** to stop it.

## Step 8 — Make it start by itself

```bash
npm run mac:install
```

It asks for the Mac password and should answer:

```
Listo: la galería está corriendo en http://localhost:3000 y arrancará sola al encender la Mac.
Respaldo automático: todos los días a las 4:00.
```

From now on the gallery starts when the Mac turns on, restarts by itself if it ever crashes,
and makes a backup every night. Useful commands (always inside `~/galeria`):

| Command | What it does |
| --- | --- |
| `npm run mac:status` | Says whether the gallery is running. |
| `npm run mac:logs` | Shows the latest lines of the activity log (look here if something fails). |
| `npm run mac:restart` | Restarts it. **Do this every time you change `.env`.** |
| `npm run mac:stop` | Stops it until the next restart or `mac:install`. |
| `npm run mac:uninstall` | Removes the automatic start (your data is not touched). |

## Step 9 — Connect it to the internet with Cloudflare Tunnel

1. **Add your domain to Cloudflare.** In the Cloudflare dashboard choose *Add a domain*, type
   your domain and pick the **Free** plan. Cloudflare shows two "nameservers". Sign in where you
   bought the domain, find "Nameservers" or "DNS", and replace the existing ones with
   Cloudflare's two. This can take from minutes to a day; Cloudflare e-mails you when the domain
   is "active". (If you buy the domain inside Cloudflare, this is already done.)
2. **Create the tunnel.** In the dashboard open **Zero Trust → Networks → Tunnels** and choose
   *Create a tunnel* → type **Cloudflared** → name it `galeria` → *Save*.
   (Cloudflare renames menus now and then; look for "Tunnels".)
3. **Install the connector on the Mac.** Cloudflare shows a box with commands; choose
   **macOS**. First run:
   ```bash
   brew install cloudflared
   ```
   Then copy from the Cloudflare page the line that starts with
   `sudo cloudflared service install` followed by a long code, and run it. The page should
   show the connector as **Connected** within a minute.
4. **Point your domain at the gallery.** On the next screen (*Public Hostname*):
   - Subdomain: leave empty (or `www`) · Domain: choose yours
   - Type: **HTTP** · URL: `localhost:3000`
   - Save.
5. In the Cloudflare dashboard for your domain, **SSL/TLS → Edge Certificates**, turn on
   **Always Use HTTPS**.

Open `https://tunombre.art` on your phone using mobile data (not the home Wi-Fi). The gallery
should load with a padlock. The tunnel also starts by itself when the Mac turns on.

## Step 10 — First sign-in and launch checklist

1. Go to `https://tunombre.art/cuenta/entrar` and sign in with the account from step 6.
2. Open `https://tunombre.art/admin`. The top of the page lists anything still missing
   ("Pendientes antes de lanzar"). Fix each item in `.env`, then `npm run mac:restart`.
3. Create a test customer account with another e-mail address and check that the confirmation
   e-mail arrives.
4. Read [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) before accepting real customers.

## Step 11 — Your certificate signing key

Certificates of authenticity are signed with a private key that only you hold.

```bash
npm run cert:keygen
```

This creates `private-key.pem` in the `galeria` folder and registers its public half with the
site. **Copy `private-key.pem` to a USB stick and keep it somewhere safe; whoever has this file
can sign certificates in your name.** If you already have a key from the previous site, copy
your old `keys.json` to `certs/keys.json` and keep using your old `private-key.pem` instead.

To certify a work: `/admin` → *Obras* → the work → **Firmar y publicar aquí** → choose your
`private-key.pem` → *Firmar y publicar certificado*. The key is used inside your browser only
and is never uploaded.

## Backups (do not skip)

Every night at 4:00 a copy of the database is saved in `~/galeria-data/backups/` (the last 14
are kept). That copy lives on the same Mac, so it does not protect you if the disk dies or the
Mac is stolen:

- Plug in an external disk and turn on **Time Machine** (System Settings → General → Time
  Machine) with **"Encrypt backups"** checked. It will include `~/galeria-data` (database and
  photos) and `~/galeria` (settings and signing key).
- The backups contain your customers' personal data: only use encrypted disks, and do not copy
  them to shared or public cloud folders.

To restore on a new Mac: repeat steps 1–4, copy back `~/galeria-data`, `.env`, `certs/keys.json`
and `private-key.pem`, then continue from step 8.

## Updating the site later

```bash
cd ~/galeria
git pull
npm ci
npm run mac:restart
```

## If something goes wrong

| Symptom | What to check |
| --- | --- |
| The site does not open from outside | `npm run mac:status`. If it is running, open the Cloudflare dashboard → Tunnels: is the connector **Connected**? Is the Mac online and awake? |
| "La galería NO está corriendo" | `npm run mac:logs` and read the last lines. The most common cause is a typo in `.env`. Fix it and run `npm run mac:install` again. |
| Confirmation e-mails do not arrive | Check `SMTP_URL` in `.env`, your e-mail provider's activity page, and the spam folder. Your provider will ask you to add "SPF/DKIM" records to your domain: do it in Cloudflare → DNS. |
| Cannot sign in ("Solicitud bloqueada") | `BASE_URL` in `.env` must be exactly the address in the browser bar, starting with `https://`. Then `npm run mac:restart`. |
| After a power cut the site is down | With FileVault on, someone has to type the Mac password once (see step 1). |
| You forgot the admin password | Run step 6 again with the same e-mail address: it sets a new password. |

## Alternative: renting a server instead of using the Mac

The same project runs on any host that offers Node.js 22 (or Docker, a `Dockerfile` is
included), a **persistent disk** mounted at `DATA_DIR`, HTTPS, and **exactly one instance**
(auction timing, live updates and the SQLite database live in one process). Fly.io, Railway or
Render with a paid disk all work: set the same variables as in step 5, deploy, and run step 6
in the host's shell. It **cannot** run on GitHub Pages, which only serves static files; note
that this repository's name (`xntrnx.github.io`) makes GitHub try to publish its default branch
as a static site, which will not produce a working gallery.

## PayPal (when you are ready)

Create a REST app at developer.paypal.com, put its Client ID and Secret in `.env` with
`PAYPAL_ENV=sandbox`, restart, and make a complete test purchase with a sandbox buyer. Then
switch to the live credentials and `PAYPAL_ENV=live`. The server fixes the amount from its own
database, sends the buyer to PayPal, and on return captures the payment and checks amount,
currency and order reference before marking the order paid.

# Launch checklist

The software enforces the technical side of privacy and consumer rules. The items below are
decisions and facts only you (and a lawyer) can supply. **The legal texts were drafted
carefully but have not been reviewed by a lawyer; have one admitted in Mexico review them
before you accept real customers.**

## Must do before launch

- [ ] **Controller identity.** Set `LEGAL_NAME`, `LEGAL_ADDRESS`, `PRIVACY_EMAIL`,
      `HOSTING_LOCATION`, `EMAIL_PROVIDER`, `CONTACT_EMAIL`. Until then the Privacy Notice and
      Terms show red `[PENDIENTE: …]` markers, and a notice without the controller's identity
      and address does not satisfy Mexican law (LFPDPPP) or the GDPR.
- [ ] **Read both legal documents end to end** (`/legal/privacidad`, `/legal/terminos`) and
      confirm every statement is true for how you actually operate: shipping times, the
      10-working-day dispatch promise, insurance, the 10-working-day complaint reply, no buyer's premium.
- [ ] **Returns policy.** The Terms grant the legal minimums: 5 working days in Mexico
      (LFPC art. 56) and 14 days for EU/EEA/UK consumers, including works won at auction.
      Decide whether you prefer one simpler, more generous policy for everyone.
- [ ] **Sign data-processing agreements** with your hosting and e-mail providers (most offer a
      standard DPA with EU standard contractual clauses). The Privacy Notice says you have them.
- [ ] **Payments.** Test PayPal in sandbox, then go live. The PayPal integration is covered by
      automated tests against a simulated PayPal, but has **not** been run against PayPal's real servers.
- [ ] **E-mail deliverability** (SPF/DKIM), and send yourself every transactional e-mail once.
- [ ] **Signing keys.** `certs/keys.json` is empty. Generate a key or copy your existing
      `keys.json`. Keep `private-key.pem` offline and backed up.
- [ ] **Backups** scheduled and a restore tried once.
- [ ] Delete the demo works if you ran `npm run seed`.

## Legal points to raise with your lawyer / accountant

- **Mexican data authority.** The notice names the Secretaría Anticorrupción y Buen Gobierno,
  which took over from the INAI under the LFPDPPP published in March 2025. Confirm the current
  name, the response deadlines (20 + 15 working days) and whether any secondary regulation changed.
- **Anti-money-laundering (LFPIORPI).** Selling works of art is a "vulnerable activity":
  above the legal thresholds (expressed in UMA) you must identify the buyer, keep a file and,
  above a higher threshold, report to the SAT. The site does not collect ID documents; the
  documents warn buyers it may be required. Agree on a manual procedure for high-value sales.
- **Taxes and invoicing.** The Terms say prices include applicable Mexican taxes. Confirm with
  your accountant. The site does not issue CFDI invoices or collect RFC/tax data.
- **EU representative (GDPR art. 27).** The notice relies on the exemption for occasional
  processing. If sales to the EU/UK become regular, appoint representatives and set
  `EU_REPRESENTATIVE` / `UK_REPRESENTATIVE`.
- **EU/UK VAT and customs** on shipments abroad (the Terms put import duties on the buyer).
- **Auction rules**, in particular the consequences of non-payment and the reserve mechanism,
  and whether any local rule on public auctions applies to you.
- **Newsletter.** The site records opt-in consent but does not send newsletters. Whatever tool
  you use must mail only people with "Avisos: Sí" in `/admin/usuarios`, include an unsubscribe
  link, and be added to the list of recipients in the Privacy Notice.

## Handling privacy requests

Requests arrive in `/admin/privacidad` and by e-mail. Verify identity, answer within the
deadline shown there, and record what you did. Most requests can be satisfied by pointing the
person to `/cuenta/privacidad`, where they can download, correct and delete their data themselves.
If you suffer a data breach, the notice commits you to telling affected people without delay
(and, under the GDPR, the authority within 72 hours).

## Known limits of this version

- Single server instance only (see DEPLOY.md).
- No two-factor authentication for the admin account: use a long unique password. Admin
  sessions expire after 12 hours of inactivity.
- Photos are served exactly as uploaded (required for the certificate hash), so upload
  web-sized files (about 2000 px on the long side), not camera originals.
- Interface in Spanish only; legal documents in Spanish and English.
- Refunds are made by you in PayPal or your bank; the admin panel only records them.

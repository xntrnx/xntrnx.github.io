// Correo saliente. Con SMTP_URL usa SMTP; sin él, guarda los mensajes en DATA_DIR/outbox
// (solo para desarrollo). Los envíos nunca bloquean la respuesta al navegador.
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

export function createMailer(config, log = console) {
  let transport = config.mail.transport;
  if (!transport && config.mail.smtpUrl) transport = nodemailer.createTransport(config.mail.smtpUrl);
  const pending = new Set();
  let seq = 0;

  async function deliver(msg) {
    if (transport) {
      await transport.sendMail(msg);
      return;
    }
    fs.mkdirSync(config.outboxDir, { recursive: true });
    const file = path.join(config.outboxDir, `${Date.now()}-${String(++seq).padStart(4, '0')}.txt`);
    fs.writeFileSync(file, `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`, { mode: 0o600 });
    if (!config.quiet) log.info(`[correo] (sin SMTP) guardado en ${file}`);
  }

  function send({ to, subject, text }) {
    if (!to) return;
    const msg = {
      from: config.mail.from,
      to,
      subject: String(subject).replace(/[\r\n]+/g, ' '),
      text: `${text}\n\n—\n${config.site.name}\n${config.baseUrl}\n`,
    };
    const p = deliver(msg)
      .catch((err) => log.error(`[correo] no se pudo enviar "${msg.subject}": ${err.message}`))
      .finally(() => pending.delete(p));
    pending.add(p);
  }

  return {
    send,
    sendAdmin(msg) { send({ ...msg, to: config.mail.adminNotify }); },
    // Espera a que terminen los envíos en curso (pruebas y apagado limpio).
    async idle() { while (pending.size) await Promise.all([...pending]); },
  };
}

// Configuración: todo sale de variables de entorno (ver .env.example).
import path from 'node:path';

function int(v, def) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
}
function str(v, def = '') {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : def;
}
function pesosToCents(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function loadConfig(env = process.env, overrides = {}) {
  const production = env.NODE_ENV === 'production';
  const port = int(env.PORT, 3000);
  const baseUrl = str(env.BASE_URL, `http://localhost:${port}`).replace(/\/+$/, '');
  const dataDir = path.resolve(str(env.DATA_DIR, './data'));

  const config = {
    production,
    port,
    baseUrl,
    dataDir,
    dbFile: path.join(dataDir, 'galeria.db'),
    uploadsDir: path.join(dataDir, 'uploads'),
    outboxDir: path.join(dataDir, 'outbox'),
    trustProxy: int(env.TRUST_PROXY, production ? 1 : 0),
    keysFile: str(env.KEYS_FILE), // historial de llaves de firma (por defecto certs/keys.json)

    site: {
      name: str(env.SITE_NAME, 'una pausa, Cecahuitl'),
      artist: str(env.ARTIST_NAME, 'Cecahuitl'),
      contactEmail: str(env.CONTACT_EMAIL),
      contactWhatsapp: str(env.CONTACT_WHATSAPP).replace(/\D/g, ''),
    },

    legal: {
      controllerName: str(env.LEGAL_NAME),
      controllerAddress: str(env.LEGAL_ADDRESS),
      privacyEmail: str(env.PRIVACY_EMAIL),
      euRepresentative: str(env.EU_REPRESENTATIVE),
      ukRepresentative: str(env.UK_REPRESENTATIVE),
      hostingLocation: str(env.HOSTING_LOCATION),
      emailProvider: str(env.EMAIL_PROVIDER),
    },

    mail: {
      smtpUrl: str(env.SMTP_URL),
      from: str(env.MAIL_FROM, `${str(env.SITE_NAME, 'Galería')} <no-reply@localhost>`),
      adminNotify: str(env.ADMIN_NOTIFY_EMAIL, str(env.CONTACT_EMAIL)),
      transport: null, // inyectable en pruebas
    },

    paypal: {
      env: str(env.PAYPAL_ENV, 'sandbox') === 'live' ? 'live' : 'sandbox',
      clientId: str(env.PAYPAL_CLIENT_ID),
      secret: str(env.PAYPAL_SECRET),
      fetch: null, // inyectable en pruebas
    },

    spei: {
      clabe: str(env.SPEI_CLABE).replace(/\s/g, ''),
      banco: str(env.SPEI_BANCO),
      beneficiario: str(env.SPEI_BENEFICIARIO),
    },

    shipping: {
      mxCents: pesosToCents(env.SHIPPING_MX_MXN),
      intlCents: pesosToCents(env.SHIPPING_INTL_MXN),
    },

    currency: 'MXN',
    orderHoldMs: int(env.ORDER_HOLD_HOURS, 24) * 3600_000,
    auctionPayMs: int(env.AUCTION_PAY_HOURS, 72) * 3600_000,

    // Plazos de conservación (deben coincidir con el Aviso de Privacidad).
    retention: {
      sessionMs: 30 * 24 * 3600_000, // sesiones: 30 días sin actividad
      adminSessionMs: 12 * 3600_000, // sesiones de administración: 12 horas
      securityLogMs: 365 * 24 * 3600_000, // IP y dispositivo en registros: 12 meses
      orderPiiMs: 6 * 365 * 24 * 3600_000, // datos de envío en pedidos cerrados: 6 años
    },

    quiet: false,
    ...overrides,
  };

  config.paypal.enabled = Boolean(config.paypal.clientId && config.paypal.secret);
  config.spei.enabled = Boolean(config.spei.clabe && config.spei.beneficiario);
  return config;
}

// Pendientes que impiden considerar el sitio listo para producción.
// Se muestran en el panel de administración y en el arranque.
export function launchIssues(config) {
  const issues = [];
  const l = config.legal;
  if (!l.controllerName) issues.push('LEGAL_NAME: falta el nombre legal del responsable de los datos (Aviso de Privacidad).');
  if (!l.controllerAddress) issues.push('LEGAL_ADDRESS: falta el domicilio del responsable (Aviso de Privacidad).');
  if (!l.privacyEmail) issues.push('PRIVACY_EMAIL: falta el correo para solicitudes de privacidad.');
  if (!l.hostingLocation) issues.push('HOSTING_LOCATION: indica dónde están los servidores (transferencias internacionales).');
  if (!config.site.contactEmail) issues.push('CONTACT_EMAIL: falta el correo de contacto.');
  if (!config.mail.smtpUrl) issues.push('SMTP_URL: sin correo saliente no llegan las verificaciones de cuenta ni los avisos de pedidos.');
  if (!config.paypal.enabled && !config.spei.enabled) issues.push('Pagos: configura PayPal (PAYPAL_CLIENT_ID/PAYPAL_SECRET) y/o SPEI (SPEI_CLABE/SPEI_BENEFICIARIO).');
  if (config.paypal.enabled && config.paypal.env !== 'live') issues.push('PAYPAL_ENV está en "sandbox": los cobros no son reales.');
  if (!/^https:\/\//.test(config.baseUrl)) issues.push('BASE_URL debe empezar con https:// en producción.');
  return issues;
}

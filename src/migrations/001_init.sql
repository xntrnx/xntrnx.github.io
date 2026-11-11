-- Esquema inicial. Fechas: enteros en milisegundos (UTC). Dinero: enteros en centavos.

CREATE TABLE users (
  id                INTEGER PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT,
  name              TEXT,
  phone             TEXT,
  country           TEXT,
  role              TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  email_verified_at INTEGER,
  marketing_opt_in  INTEGER NOT NULL DEFAULT 0,
  failed_logins     INTEGER NOT NULL DEFAULT 0,
  locked_until      INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);

CREATE TABLE sessions (
  id_hash      TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('verify_email','reset_password')),
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX tokens_user ON tokens(user_id, kind);

-- Constancia de cada consentimiento otorgado o retirado (qué versión, cuándo, desde dónde).
CREATE TABLE consents (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL CHECK (kind IN ('privacy','terms','auction_rules','marketing','owner_name_public')),
  version    TEXT NOT NULL,
  granted    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX consents_user ON consents(user_id);

-- Una dirección de envío guardada por persona (minimización de datos).
CREATE TABLE addresses (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recipient   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country     TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE works (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  technique        TEXT,
  year             INTEGER,
  dimensions       TEXT,
  description      TEXT,
  price_cents      INTEGER,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','available','reserved','sold','nfs')),
  position         INTEGER NOT NULL DEFAULT 0,
  certificate_json TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE work_photos (
  id       INTEGER PRIMARY KEY,
  work_id  INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  file     TEXT NOT NULL UNIQUE,
  sha256   TEXT NOT NULL,
  width    INTEGER NOT NULL,
  height   INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX work_photos_work ON work_photos(work_id, position);

CREATE TABLE auctions (
  id               INTEGER PRIMARY KEY,
  work_id          INTEGER NOT NULL REFERENCES works(id),
  starts_at        INTEGER NOT NULL,
  ends_at          INTEGER NOT NULL,
  original_ends_at INTEGER NOT NULL,
  start_cents      INTEGER NOT NULL CHECK (start_cents > 0),
  reserve_cents    INTEGER,
  increment_cents  INTEGER NOT NULL CHECK (increment_cents > 0),
  extend_seconds   INTEGER NOT NULL DEFAULT 300,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','live','sold','unsold','cancelled')),
  winner_bid_id    INTEGER,
  created_at       INTEGER NOT NULL
);
-- Una sola subasta activa por obra.
CREATE UNIQUE INDEX auctions_one_active ON auctions(work_id) WHERE status IN ('scheduled','live');

-- Registro a una subasta: aceptación de las reglas + número de paleta (seudónimo público).
CREATE TABLE auction_registrations (
  auction_id INTEGER NOT NULL REFERENCES auctions(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  paddle     INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (auction_id, user_id),
  UNIQUE (auction_id, paddle)
);

CREATE TABLE bids (
  id           INTEGER PRIMARY KEY,
  auction_id   INTEGER NOT NULL REFERENCES auctions(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  ip           TEXT
);
CREATE INDEX bids_auction ON bids(auction_id, amount_cents DESC);
CREATE INDEX bids_user ON bids(user_id);

CREATE TABLE orders (
  id                 INTEGER PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  work_id            INTEGER NOT NULL REFERENCES works(id),
  source             TEXT NOT NULL CHECK (source IN ('purchase','auction')),
  auction_id         INTEGER REFERENCES auctions(id),
  subtotal_cents     INTEGER NOT NULL,
  shipping_cents     INTEGER NOT NULL DEFAULT 0,
  total_cents        INTEGER NOT NULL,
  currency           TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN (
                       'pending_payment','payment_review','paid','shipped','delivered',
                       'cancelled','expired','refund_due','refunded')),
  payment_method     TEXT,
  payment_ref        TEXT,
  paypal_order_id    TEXT,
  paypal_capture_id  TEXT,
  ship_recipient     TEXT,
  ship_phone         TEXT,
  ship_line1         TEXT,
  ship_line2         TEXT,
  ship_city          TEXT,
  ship_state         TEXT,
  ship_postal_code   TEXT,
  ship_country       TEXT,
  owner_name_public  INTEGER NOT NULL DEFAULT 0,
  tracking           TEXT,
  admin_notes        TEXT,
  expires_at         INTEGER,
  paid_at            INTEGER,
  shipped_at         INTEGER,
  delivered_at       INTEGER,
  pii_scrubbed_at    INTEGER,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX orders_user ON orders(user_id);
-- Cada obra es única: a lo más un pedido vigente por obra. Es la garantía de fondo
-- contra la doble venta, incluso si dos personas compran en el mismo instante.
CREATE UNIQUE INDEX orders_one_active ON orders(work_id)
  WHERE status IN ('pending_payment','payment_review','paid','shipped','delivered');

-- Solicitudes de derechos de privacidad (ARCO / RGPD) recibidas por el formulario.
CREATE TABLE privacy_requests (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_notes TEXT,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY,
  at        INTEGER NOT NULL,
  user_id   INTEGER,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  ip        TEXT,
  meta      TEXT
);
CREATE INDEX audit_at ON audit_log(at);

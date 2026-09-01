-- aPaulogy D1 schema
-- Apply:  npm run db:remote   (or db:local for dev)
-- Safe to re-run: uses IF NOT EXISTS.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  parent_slug TEXT,
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  sku           TEXT,
  name          TEXT NOT NULL,
  subtitle      TEXT,
  description   TEXT,               -- HTML (sanitised) long description
  short_desc    TEXT,               -- plain summary for cards / meta
  price         INTEGER NOT NULL,   -- in paise (INR * 100)
  sale_price    INTEGER,            -- in paise, nullable
  currency      TEXT NOT NULL DEFAULT 'INR',
  category_slug TEXT,
  collection    TEXT,               -- e.g. "Bangalore in the 70s"
  status        TEXT NOT NULL DEFAULT 'publish', -- publish | draft
  featured      INTEGER NOT NULL DEFAULT 0,
  stock         INTEGER,            -- null = not tracked / made to order
  weight_grams  INTEGER,
  primary_image TEXT,               -- R2 key / URL path
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,        -- R2 key / URL path
  alt        TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);

-- Product variants (e.g. framed / unframed, size). Optional.
CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,        -- e.g. "A3 / Framed"
  sku        TEXT,
  price      INTEGER NOT NULL,     -- paise
  stock      INTEGER,
  attributes TEXT                  -- JSON: {"size":"A3","frame":"Teak"}
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- ---------------------------------------------------------------------------
-- Customers & orders (new + imported historical)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY,
  email      TEXT UNIQUE,
  name       TEXT,
  phone      TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                   INTEGER PRIMARY KEY,
  order_number         TEXT UNIQUE,           -- human ref (e.g. APG-1042 or legacy #)
  legacy_id            TEXT,                  -- WooCommerce order id, for import idempotency
  customer_id          INTEGER REFERENCES customers(id),
  email                TEXT,
  phone                TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
    -- pending | paid | processing | completed | cancelled | refunded | failed
  currency             TEXT NOT NULL DEFAULT 'INR',
  subtotal             INTEGER NOT NULL DEFAULT 0,  -- paise
  shipping             INTEGER NOT NULL DEFAULT 0,
  tax                  INTEGER NOT NULL DEFAULT 0,
  discount             INTEGER NOT NULL DEFAULT 0,
  total                INTEGER NOT NULL DEFAULT 0,
  billing_json         TEXT,                  -- JSON address
  shipping_json        TEXT,                  -- JSON address
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  notes                TEXT,
  source               TEXT DEFAULT 'web',    -- web | import
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_legacy ON orders(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_rzp ON orders(razorpay_order_id);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  product_slug TEXT,
  name         TEXT NOT NULL,
  variant      TEXT,
  quantity     INTEGER NOT NULL DEFAULT 1,
  unit_price   INTEGER NOT NULL,   -- paise
  total        INTEGER NOT NULL    -- paise
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

-- Idempotency / webhook log so Razorpay retries don't double-process.
CREATE TABLE IF NOT EXISTS payment_events (
  id          INTEGER PRIMARY KEY,
  event_id    TEXT UNIQUE,
  event_type  TEXT,
  payload     TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);

-- Newsletter / contact captures
CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY,
  name       TEXT,
  email      TEXT,
  message    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Data deletion / access requests (from /data-deletion and admin)
CREATE TABLE IF NOT EXISTS data_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  name TEXT, email TEXT, phone TEXT,
  scope TEXT, details TEXT,
  created TEXT DEFAULT (datetime('now'))
);

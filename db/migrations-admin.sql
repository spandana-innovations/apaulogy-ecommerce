-- aPaulogy admin schema (idempotent). Run after db/schema.sql.

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE,
  email TEXT, phone TEXT,
  status TEXT DEFAULT 'pending',        -- pending|paid|shipped|fulfilled|cancelled
  currency TEXT DEFAULT 'INR',
  subtotal INTEGER, shipping INTEGER, discount INTEGER DEFAULT 0, total INTEGER,
  coupon TEXT,
  billing_json TEXT, shipping_json TEXT,
  razorpay_order_id TEXT, razorpay_payment_id TEXT,
  tracking_number TEXT, tracking_carrier TEXT,
  notes TEXT, source TEXT DEFAULT 'web',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT, slug TEXT, name TEXT, variant TEXT,
  price INTEGER, quantity INTEGER
);
CREATE TABLE IF NOT EXISTS customers (
  email TEXT PRIMARY KEY, name TEXT, phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, subject TEXT, body TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS data_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE, name TEXT, email TEXT, phone TEXT,
  scope TEXT, details TEXT, created TEXT DEFAULT (datetime('now'))
);

-- Admin-managed content
CREATE TABLE IF NOT EXISTS product_overrides (
  slug TEXT PRIMARY KEY,
  title TEXT, short_html TEXT, description_html TEXT,
  price INTEGER, sale_price INTEGER, price_max INTEGER,
  meta_title TEXT, meta_description TEXT,
  images_json TEXT,        -- JSON array of image URLs (first = primary)
  variations_json TEXT,    -- JSON array of {slug,label,price}
  featured INTEGER,        -- 0/1 or NULL to inherit
  active INTEGER DEFAULT 1,
  weight REAL,             -- kg (simple products)
  ship_flat INTEGER,       -- flat shipping fee in paise (overrides weight calc)
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS category_overrides (
  slug TEXT PRIMARY KEY,
  name TEXT, description TEXT, meta_title TEXT, meta_description TEXT,
  hidden INTEGER DEFAULT 0, sort INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT,
  scope TEXT,              -- product|category|all
  target TEXT,             -- slug for product/category; '' for all
  kind TEXT,               -- percent|fixed|free_shipping
  value INTEGER,           -- percent (0-100) or rupees (fixed)
  active INTEGER DEFAULT 1,
  starts TEXT, ends TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  kind TEXT,               -- percent|fixed|free_shipping
  value INTEGER,
  min_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0, max_uses INTEGER DEFAULT 0,
  ends TEXT,
  product_slug TEXT,       -- optional: coupon applies only to this product
  created_at TEXT DEFAULT (datetime('now'))
);

-- Weight-based shipping brackets (INR, weight in kg). up_to_kg NULL = "and above".
CREATE TABLE IF NOT EXISTS shipping_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone TEXT DEFAULT 'domestic',   -- domestic | international
  up_to_kg REAL,                  -- upper bound of this bracket (kg); NULL = no upper bound
  price INTEGER,                  -- flat price for this bracket, in paise
  per_kg_over INTEGER DEFAULT 0,  -- extra paise per kg above up_to_kg (for the top bracket)
  sort INTEGER DEFAULT 0
);
INSERT OR IGNORE INTO shipping_rates (zone,up_to_kg,price,per_kg_over,sort) VALUES
 ('domestic',0.5, 8500, 0, 1),
 ('domestic',1.0, 14000,0, 2),
 ('domestic',2.0, 25000,0, 3),
 ('domestic',5.0, 48000,0, 4),
 ('domestic',NULL,64000,12000,5),
 ('international',1.0, 190000,0, 1),
 ('international',3.0, 420000,0, 2),
 ('international',NULL,640000,180000,3);

-- Key/value settings (Razorpay keys, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Free-shipping product list
CREATE TABLE IF NOT EXISTS free_shipping_products (
  slug TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Extend coupons with an optional per-product constraint (safe if column exists)
-- (D1 ignores duplicate-column errors on re-run; wrap in a no-op if already added)

-- Site analytics: lightweight page-view tracking
CREATE TABLE IF NOT EXISTS pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT, referrer TEXT, session TEXT, device TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pv_created ON pageviews(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_path ON pageviews(path);

-- Order status timeline
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT, kind TEXT, detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oe_order ON order_events(order_number);

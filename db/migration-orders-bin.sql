-- Order Bin (soft-delete) — run ONCE on an existing database.
--   wrangler d1 execute apaulogyecomm --remote --file=./db/migration-orders-bin.sql
-- Fresh installs already get this column from db/migrations-admin.sql, so run this
-- only on a database created before the Bin feature. If it errors with
-- "duplicate column name: deleted_at", the column already exists — nothing to do.

ALTER TABLE orders ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_deleted ON orders(deleted_at);

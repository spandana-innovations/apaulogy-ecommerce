#!/usr/bin/env node
/** Generate db/seed.sql from src/data/catalog.json (categories + products).
 *  Run: node scripts/gen-seed.mjs   (also runs automatically after import). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));
const s = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const lines = ['-- Auto-generated from src/data/catalog.json by scripts/gen-seed.mjs', 'PRAGMA foreign_keys = ON;', ''];

for (const c of catalog.categories) {
  lines.push(
    `INSERT INTO categories (slug, name, parent_slug, description, sort_order) VALUES (${s(c.slug)}, ${s(c.name)}, ${s(c.parent_slug)}, ${s(c.description)}, ${c.sort_order ?? 0}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description, sort_order=excluded.sort_order;`,
  );
}
lines.push('');
for (const p of catalog.products) {
  lines.push(
    `INSERT INTO products (slug, name, subtitle, description, short_desc, price, sale_price, category_slug, collection, featured, primary_image) VALUES (` +
      [s(p.slug), s(p.name), s(p.subtitle), s(p.description), s(p.short_desc), p.price || 0, p.sale_price ?? 'NULL', s(p.category_slug), s(p.collection), p.featured ? 1 : 0, s(p.images?.[0]?.url)].join(', ') +
      `) ON CONFLICT(slug) DO UPDATE SET price=excluded.price, sale_price=excluded.sale_price, updated_at=datetime('now');`,
  );
}

fs.writeFileSync(path.join(ROOT, 'db/seed.sql'), lines.join('\n') + '\n');
console.log(`Wrote db/seed.sql (${catalog.categories.length} categories, ${catalog.products.length} products).`);

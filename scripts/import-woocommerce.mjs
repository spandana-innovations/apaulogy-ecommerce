#!/usr/bin/env node
/**
 * aPaulogy import tool
 * ---------------------------------------------------------------------------
 * Turns a WooCommerce product CSV export and/or a WordPress WXR (XML) export
 * into:
 *   1. src/data/catalog.json        -> the storefront catalogue (products + cats)
 *   2. db/orders-import.sql         -> historical orders, idempotent by legacy id
 *   3. db/products-import.sql       -> products for D1 (inventory/admin)
 *   4. import/images/manifest.txt   -> list of product image URLs to fetch
 *   5. import/download-images.sh    -> downloads images locally
 *   6. import/upload-to-r2.sh       -> pushes images to R2 via wrangler
 *
 * Usage:
 *   node scripts/import-woocommerce.mjs --csv import/products.csv \
 *        --xml import/apaulogy.wordpress.xml --media-base https://cdn.apaulogy.com
 *
 * Flags:
 *   --csv <path>        WooCommerce "Products" CSV export
 *   --xml <path>        WordPress eXtended RSS (WXR) export
 *   --media-base <url>  Public base URL for images on R2 (default from env/MEDIA_BASE_URL)
 *   --no-catalog        Don't (re)write src/data/catalog.json
 *   --merge             Merge products into existing catalog.json instead of replacing
 *
 * Requires: npm install (fast-xml-parser is a devDependency).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
const CSV_PATH = arg('csv');
const XML_PATH = arg('xml');
const MEDIA_BASE = (arg('media-base') || process.env.MEDIA_BASE_URL || 'https://cdn.apaulogy.com').replace(/\/$/, '');
const WRITE_CATALOG = !arg('no-catalog', false);
const MERGE = !!arg('merge', false);

if (!CSV_PATH && !XML_PATH) {
  console.error('Nothing to import. Pass --csv <file> and/or --xml <file>.');
  console.error('See header of this script for usage.');
  process.exit(1);
}

const IMPORT_DIR = path.join(ROOT, 'import');
fs.mkdirSync(IMPORT_DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'db'), { recursive: true });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const paise = (v) => Math.round(parseFloat(String(v ?? '').replace(/[^0-9.]/g, '') || '0') * 100);
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
const sqlStr = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const stripTags = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// image url -> stable R2 key (path under media base)
function imageKeyFromUrl(url) {
  try {
    const u = new URL(url);
    // keep the WP uploads path so links stay legible: /uploads/2021/05/foo.jpg
    let p = u.pathname.replace(/^\/+/, '');
    p = p.replace(/^wp-content\/uploads\//, 'products/');
    if (!p.startsWith('products/')) p = 'products/' + p.split('/').pop();
    return p;
  } catch {
    return 'products/' + slugify(url) + '.jpg';
  }
}
const mediaUrl = (key) => `${MEDIA_BASE}/${key}`;

// robust CSV parser (RFC-4180-ish: quotes, commas, newlines in quotes)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

const allImages = new Set();
const products = [];
const categoriesMap = new Map(); // slug -> {slug,name}

function addCategory(name) {
  const slug = slugify(name);
  if (slug && !categoriesMap.has(slug)) categoriesMap.set(slug, { slug, name: name.trim() });
  return slug;
}

// ---------------------------------------------------------------------------
// 1) WooCommerce products CSV
// ---------------------------------------------------------------------------
function importCSV(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = parseCSV(text);
  if (!rows.length) return;
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const idx = {
    id: col(['id']),
    type: col(['type']),
    sku: col(['sku']),
    name: col(['name', 'title']),
    published: col(['published']),
    featured: col(['is featured?', 'featured']),
    short: col(['short description']),
    desc: col(['description']),
    regular: col(['regular price']),
    sale: col(['sale price']),
    stock: col(['stock']),
    categories: col(['categories']),
    tags: col(['tags']),
    images: col(['images']),
    parent: col(['parent']),
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const type = idx.type !== -1 ? row[idx.type] : 'simple';
    if (type && /^variation$/i.test(type)) continue; // skip variations for catalogue rows
    const name = row[idx.name]?.trim();
    if (!name) continue;

    const catNames = (idx.categories !== -1 ? row[idx.categories] : '')
      .split(/,\s*/)
      .map((c) => c.split('>').pop().trim())
      .filter(Boolean);
    const catSlug = catNames.length ? addCategory(catNames[0]) : 'uncategorised';
    catNames.forEach(addCategory);

    const imgs = (idx.images !== -1 ? row[idx.images] : '')
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    imgs.forEach((u) => allImages.add(u));

    const regular = idx.regular !== -1 ? paise(row[idx.regular]) : 0;
    const sale = idx.sale !== -1 && row[idx.sale] ? paise(row[idx.sale]) : null;

    products.push({
      legacy_id: idx.id !== -1 ? row[idx.id] : undefined,
      slug: slugify(name),
      sku: idx.sku !== -1 ? row[idx.sku] : undefined,
      name,
      short_desc: idx.short !== -1 ? stripTags(row[idx.short]) : undefined,
      description: idx.desc !== -1 ? row[idx.desc] : undefined,
      price: regular || sale || 0,
      sale_price: sale && sale < regular ? sale : null,
      category_slug: catSlug,
      collection: catNames[0] || undefined,
      featured: idx.featured !== -1 && /^1|yes|true$/i.test(row[idx.featured] || '') ? true : false,
      stock: idx.stock !== -1 && row[idx.stock] !== '' ? parseInt(row[idx.stock], 10) : null,
      tags: idx.tags !== -1 ? row[idx.tags].split(/,\s*/).filter(Boolean) : [],
      images: imgs.map((u, i) => ({ url: mediaUrl(imageKeyFromUrl(u)), alt: name, sort: i })),
    });
  }
  console.log(`CSV: parsed ${products.length} products, ${categoriesMap.size} categories.`);
}

// ---------------------------------------------------------------------------
// 2) WordPress WXR (XML) — products (if present) + orders
// ---------------------------------------------------------------------------
const orders = [];

async function importXML(file) {
  const { XMLParser } = await import('fast-xml-parser');
  const xml = fs.readFileSync(file, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    trimValues: true,
  });
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) { console.warn('XML: no <channel> found.'); return; }
  let items = channel.item || [];
  if (!Array.isArray(items)) items = [items];

  const text = (v) => (v && typeof v === 'object' ? v.__cdata ?? v['#text'] ?? '' : v ?? '');
  const metaMap = (item) => {
    const m = {};
    let pm = item['wp:postmeta'];
    if (!pm) return m;
    if (!Array.isArray(pm)) pm = [pm];
    for (const e of pm) m[text(e['wp:meta_key'])] = text(e['wp:meta_value']);
    return m;
  };

  // Build attachment map (id -> url) for image resolution
  const attach = {};
  for (const it of items) {
    if (text(it['wp:post_type']) === 'attachment') {
      attach[text(it['wp:post_id'])] = text(it['wp:attachment_url']);
    }
  }

  let prodCount = 0, orderCount = 0;
  for (const it of items) {
    const type = text(it['wp:post_type']);

    // ---- products from XML (only if no CSV supplied) ----
    if (type === 'product' && !CSV_PATH) {
      const meta = metaMap(it);
      const name = text(it.title);
      if (!name) continue;
      const regular = paise(meta._regular_price || meta._price);
      const sale = meta._sale_price ? paise(meta._sale_price) : null;

      // categories
      let cats = it.category || [];
      if (!Array.isArray(cats)) cats = [cats];
      const catNames = cats
        .filter((c) => c['@_domain'] === 'product_cat')
        .map((c) => text(c['#text'] || c.__cdata || c))
        .filter(Boolean);
      const catSlug = catNames.length ? addCategory(catNames[0]) : 'uncategorised';
      catNames.forEach(addCategory);

      // images: featured thumbnail + gallery ids
      const imgIds = [meta._thumbnail_id, ...String(meta._product_image_gallery || '').split(',')]
        .map((s) => String(s || '').trim())
        .filter(Boolean);
      const imgs = imgIds.map((id) => attach[id]).filter(Boolean);
      imgs.forEach((u) => allImages.add(u));

      products.push({
        legacy_id: text(it['wp:post_id']),
        slug: slugify(text(it['wp:post_name']) || name),
        sku: meta._sku || undefined,
        name,
        short_desc: stripTags(text(it['excerpt:encoded'])),
        description: text(it['content:encoded']),
        price: regular || sale || 0,
        sale_price: sale && sale < regular ? sale : null,
        category_slug: catSlug,
        collection: catNames[0] || undefined,
        featured: meta._featured === 'yes',
        stock: meta._stock !== '' && meta._stock != null ? parseInt(meta._stock, 10) : null,
        tags: [],
        images: imgs.map((u, i) => ({ url: mediaUrl(imageKeyFromUrl(u)), alt: name, sort: i })),
      });
      prodCount++;
    }

    // ---- orders (WooCommerce shop_order) ----
    if (type === 'shop_order' || type === 'shop_order_placehold') {
      const meta = metaMap(it);
      const status = (text(it['wp:status']) || '').replace(/^wc-/, '') || 'completed';
      const items_json = [];
      // Line items live in order_itemmeta in the DB, not always in WXR. WXR
      // typically lacks line items; we still capture the order header + totals.
      orders.push({
        legacy_id: text(it['wp:post_id']),
        order_number: meta._order_number || text(it['wp:post_id']),
        status,
        email: meta._billing_email || '',
        phone: meta._billing_phone || '',
        total: paise(meta._order_total),
        shipping: paise(meta._order_shipping),
        tax: paise(meta._order_tax),
        currency: meta._order_currency || 'INR',
        created_at: text(it['wp:post_date_gmt']) || text(it.pubDate) || '',
        billing: {
          name: `${meta._billing_first_name || ''} ${meta._billing_last_name || ''}`.trim(),
          line1: meta._billing_address_1, line2: meta._billing_address_2,
          city: meta._billing_city, state: meta._billing_state,
          postcode: meta._billing_postcode, country: meta._billing_country,
          email: meta._billing_email, phone: meta._billing_phone,
        },
        items: items_json,
      });
      orderCount++;
    }
  }
  console.log(`XML: parsed ${prodCount} products, ${orderCount} orders.`);
}

// ---------------------------------------------------------------------------
// writers
// ---------------------------------------------------------------------------
function dedupeSlugs(list) {
  const seen = new Map();
  for (const p of list) {
    let s = p.slug || slugify(p.name);
    if (seen.has(s)) { const n = seen.get(s) + 1; seen.set(s, n); p.slug = `${s}-${n}`; }
    else seen.set(s, 1), (p.slug = s);
  }
}

function writeCatalog() {
  dedupeSlugs(products);
  const categories = [...categoriesMap.values()].map((c, i) => ({ ...c, sort_order: i + 1 }));
  const outProducts = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    subtitle: p.collection,
    collection: p.collection,
    category_slug: p.category_slug || 'uncategorised',
    price: p.price,
    sale_price: p.sale_price ?? null,
    short_desc: p.short_desc || '',
    description: p.description || '',
    featured: !!p.featured,
    tags: p.tags || [],
    images: (p.images || []).map(({ url, alt }) => ({ url, alt })),
  }));

  const outPath = path.join(ROOT, 'src/data/catalog.json');
  let data = { categories, products: outProducts };
  if (MERGE && fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const bySlug = new Map(prev.products.map((p) => [p.slug, p]));
    for (const p of outProducts) bySlug.set(p.slug, p);
    const catBySlug = new Map(prev.categories.map((c) => [c.slug, c]));
    for (const c of categories) if (!catBySlug.has(c.slug)) catBySlug.set(c.slug, c);
    data = { categories: [...catBySlug.values()], products: [...bySlug.values()] };
  }
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${outPath} (${data.products.length} products, ${data.categories.length} categories).`);
}

function writeProductsSql() {
  dedupeSlugs(products);
  const lines = ['-- Products import for D1 (inventory/admin). Idempotent by slug.', 'PRAGMA foreign_keys = ON;', ''];
  for (const p of products) {
    lines.push(
      `INSERT INTO products (slug, sku, name, subtitle, description, short_desc, price, sale_price, category_slug, collection, featured, stock, primary_image) VALUES (` +
        [sqlStr(p.slug), sqlStr(p.sku), sqlStr(p.name), sqlStr(p.collection), sqlStr(p.description), sqlStr(p.short_desc), p.price || 0, p.sale_price ?? 'NULL', sqlStr(p.category_slug), sqlStr(p.collection), p.featured ? 1 : 0, p.stock ?? 'NULL', sqlStr(p.images?.[0]?.url)].join(', ') +
        `) ON CONFLICT(slug) DO UPDATE SET price=excluded.price, sale_price=excluded.sale_price, stock=excluded.stock, updated_at=datetime('now');`,
    );
  }
  const out = path.join(ROOT, 'db/products-import.sql');
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Wrote ${out} (${products.length} products).`);
}

function writeOrdersSql() {
  if (!orders.length) return;
  const lines = ['-- Historical orders import for D1. Idempotent by legacy_id.', 'PRAGMA foreign_keys = ON;', ''];
  for (const o of orders) {
    lines.push(
      `INSERT INTO orders (legacy_id, order_number, email, phone, status, currency, subtotal, shipping, tax, total, billing_json, source, created_at) VALUES (` +
        [
          sqlStr(o.legacy_id), sqlStr(o.order_number), sqlStr(o.email), sqlStr(o.phone),
          sqlStr(o.status), sqlStr(o.currency),
          Math.max(0, (o.total || 0) - (o.shipping || 0) - (o.tax || 0)),
          o.shipping || 0, o.tax || 0, o.total || 0,
          sqlStr(JSON.stringify(o.billing || {})), `'import'`,
          sqlStr(o.created_at ? new Date(o.created_at).toISOString().slice(0, 19).replace('T', ' ') : null),
        ].join(', ') +
        `) ON CONFLICT(legacy_id) DO NOTHING;`,
    );
    for (const li of o.items || []) {
      lines.push(
        `INSERT INTO order_items (order_id, product_slug, name, quantity, unit_price, total) ` +
          `SELECT id, ${sqlStr(li.slug)}, ${sqlStr(li.name)}, ${li.qty || 1}, ${li.price || 0}, ${(li.price || 0) * (li.qty || 1)} FROM orders WHERE legacy_id = ${sqlStr(o.legacy_id)};`,
      );
    }
  }
  const out = path.join(ROOT, 'db/orders-import.sql');
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Wrote ${out} (${orders.length} orders).`);
}

function writeImageScripts() {
  if (!allImages.size) return;
  const list = [...allImages];
  fs.mkdirSync(path.join(IMPORT_DIR, 'images'), { recursive: true });
  fs.writeFileSync(path.join(IMPORT_DIR, 'images/manifest.txt'), list.join('\n') + '\n');

  const dl = ['#!/usr/bin/env bash', 'set -euo pipefail', 'cd "$(dirname "$0")/images"', ''];
  const up = ['#!/usr/bin/env bash', 'set -euo pipefail',
    '# Upload downloaded images to R2. Run after download-images.sh.',
    'BUCKET="apaulogy-media"', 'cd "$(dirname "$0")/images"', ''];
  for (const url of list) {
    const key = imageKeyFromUrl(url);
    const local = key.replace(/[\/]/g, '__');
    dl.push(`curl -fsSL ${JSON.stringify(url)} -o ${JSON.stringify(local)} || echo "skip ${url}"`);
    up.push(`wrangler r2 object put "$BUCKET/${key}" --file ${JSON.stringify(local)} --remote`);
  }
  fs.writeFileSync(path.join(IMPORT_DIR, 'download-images.sh'), dl.join('\n') + '\n');
  fs.writeFileSync(path.join(IMPORT_DIR, 'upload-to-r2.sh'), up.join('\n') + '\n');
  fs.chmodSync(path.join(IMPORT_DIR, 'download-images.sh'), 0o755);
  fs.chmodSync(path.join(IMPORT_DIR, 'upload-to-r2.sh'), 0o755);
  console.log(`Wrote import/download-images.sh & import/upload-to-r2.sh (${list.size ?? list.length} images).`);
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
(async () => {
  if (CSV_PATH) {
    if (!fs.existsSync(CSV_PATH)) { console.error(`CSV not found: ${CSV_PATH}`); process.exit(1); }
    importCSV(CSV_PATH);
  }
  if (XML_PATH) {
    if (!fs.existsSync(XML_PATH)) { console.error(`XML not found: ${XML_PATH}`); process.exit(1); }
    await importXML(XML_PATH);
  }

  if (WRITE_CATALOG && products.length) writeCatalog();
  if (products.length) writeProductsSql();
  writeOrdersSql();
  writeImageScripts();

  console.log('\nDone. Next:');
  console.log('  1) bash import/download-images.sh   # fetch images locally');
  console.log('  2) bash import/upload-to-r2.sh      # push to R2 (needs wrangler login)');
  console.log('  3) npm run db:remote                 # ensure schema exists');
  console.log('  4) wrangler d1 execute apaulogy --remote --file=./db/products-import.sql');
  console.log('  5) wrangler d1 execute apaulogy --remote --file=./db/orders-import.sql');
  console.log('  6) commit the updated src/data/catalog.json and redeploy.');
})();

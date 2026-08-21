# aPaulogy — e‑commerce

A fast, mobile‑first, SEO‑optimised store for **aPaulogy** — the gallery of
watercolourist Paul Fernandes (signed prints of 1970s Bangalore, vintage Mumbai
& Goa, plus everyday merchandise).

Built to deploy on **Cloudflare Pages** with **D1** (database) and **R2**
(images), and to take payments through **Razorpay**.

- **Framework:** [Astro](https://astro.build) (static‑first → near‑instant loads, perfect for SEO) with the Cloudflare adapter for the few dynamic routes (cart, checkout, webhooks).
- **Styling:** Tailwind CSS v4 + a small custom design system (`src/styles/global.css`).
- **Zero heavy JS:** the storefront ships almost no client JavaScript; the cart is a tiny vanilla script.

---

## 1. Quick start (local)

```bash
npm install
cp .env.example .env            # fill in Razorpay test keys when you have them
cp .dev.vars.example .dev.vars  # same values, for the edge runtime in dev
npm run dev                     # http://localhost:4321
```

The store renders immediately from `src/data/catalog.json` (12 sample products
with generated watercolour placeholders) so you can see the design without any
data import or keys.

```bash
npm run build      # production build -> ./dist
npm run typecheck  # astro check
```

---

## 2. Deploy to Cloudflare Pages

You deploy from this git repo (Pages → *Connect to Git*).

**Build settings**
- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`

**One‑time infrastructure** (via the [`wrangler`](https://developers.cloudflare.com/workers/wrangler/) CLI, `npx wrangler login` first):

```bash
# D1 database
npx wrangler d1 create apaulogy
#   -> copy the returned database_id into wrangler.toml (database_id = "...")

# R2 bucket for product images
npx wrangler r2 bucket create apaulogy-media

# Create the schema (remote), then seed the sample catalogue
npm run db:remote
npm run db:seed:remote
```

**Bindings** — in the Pages project: *Settings → Functions → Bindings*, add:
| Type | Variable name | Value |
|------|---------------|-------|
| D1 database | `DB` | `apaulogy` |
| R2 bucket | `MEDIA` | `apaulogy-media` |

(These names match `wrangler.toml`, so `wrangler pages dev` works locally too.)

**Secrets & vars** — *Settings → Environment variables* (Production + Preview):
| Name | Notes |
|------|-------|
| `RAZORPAY_KEY_ID` | public key id |
| `RAZORPAY_KEY_SECRET` | **secret** — encrypt it |
| `RAZORPAY_WEBHOOK_SECRET` | **secret** — from the webhook you create |
| `SITE_URL` | e.g. `https://apaulogy.com` |
| `MEDIA_BASE_URL` | e.g. `https://cdn.apaulogy.com` (custom domain on the R2 bucket) |
| `CURRENCY` | `INR` |

**Custom domain for images:** map a domain (e.g. `cdn.apaulogy.com`) to the R2
bucket (*R2 → bucket → Settings → Custom Domains*). Product image URLs are built
from `MEDIA_BASE_URL`.

---

## 3. Razorpay

1. Create the API keys (Dashboard → *Settings → API Keys*). Use **test** keys first.
2. Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` as Pages secrets.
3. Create a **webhook** (Dashboard → *Settings → Webhooks*):
   - URL: `https://apaulogy.com/api/razorpay-webhook`
   - Secret: a strong random string → also set as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `order.paid`, `payment.failed`

**Flow:** `checkout` page → `POST /api/checkout` (server recomputes prices from
the catalogue, creates a Razorpay order, writes a `pending` order to D1) →
Razorpay Checkout opens in the browser → on success the browser hits
`POST /api/verify` (signature check, fast UI update) **and** the webhook confirms
the payment authoritatively (`markOrderPaid`, idempotent).

Prices are **never** trusted from the client — they are recomputed server‑side.

---

## 4. Fonts — BrandyWine

Titles use a display font called **BrandyWine**. Add the licensed files and the
site picks them up automatically:

```
public/fonts/brandywine.woff2
public/fonts/brandywine.woff
```

Then uncomment the preload line in `src/layouts/BaseLayout.astro` (marked in a
comment) for the best LCP. Until the files are present, titles fall back to a
refined serif (Cormorant Garamond / Georgia) — nothing ever renders broken.
See `public/fonts/README.md` for conversion tips.

---

## 5. Importing the old WooCommerce / WordPress store

You can hand me (or run yourself) two exports:
- **WooCommerce product CSV** — *WooCommerce → Products → Export*.
- **WordPress WXR (XML)** — *Tools → Export → All content* (contains orders + media).

Place them in `import/` and run:

```bash
node scripts/import-woocommerce.mjs \
  --csv import/products.csv \
  --xml import/apaulogy.wordpress.xml \
  --media-base https://cdn.apaulogy.com
```

This generates:
| Output | Purpose |
|--------|---------|
| `src/data/catalog.json` | the storefront catalogue (products + categories) — commit this |
| `db/products-import.sql` | products for D1 (inventory/admin) |
| `db/orders-import.sql` | **historical orders**, idempotent by legacy id |
| `import/download-images.sh` | fetches every product image locally |
| `import/upload-to-r2.sh` | pushes them to R2 via `wrangler` |

Then:

```bash
bash import/download-images.sh
bash import/upload-to-r2.sh
npx wrangler d1 execute apaulogy --remote --file=./db/products-import.sql
npx wrangler d1 execute apaulogy --remote --file=./db/orders-import.sql
git add src/data/catalog.json && git commit -m "Import catalogue" && git push
```

> Re‑running is safe: orders use `ON CONFLICT(legacy_id) DO NOTHING`, products
> upsert by slug. Use `--merge` to add to the existing catalogue instead of
> replacing it.

**Note on WXR order line‑items:** WordPress's XML export often omits individual
order *line items* (they live in a separate DB table). Order headers, totals,
customer and address import fully. If you also want per‑item history, export the
`wp_woocommerce_order_items` tables (SQL/CSV) and I'll extend the importer.

---

## 6. Project structure

```
src/
  data/catalog.json        # source of truth for the storefront catalogue
  layouts/BaseLayout.astro # <head>, SEO meta, OG, JSON-LD, header/footer
  components/              # Header, Footer, ProductCard, ArtPlaceholder
  lib/                     # catalog, format, seo (schema.org), razorpay, db
  pages/
    index.astro            # home
    store/                 # all products
    category/[slug].astro  # collections & categories
    product/[slug].astro   # product detail (+ Product JSON-LD)
    cart.astro, checkout.astro, order-confirmed.astro
    about-us, faq, terms-conditions, privacy-policy, contact
    api/                   # checkout, verify, razorpay-webhook, subscribe, contact
  scripts/cart.ts          # tiny localStorage cart
  styles/global.css        # design system + fonts
db/
  schema.sql               # D1 schema
  seed.sql                 # generated from catalog.json (npm run db:seed)
scripts/
  import-woocommerce.mjs   # WooCommerce/WP importer
  gen-seed.mjs             # catalog.json -> db/seed.sql
public/                    # robots.txt, favicon, OG image, _headers, fonts/
wrangler.toml              # bindings (D1, R2) + non-secret vars
```

## 7. SEO features

- Static HTML for every catalogue page (fast, fully crawlable).
- Per‑page `<title>`, meta description, canonical URL.
- Open Graph + Twitter cards.
- JSON‑LD: `Store`, `WebSite` (sitelinks search), `Product` (rich results),
  `BreadcrumbList`, and `FAQPage`.
- `sitemap-index.xml` (auto, excludes cart/checkout) + `robots.txt`.
- Semantic headings, alt text, skip‑link, focus styles, reduced‑motion support.
- Long‑cache immutable assets via `public/_headers`.

## 8. What still needs you

- [ ] **BrandyWine font files** → `public/fonts/` (titles).
- [ ] **Razorpay keys** → Pages secrets (payments go live).
- [ ] **WooCommerce CSV + WordPress XML** → run the importer (real products, images, order history).
- [ ] Point image URLs at your R2 domain (`MEDIA_BASE_URL`).
- [ ] Confirm exact brand colours / any specific layout details vs. the current design.

---

_Artwork © Paul Fernandes. Store scaffold generated for deployment on Cloudflare._

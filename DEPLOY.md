# aPaulogy — deploy (Cloudflare compiles from Git)

Cloudflare builds this repo on every push to `main`. You do NOT build locally.

## Bindings live in the Cloudflare dashboard (not in wrangler.toml)
On the `apaulogy-ecommerce` Pages/Worker project → Settings → Bindings:
  - D1: variable `DB`   → database `apaulogyecomm`
  - R2: variable `MEDIA` → bucket `apaulogyecomm`
(These are already set. wrangler.toml intentionally has NO d1/r2 blocks so it can't
override the dashboard with a stale id.)

## Secrets (Settings → Variables and Secrets, encrypted)
  ADMIN_SECRET, ADMIN_PASS            (admin login; mmp/MMP@QP2X2026 also built-in)
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
  (PhonePe + Resend keys can be added in-app under /apaulogy-admin → Settings)

## Load data into D1 (once, if not already done)
D1 → apaulogyecomm → Console, in order:
  db/migrations-admin.sql
  db/import-customers.sql
  db/import-orders.sql
  db/import-items.sql

## Every update = just push
    git add -A && git commit -m "update" && git push origin main

## Admin
/apaulogy-admin  (desktop only; artwork captcha, then admin/mmp + password)

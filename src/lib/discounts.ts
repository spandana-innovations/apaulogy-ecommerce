/* Discount engine shared by checkout API and admin. Prices in paise. */
type Env = Record<string, any>;
export type Line = { slug: string; price: number; quantity: number; category?: string };

export async function activeDiscounts(env: Env) {
  if (!env?.DB) return [];
  try {
    const r = await env.DB.prepare(
      `SELECT scope,target,kind,value FROM discounts WHERE active=1
        AND (starts IS NULL OR starts<=datetime('now')) AND (ends IS NULL OR ends>=datetime('now'))`).all();
    return r.results || [];
  } catch { return []; }
}

export async function getCoupon(env: Env, code: string) {
  if (!env?.DB || !code) return null;
  try {
    const r = await env.DB.prepare(
      `SELECT code,kind,value,min_order,active,ends,product_slug FROM coupons WHERE code=? AND active=1`).bind(code.toUpperCase()).first();
    if (!r) return null;
    if (r.ends && new Date(r.ends) < new Date()) return null;
    return r;
  } catch { return null; }
}

/** Apply product/category/all discounts + optional coupon. Returns paise amounts. */
export function computeDiscount(
  lines: Line[], subtotal: number, discounts: any[], coupon: any | null,
): { discount: number; freeShipping: boolean } {
  let discount = 0;
  let freeShipping = false;

  for (const d of discounts) {
    if (d.kind === 'free_shipping' && d.scope === 'all') freeShipping = true;
  }
  // per-line product/category percentage or fixed
  for (const ln of lines) {
    const lineTotal = ln.price * ln.quantity;
    for (const d of discounts) {
      const targets = (d.target || '').split(',').map((t: string) => t.trim()).filter(Boolean);
      const hit = (d.scope === 'all')
        || (d.scope === 'product' && targets.includes(ln.slug))
        || (d.scope === 'category' && targets.includes(ln.category));
      if (!hit) continue;
      if (d.kind === 'percent') discount += Math.round(lineTotal * d.value / 100);
      else if (d.kind === 'fixed') discount += Math.min(lineTotal, d.value * 100);
      else if (d.kind === 'free_shipping') freeShipping = true;
    }
  }
  // coupon — optionally constrained to a single product
  if (coupon && subtotal >= (coupon.min_order || 0) * 100) {
    const base = coupon.product_slug
      ? lines.filter((l) => l.slug === coupon.product_slug).reduce((s, l) => s + l.price * l.quantity, 0)
      : (subtotal - discount);
    if (coupon.kind === 'percent') discount += Math.round(base * coupon.value / 100);
    else if (coupon.kind === 'fixed') discount += Math.min(base, coupon.value * 100);
    else if (coupon.kind === 'free_shipping') freeShipping = true;
  }
  discount = Math.max(0, Math.min(discount, subtotal));
  return { discount, freeShipping };
}

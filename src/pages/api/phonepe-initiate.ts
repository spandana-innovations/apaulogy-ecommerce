import type { APIRoute } from 'astro';
import { phonepeConfig, phonepeToken } from '../../lib/payments';
import { createPendingOrder } from '../../lib/db';
import { getProduct, effectivePrice } from '../../lib/catalog';
import { activeDiscounts, getCoupon, computeDiscount } from '../../lib/discounts';
import { cartWeight, getRates, shippingFor } from '../../lib/shipping';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const cfg = await phonepeConfig(env);
  if (!cfg.clientId || !cfg.clientSecret) return json({ error: 'PhonePe is not configured (client id/secret missing).' }, 503);

  let b: any = {}; try { b = await request.json(); } catch {}

  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length) return json({ error: 'Your cart is empty.' }, 400);
  const customer = b.billing || {};

  // Recompute everything server-side from the trusted catalogue — never trust
  // client-supplied amount/shipping (mirrors /api/checkout).
  let subtotal = 0;
  const lines: any[] = [];
  for (const it of rawItems) {
    const p = getProduct(it.slug);
    if (!p) return json({ error: `Item not found: ${it.slug}` }, 400);
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it.quantity ?? it.qty) || 1)));
    const unit = effectivePrice(p);
    subtotal += unit * qty;
    lines.push({ slug: p.slug, name: p.name, variant: it.variant, quantity: qty, price: unit });
  }

  const discountLines = lines.map((l) => ({ slug: l.slug, price: l.price, quantity: l.quantity, category: getProduct(l.slug)?.primary_category }));
  const discs = await activeDiscounts(env);
  const coupon = b.coupon ? await getCoupon(env, b.coupon) : null;
  const { discount } = computeDiscount(discountLines, subtotal, discs, coupon);

  const isBangalore = /^560\d{3}$/.test(String(customer.postcode || '').trim());
  const deliveryMethod = (b.delivery_method === 'porter' && isBangalore) ? 'porter' : 'standard';
  const zone = (customer.country && !/india/i.test(customer.country)) ? 'international' : 'domestic';
  const weight = cartWeight(rawItems.map((it: any) => ({ slug: it.slug, qty: it.quantity ?? it.qty })));
  const rates = await getRates(env, zone);
  // Free shipping removed: always charge from the rate table (Porter aside).
  const shipping = deliveryMethod === 'porter' ? 0 : shippingFor(weight, rates);
  const amount = Math.max(0, subtotal - discount) + shipping;   // paise, authoritative
  if (amount < 100) return json({ error: 'Invalid amount.' }, 400);

  const origin = env.SITE_URL || new URL(request.url).origin;
  const merchantOrderId = 'APG' + Date.now() + Math.random().toString(36).slice(2, 7);

  // Persist a pending order (so it appears in admin + can be status-checked), mirroring the Razorpay flow.
  let orderNumber = '';
  if (env.DB) {
    try {
      const rec = await createPendingOrder(env.DB, {
        email: b.email || '', phone: b.phone || '',
        items: lines, subtotal, shipping, total: amount,
        billing: b.billing || null, shipping_address: b.billing || null,
        phonepe_order_id: merchantOrderId, payment_method: 'phonepe',
      });
      orderNumber = rec.orderNumber;
    } catch (e) { console.error('phonepe order record failed', e); }
  }

  const payload = {
    merchantOrderId, amount, expireAfter: 1200,
    paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: `${origin}/api/phonepe-callback?order=${merchantOrderId}` } },
    metaInfo: { udf1: (b.email || '').slice(0, 256), udf2: orderNumber },
  };

  try {
    const token = await phonepeToken(env, cfg);
    const r = await fetch(cfg.payHost + '/checkout/v2/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}`, accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const d: any = await r.json();
    if (r.ok && d?.redirectUrl) return json({ ok: true, redirect: d.redirectUrl, order: merchantOrderId, order_number: orderNumber });
    return json({ error: d?.message || d?.code || 'PhonePe initiation failed.', detail: d }, 502);
  } catch (e: any) {
    return json({ error: 'Could not reach PhonePe: ' + (e?.message || e) }, 502);
  }
};
function json(o: any, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }

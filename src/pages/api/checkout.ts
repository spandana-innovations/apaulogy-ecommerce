import type { APIRoute } from 'astro';
import { getProduct, effectivePrice } from '../../lib/catalog';
import { createRazorpayOrder } from '../../lib/razorpay';
import { createPendingOrder, type CartLine } from '../../lib/db';
import { activeDiscounts, getCoupon, computeDiscount } from '../../lib/discounts';
import { cartWeight, getRates, shippingFor, freeShippingSlugs } from '../../lib/shipping';
import { getSetting } from '../../lib/admin-data';
import { verifySession, readCookie, ADMIN_COOKIE } from '../../lib/admin-auth';

export const prerender = false;

const FREE_SHIPPING_OVER = 500000; // paise (₹5,000)
const SHIPPING_FLAT = 15000;       // paise (₹150)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Fallback human reference when the database isn't wired up yet.
function fallbackRef(): string {
  return `APG-${Math.floor(Date.now() / 1000) % 1000000}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const _env0 = (locals as any)?.runtime?.env ?? {};
  // admin_no_order: signed-in admins cannot place orders
  if (await verifySession(readCookie(request, ADMIN_COOKIE), _env0)) {
    return new Response(JSON.stringify({ error: 'Admin accounts cannot place orders. Please use a customer account.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const env = locals?.runtime?.env ?? ({} as Record<string, any>);

  let body: {
    items?: { slug: string; qty: number; variant?: string }[];
    customer?: Record<string, string>;
    coupon?: string;
      };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const rawItems = body.items ?? [];
  const customer = body.customer ?? {};
  if (!rawItems.length) return json({ error: 'Your cart is empty.' }, 400);
  if (!customer.email || !customer.name) return json({ error: 'Name and email are required.' }, 400);

  // Recompute every price server-side from the trusted catalogue — never trust
  // client-supplied prices.
  const lines: CartLine[] = [];
  let subtotal = 0;
  for (const it of rawItems) {
    const p = getProduct(it.slug);
    if (!p) return json({ error: `Item not found: ${it.slug}` }, 400);
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));
    const unit = effectivePrice(p);
    subtotal += unit * qty;
    lines.push({ slug: p.slug, name: p.name, variant: it.variant, quantity: qty, price: unit });
  }

  // Apply active discounts + optional coupon (server-side, from D1).
  const discountLines = lines.map((l, i) => ({
    slug: l.slug, price: l.price, quantity: l.quantity,
    category: getProduct(rawItems[i].slug)?.primary_category,
  }));
  const discs = await activeDiscounts(env);
  const coupon = body.coupon ? await getCoupon(env, body.coupon) : null;
  const { discount, freeShipping } = computeDiscount(discountLines, subtotal, discs, coupon);

  const zone = (customer.country && !/india/i.test(customer.country)) ? 'international' : 'domestic';
  const weight = cartWeight(rawItems.map((it) => ({ slug: it.slug, qty: it.qty })));
  const rates = await getRates(env, zone);
  const freeSlugs = await freeShippingSlugs(env);
  const hasFreeItem = rawItems.some((it) => freeSlugs.has(it.slug));
  const shipping = (freeShipping || hasFreeItem) ? 0 : shippingFor(weight, rates);
  const total = Math.max(0, subtotal - discount) + shipping;

  const address = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    line1: customer.line1,
    line2: customer.line2,
    city: customer.city,
    state: customer.state,
    postcode: customer.postcode,
    country: customer.country || 'India',
  };


  // ---- Online payment via Razorpay. ----------------------------------------
  // Keys come from env (most secure) or fall back to admin Settings in D1.
  const keyId = env.RAZORPAY_KEY_ID || (await getSetting(env, 'razorpay_key_id')) || '';
  const keySecret = env.RAZORPAY_KEY_SECRET || (await getSetting(env, 'razorpay_key_secret')) || '';
  if (!keyId || !keySecret) {
    return json({ error: 'Online payments are not configured yet. Please try again later.' }, 503);
  }
  const rzpEnv = { ...env, RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret };

  try {
    const receipt = `apg_${Date.now()}`;
    const rzpOrder = await createRazorpayOrder(rzpEnv, total, receipt, {
      email: customer.email,
      name: customer.name,
    });

    let orderNumber = fallbackRef();
    if (env.DB) {
      try {
        const rec = await createPendingOrder(env.DB, {
          email: customer.email,
          phone: customer.phone,
          items: lines,
          subtotal,
          shipping,
          total,
          billing: address,
          shipping_address: address,
          razorpay_order_id: rzpOrder.id,
          payment_method: 'razorpay',
        });
        orderNumber = rec.orderNumber;
      } catch (err) {
        console.error('order record failed', err);
      }
    }

    return json({
      key_id: keyId,
      order_id: rzpOrder.id,
      amount: total,
      currency: 'INR',
      order_number: orderNumber,
    });
  } catch (err) {
    console.error('checkout error', err);
    return json({ error: 'Could not start payment. Please try again.' }, 500);
  }
};

import type { APIRoute } from 'astro';
import { getProduct, effectivePrice } from '../../lib/catalog';
import { createRazorpayOrder } from '../../lib/razorpay';
import { createPendingOrder, type CartLine } from '../../lib/db';

export const prerender = false;

const FREE_SHIPPING_OVER = 500000; // paise
const SHIPPING_FLAT = 15000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ error: 'Payments are not configured yet.' }, 503);
  }

  let body: { items?: { slug: string; qty: number; variant?: string }[]; customer?: Record<string, string> };
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

  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

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

  try {
    const receipt = `apg_${Date.now()}`;
    const rzpOrder = await createRazorpayOrder(env, total, receipt, {
      email: customer.email,
      name: customer.name,
    });

    const { orderNumber } = await createPendingOrder(env.DB, {
      email: customer.email,
      phone: customer.phone,
      items: lines,
      subtotal,
      shipping,
      total,
      billing: address,
      shipping_address: address,
      razorpay_order_id: rzpOrder.id,
    });

    return json({
      key_id: env.RAZORPAY_KEY_ID,
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

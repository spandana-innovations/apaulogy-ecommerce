import type { APIRoute } from 'astro';
import { readCustomerSession, readCookie } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const sess = await readCustomerSession(readCookie(request), env);
  if (!sess) return j({ ok: false, error: 'Please sign in.' }, 401);
  if (!env.DB) return j({ ok: false, error: 'Unavailable.' }, 503);

  const ref = (url.searchParams.get('ref') || '').trim();
  if (!ref) return j({ ok: false, error: 'No order.' }, 400);

  try {
    // Only ever return an order that belongs to the signed-in account.
    const o: any = await env.DB.prepare(
      `SELECT order_number, email, status, subtotal, shipping, total, billing_json, shipping_json, created_at, tracking_number, tracking_carrier
       FROM orders WHERE order_number=? AND LOWER(email)=LOWER(?)`).bind(ref, sess.email).first();
    if (!o) return j({ ok: false, error: 'Order not found.' }, 404);

    const items = ((await env.DB.prepare(
      `SELECT name, variant, price, quantity FROM order_items WHERE order_number=?`).bind(ref).all()).results) || [];
    let addr: any = null;
    try { addr = o.shipping_json ? JSON.parse(o.shipping_json) : (o.billing_json ? JSON.parse(o.billing_json) : null); } catch {}

    return j({
      ok: true,
      ref: o.order_number, status: o.status, date: o.created_at,
      subtotal: o.subtotal, shipping: o.shipping, total: o.total,
      tracking: o.tracking_number || '', carrier: o.tracking_carrier || '',
      items, address: addr,
    });
  } catch (e: any) { return j({ ok: false, error: 'Could not load the order.' }, 500); }
};

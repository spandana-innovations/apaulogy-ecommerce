import type { APIRoute } from 'astro';
import { getOrder } from '../../../lib/admin-data';
import { notify } from '../../../lib/notify';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.order) return json({ ok: false, error: 'No order.' });
  const o: any = await getOrder(env, b.order);
  if (!o) return json({ ok: false, error: 'Order not found.' });
  const bill = o.billing_json ? JSON.parse(o.billing_json) : {};
  const event = b.event === 'shipping_update' ? 'shipping_update' : 'order_confirmation';
  const payload = {
    order_number: o.order_number, email: o.email, phone: o.phone, name: bill.name, billing: bill,
    items: o.items || [], subtotal: o.subtotal, shipping: o.shipping, total: o.total,
    tracking_number: o.tracking_number, tracking_carrier: o.tracking_carrier,
    payment_method: (o.notes || '').includes('phonepe') ? 'PhonePe' : 'Razorpay',
  };
  const results = await notify(env, event as any, payload);
  const sent = Object.entries(results).filter(([, r]: any) => r?.ok).map(([k]) => k);
  const failed = Object.entries(results).filter(([, r]: any) => r && !r.ok).map(([k, r]: any) => `${k}: ${r.error}`);
  return json({ ok: sent.length > 0, sent, failed });
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../lib/razorpay';
import { markOrderPaid, recordEventOnce } from '../../lib/db';
import { notify } from '../../lib/notify';

export const prerender = false;

/**
 * Razorpay webhook receiver (source of truth for payment status).
 * Configure in the Razorpay dashboard: Settings -> Webhooks
 *   URL:    https://apaulogy.com/api/razorpay-webhook
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, order.paid, payment.failed
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const signature = request.headers.get('x-razorpay-signature') || '';
  const raw = await request.text();

  const valid = await verifyWebhookSignature(env, raw, signature);
  if (!valid) {
    return new Response('invalid signature', { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // Idempotency: Razorpay may retry. `x-razorpay-event-id` is unique per event.
  const eventId = request.headers.get('x-razorpay-event-id') || `${event.event}-${Date.now()}`;
  const first = await recordEventOnce(env.DB, eventId, event.event, raw);
  if (!first) return new Response('duplicate', { status: 200 });

  try {
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    const razorpayOrderId = payment?.order_id || order?.id;
    const razorpayPaymentId = payment?.id;

    if ((event.event === 'payment.captured' || event.event === 'order.paid') && razorpayOrderId) {
      await markOrderPaid(env.DB, razorpayOrderId, razorpayPaymentId || '');
      try {
        const o: any = await env.DB.prepare(`SELECT * FROM orders WHERE razorpay_order_id=?`).bind(razorpayOrderId).first();
        if (o) { const bill = o.billing_json ? JSON.parse(o.billing_json) : {}; const items = ((await env.DB.prepare(`SELECT name,price,quantity FROM order_items WHERE order_number=?`).bind(o.order_number).all()).results)||[]; await notify(env, 'order_confirmation', { order_number:o.order_number, email:o.email, phone:o.phone, name:bill.name, items, subtotal:o.subtotal, shipping:o.shipping, total:o.total }); }
      } catch (e) { console.error('notify failed', e); }
    } else if (event.event === 'payment.failed' && razorpayOrderId) {
      await env.DB.prepare(
        `UPDATE orders SET status='failed', updated_at=datetime('now')
         WHERE razorpay_order_id=? AND status='pending'`,
      ).bind(razorpayOrderId).run();
    }
  } catch (err) {
    console.error('webhook processing error', err);
    // Return 200 so Razorpay doesn't hammer retries; event is logged for replay.
  }

  return new Response('ok', { status: 200 });
};

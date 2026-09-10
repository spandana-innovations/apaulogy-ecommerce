import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../lib/razorpay';
import { markOrderPaid, recordEventOnce } from '../../lib/db';
import { razorpayWebhookSecret } from '../../lib/payments';
import { sendOrderEmail, orderEmailData } from '../../lib/email';

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

  // Webhook secret may live in env or admin Settings.
  const secret = await razorpayWebhookSecret(env);
  const valid = await verifyWebhookSignature({ ...env, RAZORPAY_WEBHOOK_SECRET: secret }, raw, signature);
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
      const newlyPaid = await markOrderPaid(env.DB, razorpayOrderId, razorpayPaymentId || '');
      if (newlyPaid) {
        try {
          const o: any = await env.DB.prepare(`SELECT order_number FROM orders WHERE razorpay_order_id=?`).bind(razorpayOrderId).first();
          if (o?.order_number) {
            const data = await orderEmailData(env, o.order_number);
            if (data) await sendOrderEmail(env, 'order_confirmation', data);
          }
        } catch {}
      }
    } else if (event.event === 'payment.failed' && razorpayOrderId) {
      const res = await env.DB.prepare(
        `UPDATE orders SET status='failed', updated_at=datetime('now')
         WHERE razorpay_order_id=? AND status='pending'`,
      ).bind(razorpayOrderId).run();
      if ((res?.meta?.changes ?? 0) > 0) {
        try {
          const o: any = await env.DB.prepare(`SELECT order_number FROM orders WHERE razorpay_order_id=?`).bind(razorpayOrderId).first();
          if (o?.order_number) {
            const data = await orderEmailData(env, o.order_number);
            if (data) await sendOrderEmail(env, 'payment_failed', data);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('webhook processing error', err);
    // Return 200 so Razorpay doesn't hammer retries; event is logged for replay.
  }

  return new Response('ok', { status: 200 });
};

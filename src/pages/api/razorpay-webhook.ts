import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../lib/razorpay';
import { markOrderPaid, recordEventOnce } from '../../lib/db';

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

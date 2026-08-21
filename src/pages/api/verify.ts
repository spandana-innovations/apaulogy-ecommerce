import type { APIRoute } from 'astro';
import { verifyPaymentSignature } from '../../lib/razorpay';
import { markOrderPaid } from '../../lib/db';

export const prerender = false;

/**
 * Fast-path verification from the browser handler. The Razorpay webhook is the
 * source of truth, but confirming here lets us show the customer a paid state
 * immediately.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  const valid = await verifyPaymentSignature(
    env,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid signature' }), { status: 400 });
  }

  await markOrderPaid(env.DB, razorpay_order_id, razorpay_payment_id);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

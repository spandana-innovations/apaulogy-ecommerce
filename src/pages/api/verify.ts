import type { APIRoute } from 'astro';
import { verifyPaymentSignature } from '../../lib/razorpay';
import { markOrderPaid } from '../../lib/db';
import { razorpayKeys } from '../../lib/payments';
import { sendOrderEmail, orderEmailData } from '../../lib/email';

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

  // Verify against the secret for the active payment mode (test/live). The key
  // may live in env or in admin Settings, so resolve it the same way checkout does.
  const rk = await razorpayKeys(env);
  const verifyEnv = { ...env, RAZORPAY_KEY_SECRET: rk.keySecret || env.RAZORPAY_KEY_SECRET };
  const valid = await verifyPaymentSignature(
    verifyEnv,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid signature' }), { status: 400 });
  }

  const newlyPaid = await markOrderPaid(env.DB, razorpay_order_id, razorpay_payment_id);

  // Confirmation email — only on the real pending→paid transition, so the
  // webhook and this fast path never both email. Best-effort; never blocks.
  if (newlyPaid) {
    try {
      const o: any = await env.DB?.prepare(`SELECT order_number FROM orders WHERE razorpay_order_id=?`).bind(razorpay_order_id).first();
      if (o?.order_number) {
        const data = await orderEmailData(env, o.order_number);
        if (data) await sendOrderEmail(env, 'order_confirmation', data);
      }
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

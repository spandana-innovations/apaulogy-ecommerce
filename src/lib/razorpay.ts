/**
 * Razorpay integration using the REST API + Web Crypto only — no Node SDK,
 * so it runs on the Cloudflare edge runtime.
 *
 * Flow:
 *  1. Browser posts the cart to /api/checkout -> we create a Razorpay Order
 *     (server-side, using the key secret) and persist a pending order in D1.
 *  2. Browser opens Razorpay Checkout with the returned order_id.
 *  3. On success Razorpay calls our webhook -> we verify the signature and
 *     mark the order paid. (We also verify the handler signature client-return
 *     as a fast path.)
 */

const RZP_API = 'https://api.razorpay.com/v1';

interface Env {
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
}

/** Create a Razorpay order. `amount` is in paise. */
export async function createRazorpayOrder(
  env: Env,
  amount: number,
  receipt: string,
  notes: Record<string, string> = {},
): Promise<{ id: string; amount: number; currency: string }> {
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const res = await fetch(`${RZP_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt,
      notes,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time-ish comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Verify the checkout success signature returned to the browser. */
export async function verifyPaymentSignature(
  env: Env,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(
    env.RAZORPAY_KEY_SECRET,
    `${orderId}|${paymentId}`,
  );
  return safeEqual(expected, signature);
}

/** Verify a Razorpay webhook body against the X-Razorpay-Signature header. */
export async function verifyWebhookSignature(
  env: Env,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  return safeEqual(expected, signature);
}

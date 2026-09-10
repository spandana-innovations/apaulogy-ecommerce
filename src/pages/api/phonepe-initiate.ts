import type { APIRoute } from 'astro';
import { phonepeConfig, sha256hex } from '../../lib/payments';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const cfg = await phonepeConfig(env);
  if (!cfg.merchantId || !cfg.saltKey) {
    return json({ error: 'PhonePe is not configured.' }, 503);
  }
  let b: any = {}; try { b = await request.json(); } catch {}
  const amount = Math.round(Number(b.amount) || 0);        // paise
  if (amount <= 0) return json({ error: 'Invalid amount.' }, 400);

  const origin = env.SITE_URL || new URL(request.url).origin;
  const merchantTxnId = 'APG' + Date.now() + Math.random().toString(36).slice(2, 7);
  const payload = {
    merchantId: cfg.merchantId,
    merchantTransactionId: merchantTxnId,
    merchantUserId: (b.email || 'guest').slice(0, 36).replace(/[^a-zA-Z0-9_]/g, '_'),
    amount,
    redirectUrl: `${origin}/api/phonepe-callback?txn=${merchantTxnId}`,
    redirectMode: 'REDIRECT',
    callbackUrl: `${origin}/api/phonepe-callback?txn=${merchantTxnId}`,
    mobileNumber: (b.phone || '').replace(/\D/g, '').slice(-10),
    paymentInstrument: { type: 'PAY_PAGE' },
  };
  const base64 = btoa(JSON.stringify(payload));
  const path = '/pg/v1/pay';
  const xVerify = (await sha256hex(base64 + path + cfg.saltKey)) + '###' + cfg.saltIndex;

  try {
    const r = await fetch(cfg.host + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerify, accept: 'application/json' },
      body: JSON.stringify({ request: base64 }),
    });
    const d: any = await r.json();
    const url = d?.data?.instrumentResponse?.redirectInfo?.url;
    if (d?.success && url) return json({ ok: true, redirect: url, txn: merchantTxnId });
    return json({ error: d?.message || 'PhonePe initiation failed.', detail: d }, 502);
  } catch (e: any) {
    return json({ error: 'Could not reach PhonePe: ' + (e?.message || e) }, 502);
  }
};
function json(o: any, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }

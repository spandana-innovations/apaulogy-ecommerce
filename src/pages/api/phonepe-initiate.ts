import type { APIRoute } from 'astro';
import { phonepeConfig, phonepeToken } from '../../lib/payments';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const cfg = await phonepeConfig(env);
  if (!cfg.clientId || !cfg.clientSecret) {
    return json({ error: 'PhonePe is not configured (client id/secret missing).' }, 503);
  }
  let b: any = {}; try { b = await request.json(); } catch {}
  const amount = Math.round(Number(b.amount) || 0);      // paise
  if (amount < 100) return json({ error: 'Invalid amount.' }, 400);

  const origin = env.SITE_URL || new URL(request.url).origin;
  const merchantOrderId = 'APG' + Date.now() + Math.random().toString(36).slice(2, 7);

  const payload = {
    merchantOrderId,
    amount,
    expireAfter: 1200,
    paymentFlow: {
      type: 'PG_CHECKOUT',
      merchantUrls: { redirectUrl: `${origin}/api/phonepe-callback?order=${merchantOrderId}` },
    },
    metaInfo: {
      udf1: (b.email || '').slice(0, 256),
      udf2: (b.phone || '').slice(0, 256),
    },
  };

  try {
    const token = await phonepeToken(env, cfg);
    const r = await fetch(cfg.payHost + '/checkout/v2/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${token}`,
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const d: any = await r.json();
    if (r.ok && d?.redirectUrl) {
      return json({ ok: true, redirect: d.redirectUrl, order: merchantOrderId, orderId: d.orderId });
    }
    return json({ error: d?.message || d?.code || 'PhonePe initiation failed.', detail: d }, 502);
  } catch (e: any) {
    return json({ error: 'Could not reach PhonePe: ' + (e?.message || e) }, 502);
  }
};
function json(o: any, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }

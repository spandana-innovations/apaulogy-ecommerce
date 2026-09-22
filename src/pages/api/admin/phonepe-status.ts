import type { APIRoute } from 'astro';
import { phonepeConfig, phonepeToken } from '../../../lib/payments';
import { markPhonePePaid } from '../../../lib/db';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.order) return json({ ok: false, error: 'No order.' });
  if (!env.DB) return json({ ok: false, error: 'No database.' });

  // find the phonepe_order_id for this order number
  let ppId = '';
  try { const row: any = await env.DB.prepare(`SELECT phonepe_order_id FROM orders WHERE order_number=?`).bind(b.order).first(); ppId = row?.phonepe_order_id || ''; } catch {}
  if (!ppId) return json({ ok: false, error: 'This order has no PhonePe reference.' });

  const cfg = await phonepeConfig(env);
  if (!cfg.clientId) return json({ ok: false, error: 'PhonePe not configured.' });
  try {
    const token = await phonepeToken(env, cfg);
    const r = await fetch(`${cfg.payHost}/checkout/v2/order/${encodeURIComponent(ppId)}/status`, {
      method: 'GET', headers: { Authorization: `O-Bearer ${token}`, accept: 'application/json' },
    });
    const d: any = await r.json();
    const state = d?.state || d?.payload?.state || 'UNKNOWN';
    if (state === 'COMPLETED') { try { await markPhonePePaid(env.DB, ppId, 'paid'); } catch {} }
    else if (state && state !== 'PENDING') { try { await markPhonePePaid(env.DB, ppId, 'failed'); } catch {} }
    return json({ ok: true, state, amount: d?.amount });
  } catch (e: any) {
    return json({ ok: false, error: 'PhonePe: ' + (e?.message || e) });
  }
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

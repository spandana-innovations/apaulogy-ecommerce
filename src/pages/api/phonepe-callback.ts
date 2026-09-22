import type { APIRoute } from 'astro';
import { phonepeConfig, phonepeToken } from '../../lib/payments';
import { markPhonePePaid } from '../../lib/db';
export const prerender = false;

async function handle(request: Request, env: any) {
  const cfg = await phonepeConfig(env);
  const url = new URL(request.url);
  const merchantOrderId = url.searchParams.get('order') || '';
  const origin = env.SITE_URL || url.origin;
  if (!merchantOrderId || !cfg.clientId) return Response.redirect(`${origin}/checkout/?pp=error`, 302);

  try {
    const token = await phonepeToken(env, cfg);
    const r = await fetch(`${cfg.payHost}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`, {
      method: 'GET',
      headers: { Authorization: `O-Bearer ${token}`, accept: 'application/json' },
    });
    const d: any = await r.json();
    const state = d?.state || d?.payload?.state;
    if (r.ok && state === 'COMPLETED') {
      try { if (env.DB) await markPhonePePaid(env.DB, merchantOrderId, 'paid'); } catch {}
      return Response.redirect(`${origin}/order-confirmed/?ref=${encodeURIComponent(merchantOrderId)}&via=phonepe`, 302);
    }
    if (state === 'PENDING') {
      return Response.redirect(`${origin}/checkout/?pp=pending&order=${encodeURIComponent(merchantOrderId)}`, 302);
    }
    try { if (env.DB && state && state!=='PENDING') await markPhonePePaid(env.DB, merchantOrderId, 'failed'); } catch {}
    return Response.redirect(`${origin}/checkout/?pp=failed`, 302);
  } catch {
    return Response.redirect(`${origin}/checkout/?pp=error`, 302);
  }
}
export const GET: APIRoute = async ({ request, locals }) => handle(request, (locals as any)?.runtime?.env ?? {});
export const POST: APIRoute = async ({ request, locals }) => handle(request, (locals as any)?.runtime?.env ?? {});

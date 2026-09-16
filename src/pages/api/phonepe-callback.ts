import type { APIRoute } from 'astro';
import { phonepeConfig, sha256hex } from '../../lib/payments';
export const prerender = false;

async function handle(request: Request, env: any) {
  const cfg = await phonepeConfig(env);
  const url = new URL(request.url);
  const txn = url.searchParams.get('txn') || '';
  const origin = env.SITE_URL || url.origin;
  if (!txn || !cfg.merchantId) return Response.redirect(`${origin}/checkout/?pp=error`, 302);

  const path = `/pg/v1/status/${cfg.merchantId}/${txn}`;
  const xVerify = (await sha256hex(path + cfg.saltKey)) + '###' + cfg.saltIndex;
  try {
    const r = await fetch(cfg.host + path, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerify, 'X-MERCHANT-ID': cfg.merchantId, accept: 'application/json' },
    });
    const d: any = await r.json();
    const state = d?.data?.state || d?.code;
    if (d?.success && (state === 'COMPLETED' || d?.code === 'PAYMENT_SUCCESS')) {
      return Response.redirect(`${origin}/order-confirmed/?ref=${encodeURIComponent(txn)}&via=phonepe`, 302);
    }
    return Response.redirect(`${origin}/checkout/?pp=failed`, 302);
  } catch {
    return Response.redirect(`${origin}/checkout/?pp=error`, 302);
  }
}
export const GET: APIRoute = async ({ request, locals }) => handle(request, (locals as any)?.runtime?.env ?? {});
export const POST: APIRoute = async ({ request, locals }) => handle(request, (locals as any)?.runtime?.env ?? {});

import type { APIRoute } from 'astro';
import { getCoupon } from '../../lib/discounts';
export const prerender = false;
export const GET: APIRoute = async ({ url, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const code = url.searchParams.get('coupon') || '';
  const coupon = await getCoupon(env, code);
  return new Response(JSON.stringify({ ok: true, coupon: coupon ? { kind: coupon.kind, value: coupon.value, min_order: coupon.min_order } : null }),
    { headers: { 'Content-Type': 'application/json' } });
};

import type { APIRoute } from 'astro';
import { upsertDiscount, deleteDiscount, upsertCoupon, deleteCoupon } from '../../../lib/admin-data';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  let ok = false;
  if (b.type === 'discount') ok = b.delete ? await deleteDiscount(env, b.id) : await upsertDiscount(env, b);
  else if (b.type === 'coupon') ok = b.delete ? await deleteCoupon(env, b.code) : await upsertCoupon(env, b);
  return new Response(JSON.stringify({ ok }), { status: ok?200:500, headers:{'Content-Type':'application/json'} });
};

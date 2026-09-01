import type { APIRoute } from 'astro';
import { cartWeight, getRates, shippingFor } from '../../lib/shipping';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  const items = Array.isArray(b.items) ? b.items : [];
  const zone = b.zone === 'international' ? 'international' : 'domestic';
  const weight = cartWeight(items);
  const rates = await getRates(env, zone);
  const shipping = shippingFor(weight, rates);
  return new Response(JSON.stringify({ ok: true, weight: Math.round(weight * 100) / 100, shipping }),
    { headers: { 'Content-Type': 'application/json' } });
};

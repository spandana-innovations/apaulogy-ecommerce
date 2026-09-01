import type { APIRoute } from 'astro';
import { upsertProduct } from '../../../lib/admin-data';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.slug) return new Response(JSON.stringify({ ok:false }), { status:400 });
  const ok = await upsertProduct(env, b);
  return new Response(JSON.stringify({ ok }), { status: ok?200:500, headers:{'Content-Type':'application/json'} });
};

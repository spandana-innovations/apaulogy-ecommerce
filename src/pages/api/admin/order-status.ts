import type { APIRoute } from 'astro';
import { setOrderStatus } from '../../../lib/admin-data';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let body: { order?: string; status?: string } = {};
  try { body = await request.json(); } catch {}
  const allowed = ['pending', 'paid', 'shipped', 'fulfilled', 'cancelled'];
  if (!body.order || !allowed.includes(body.status || '')) {
    return new Response(JSON.stringify({ ok: false, error: 'bad request' }), { status: 400 });
  }
  const ok = await setOrderStatus(env, body.order, body.status!);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};

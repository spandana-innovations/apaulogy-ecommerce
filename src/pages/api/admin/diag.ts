import type { APIRoute } from 'astro';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const out: any = { hasRuntime: !!(locals as any)?.runtime, hasDB: !!env.DB, hasMEDIA: !!env.MEDIA, bindings: Object.keys(env) };
  if (env.DB) {
    try {
      const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first();
      out.orders = r?.n ?? null;
    } catch (e: any) { out.dbError = e.message; }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
};

import type { APIRoute } from 'astro';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const rt = (locals as any)?.runtime;
  const env = rt?.env ?? {};
  const out: any = { hasRuntime: !!rt, envKeys: Object.keys(env), hasDB: !!env.DB, hasMEDIA: !!env.MEDIA };
  if (env.DB) { try { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first(); out.orders = r?.n ?? null; } catch (e: any) { out.dbError = String(e?.message || e); } }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

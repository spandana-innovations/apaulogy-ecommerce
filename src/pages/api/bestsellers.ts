import type { APIRoute } from 'astro';
export const prerender = false;
let _cache: { at: number; ranks: Record<string, number> } | null = null;

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  if (_cache && Date.now() - _cache.at < 1800000) return json(_cache.ranks);
  const ranks: Record<string, number> = {};
  if (env.DB) {
    try {
      // rank by total units sold, matched by product name (order_items.name)
      const r: any = await env.DB.prepare(
        `SELECT name, SUM(quantity) qty FROM order_items
         JOIN orders o ON o.order_number = order_items.order_number
         WHERE o.status IN ('completed','processing','shipped','paid')
         GROUP BY name ORDER BY qty DESC LIMIT 50`).all();
      (r?.results || []).forEach((row: any, i: number) => { if (row.name) ranks[String(row.name).toLowerCase().trim()] = i + 1; });
    } catch {}
  }
  _cache = { at: Date.now(), ranks };
  return json(ranks);
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' } }); }

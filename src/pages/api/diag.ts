import type { APIRoute } from 'astro';
import { listOrders, listCustomers, statsSummary } from '../../lib/admin-data';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const out: any = { hasDB: !!env.DB };
  if (env.DB) {
    try { out.rawCount = (await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first())?.n ?? null; }
    catch (e: any) { out.rawErr = String(e?.message || e); }
    try {
      const r: any = await env.DB.prepare('SELECT order_number,email,status,total,created_at FROM orders ORDER BY created_at DESC LIMIT 2').all();
      out.rawRows = (r?.results || []).length;
    } catch (e: any) { out.rawRowsErr = String(e?.message || e); }
    try { const lo = await listOrders(env, {}); out.listOrders = { total: lo.total, rows: lo.rows.length }; }
    catch (e: any) { out.listOrdersErr = String(e?.message || e); }
    try { const lc = await listCustomers(env, {}); out.listCustomers = { total: lc.total, rows: lc.rows.length }; }
    catch (e: any) { out.listCustomersErr = String(e?.message || e); }
    try { out.stats = await statsSummary(env); } catch (e: any) { out.statsErr = String(e?.message || e); }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

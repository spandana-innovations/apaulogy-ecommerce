import type { APIRoute } from 'astro';
import { updateOrder, logOrderEvent, trashOrders, restoreOrders, purgeOrders } from '../../../lib/admin-data';
export const prerender = false;

const ALLOWED = ['pending','processing','on-hold','completed','shipped','cancelled','refunded','failed'];

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  const orders: string[] = Array.isArray(b.orders) ? b.orders.slice(0, 500) : [];
  if (!orders.length) return json({ ok: false, error: 'No orders selected.' }, 400);

  let done = 0, failed = 0;
  if (b.action === 'status' && ALLOWED.includes(b.status)) {
    for (const on of orders) {
      const ok = await updateOrder(env, on, { status: b.status });
      if (ok) { done++; try { await logOrderEvent(env, on, 'status', String(b.status)); } catch {} } else failed++;
    }
  } else if (b.action === 'trash') { done = await trashOrders(env, orders);
  } else if (b.action === 'restore') { done = await restoreOrders(env, orders);
  } else if (b.action === 'purge') { done = await purgeOrders(env, orders);
  } else {
    return json({ ok: false, error: 'Unknown action.' }, 400);
  }
  return json({ ok: true, done, failed });
};
function json(o: any, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }

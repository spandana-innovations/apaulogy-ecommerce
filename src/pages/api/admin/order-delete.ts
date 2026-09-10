import type { APIRoute } from 'astro';
import { trashOrder, restoreOrder, purgeOrder, logOrderEvent } from '../../../lib/admin-data';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.order) return json({ ok: false, error: 'no order' }, 400);
  const action = b.action || 'trash';
  let ok = false;
  if (action === 'trash') { ok = await trashOrder(env, b.order); if (ok) await logOrderEvent(env, b.order, 'deleted', 'moved to bin'); }
  else if (action === 'restore') { ok = await restoreOrder(env, b.order); if (ok) await logOrderEvent(env, b.order, 'restored', 'restored from bin'); }
  else if (action === 'purge') { ok = await purgeOrder(env, b.order); }
  else return json({ ok: false, error: 'bad action' }, 400);
  return json({ ok }, ok ? 200 : 500);
};

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
}

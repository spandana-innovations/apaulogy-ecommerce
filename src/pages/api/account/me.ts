import type { APIRoute } from 'astro';
import { readCustomerSession, readCookie, getCustomer, ensureCustomerAuth } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const sess = await readCustomerSession(readCookie(request), env);
  if (!sess) return j({ authed: false });

  let orders: any[] = [];
  let phone = '';
  let address: any = null;
  if (env.DB) {
    try { await ensureCustomerAuth(env.DB); } catch {}
    try {
      const c = await getCustomer(env.DB, sess.email);
      if (c) { phone = c.phone || ''; try { address = c.address_json ? JSON.parse(c.address_json) : null; } catch {} }
    } catch {}
    try {
      const r = await env.DB.prepare(
        `SELECT order_number, total, status, created_at FROM orders
         WHERE LOWER(email)=LOWER(?) AND (deleted_at IS NULL OR deleted_at='')
         ORDER BY created_at DESC LIMIT 20`).bind(sess.email).all();
      orders = (r.results || []).map((o: any) => ({ ref: o.order_number, total: o.total, status: o.status, date: o.created_at }));
    } catch {}
  }
  return j({ authed: true, name: sess.name, email: sess.email, phone, address, orders });
};

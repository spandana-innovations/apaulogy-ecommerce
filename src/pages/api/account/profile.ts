import type { APIRoute } from 'astro';
import { readCustomerSession, readCookie, ensureCustomerAuth, createCustomerSession, sessionCookie } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...headers } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const sess = await readCustomerSession(readCookie(request), env);
  if (!sess) return j({ ok: false, error: 'Please sign in.' }, 401);
  if (!env.DB) return j({ ok: false, error: 'Accounts are temporarily unavailable.' }, 503);

  let b: any = {}; try { b = await request.json(); } catch {}
  const name = String(b.name || sess.name || '').trim();
  const phone = String(b.phone || '').trim();
  const a = b.address || {};
  const address = {
    line1: String(a.line1 || '').trim(), line2: String(a.line2 || '').trim(),
    city: String(a.city || '').trim(), state: String(a.state || '').trim(),
    postcode: String(a.postcode || '').trim(), country: String(a.country || 'India').trim(),
  };
  const hasAddr = address.line1 || address.city || address.postcode;

  try {
    await ensureCustomerAuth(env.DB);
    await env.DB.prepare(`UPDATE customers SET name=?, phone=?, address_json=? WHERE LOWER(email)=LOWER(?)`)
      .bind(name, phone, hasAddr ? JSON.stringify(address) : null, sess.email).run();
  } catch { return j({ ok: false, error: 'Could not save your details. Please try again.' }, 500); }

  // Refresh the session so the header/name stays in sync.
  const token = await createCustomerSession(env, sess.email, name);
  return j({ ok: true, name, phone, address: hasAddr ? address : null }, 200, { 'Set-Cookie': sessionCookie(token) });
};

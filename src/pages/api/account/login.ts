import type { APIRoute } from 'astro';
import { ensureCustomerAuth, getCustomer, verifyPassword, createCustomerSession, sessionCookie } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  if (!env.DB) return j({ ok: false, error: 'Accounts are temporarily unavailable.' }, 503);
  let b: any = {}; try { b = await request.json(); } catch {}
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!email || !password) return j({ ok: false, error: 'Please enter your email and password.' }, 400);

  await ensureCustomerAuth(env.DB);
  const c = await getCustomer(env.DB, email);
  if (!c || !c.password_hash || !(await verifyPassword(password, c.password_hash, c.password_salt))) {
    return j({ ok: false, error: 'Invalid email or password.' }, 401);
  }
  const token = await createCustomerSession(env, email, c.name || '');
  return new Response(JSON.stringify({ ok: true, name: c.name || '', email }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) } });
};

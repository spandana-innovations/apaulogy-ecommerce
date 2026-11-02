import type { APIRoute } from 'astro';
import { ensureCustomerAuth, getCustomer, hashPassword, createCustomerSession, sessionCookie } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  if (!env.DB) return j({ ok: false, error: 'Accounts are temporarily unavailable.' }, 503);
  let b: any = {}; try { b = await request.json(); } catch {}
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name) return j({ ok: false, error: 'Please enter your name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ ok: false, error: 'Please enter a valid email.' }, 400);
  if (password.length < 8) return j({ ok: false, error: 'Password must be at least 8 characters.' }, 400);

  await ensureCustomerAuth(env.DB);
  const existing = await getCustomer(env.DB, email);
  if (existing && existing.password_hash) return j({ ok: false, error: 'An account with this email already exists. Please sign in.' }, 409);

  const { hash, salt } = await hashPassword(password);
  try {
    if (existing) {
      await env.DB.prepare(`UPDATE customers SET name=?, password_hash=?, password_salt=? WHERE LOWER(email)=LOWER(?)`).bind(name, hash, salt, email).run();
    } else {
      await env.DB.prepare(`INSERT INTO customers (email, name, password_hash, password_salt) VALUES (?, ?, ?, ?)`).bind(email, name, hash, salt).run();
    }
  } catch { return j({ ok: false, error: 'Could not create the account. Please try again.' }, 500); }

  const token = await createCustomerSession(env, email, name);
  return new Response(JSON.stringify({ ok: true, name, email }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) } });
};

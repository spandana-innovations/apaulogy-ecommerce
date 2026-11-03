import type { APIRoute } from 'astro';
import { ensureCustomerAuth, getCustomer, verifyResetToken, hashPassword, createCustomerSession, sessionCookie } from '../../../lib/customer-auth';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  if (!env.DB) return j({ ok: false, error: 'Accounts are temporarily unavailable.' }, 503);
  let b: any = {}; try { b = await request.json(); } catch {}
  const password = String(b.password || '');
  if (password.length < 8) return j({ ok: false, error: 'Password must be at least 8 characters.' }, 400);

  const parsed = await verifyResetToken(b.token, env);
  if (!parsed) return j({ ok: false, error: 'This reset link is invalid or has expired. Please request a new one.' }, 400);

  await ensureCustomerAuth(env.DB);
  const c = await getCustomer(env.DB, parsed.email);
  // Single-use: the token is bound to the password hash at request time.
  if (!c || !c.password_hash || c.password_hash.slice(0, 24) !== parsed.hashPrefix) {
    return j({ ok: false, error: 'This reset link has already been used. Please request a new one.' }, 400);
  }

  const { hash, salt } = await hashPassword(password);
  try {
    await env.DB.prepare(`UPDATE customers SET password_hash=?, password_salt=? WHERE LOWER(email)=LOWER(?)`).bind(hash, salt, parsed.email).run();
  } catch { return j({ ok: false, error: 'Could not update the password. Please try again.' }, 500); }

  const token = await createCustomerSession(env, parsed.email, c.name || '');
  return new Response(JSON.stringify({ ok: true, name: c.name || '', email: parsed.email }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) } });
};

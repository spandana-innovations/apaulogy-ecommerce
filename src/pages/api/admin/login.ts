import type { APIRoute } from 'astro';
import { checkCredentials, createSession, sessionCookie, roleHintCookie } from '../../../lib/admin-auth';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let body: any = {};
  try { body = await request.json(); } catch {}

  // Human check: slide-to-verify (non-image). A light friction step for the login form.
  if (body.verified !== '1') {
    return new Response(JSON.stringify({ ok: false, error: 'Please complete the slider to verify.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = (body.user || '').trim();
  const pass = body.pass || '';

  // Admin credentials -> admin session, routed to the dashboard.
  if (checkCredentials(user, pass, env)) {
    const token = await createSession(env);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookie(token));
    headers.append('Set-Cookie', roleHintCookie());
    return new Response(JSON.stringify({ ok: true, role: 'admin', redirect: '/apaulogy-admin/' }), { status: 200, headers });
  }

  // Not an admin. (Customer accounts are not enabled yet; treat as invalid.)
  return new Response(JSON.stringify({ ok: false, error: 'Incorrect username or password.' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
};

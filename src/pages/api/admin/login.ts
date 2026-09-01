import type { APIRoute } from 'astro';
import { checkCredentials, createSession, sessionCookie } from '../../../lib/admin-auth';
import { verifyCaptcha } from '../../../lib/captcha';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let body: any = {};
  try { body = await request.json(); } catch {}

  // Non-text captcha (Paul's artwork) must pass first.
  const capOk = await verifyCaptcha(env, Number(body.cap_choice), body.cap_nonce, Number(body.cap_exp), body.cap_sig);
  if (!capOk) {
    return new Response(JSON.stringify({ ok: false, captcha: true, error: 'Please pick the correct artwork and try again.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (!checkCredentials(body.user || '', body.pass || '', env)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid username or password.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const token = await createSession(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) },
  });
};

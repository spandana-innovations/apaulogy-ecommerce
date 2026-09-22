import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let email = '';
  try {
    email = (await request.json()).email;
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), { status: 400 });
  }
  try {
    await env.DB.prepare(
      `INSERT INTO subscribers (email) VALUES (?) ON CONFLICT(email) DO NOTHING`,
    ).bind(email.toLowerCase()).run();
  } catch (err) {
    console.error('subscribe error', err);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

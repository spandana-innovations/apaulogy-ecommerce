import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let data: { name?: string; email?: string; message?: string };
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  if (!data.email || !data.message) {
    return new Response(JSON.stringify({ ok: false, error: 'missing fields' }), { status: 400 });
  }
  try {
    await env.DB.prepare(
      `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`,
    ).bind(data.name ?? null, data.email, data.message).run();
  } catch (err) {
    console.error('contact error', err);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

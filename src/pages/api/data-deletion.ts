import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals?.runtime?.env ?? ({} as Record<string, any>);
  let body: Record<string, string> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  const email = (body.email || '').toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), { status: 400 });
  }
  const reference = body.reference || `DEL-${Date.now().toString(36).toUpperCase()}`;
  // Best-effort log; the table may not exist until the backend is wired up.
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO data_requests (reference, name, email, phone, scope, details, created)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).bind(reference, body.name || '', email, body.phone || '', body.scope || 'delete-all', body.details || '').run();
    } catch (err) {
      console.error('data-deletion log failed', err);
    }
  }
  return new Response(JSON.stringify({ ok: true, reference }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

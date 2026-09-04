import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  if (!env.DB) return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  let b: any = {}; try { b = await request.json(); } catch {}
  const path = (b.path || '').slice(0, 300);
  if (!path || path.startsWith('/apaulogy-admin') || path.startsWith('/api/')) return new Response('{}');
  const ua = request.headers.get('user-agent') || '';
  const device = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  try {
    await env.DB.prepare(`INSERT INTO pageviews (path, referrer, session, device) VALUES (?,?,?,?)`)
      .bind(path, (b.referrer || '').slice(0, 300), (b.session || '').slice(0, 40), device).run();
  } catch {}
  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
};

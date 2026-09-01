import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return new Response(JSON.stringify({ ok:false, error:'no file' }), { status:400 });
  const ext = (file.type === 'image/webp') ? 'webp' : (file.name.split('.').pop() || 'webp');
  const key = `uploads/admin/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  if (!env.MEDIA) {
    return new Response(JSON.stringify({ ok:false, error:'R2 bucket (MEDIA) not bound. Configure it in wrangler.toml to enable uploads.' }), { status:503 });
  }
  try {
    await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'image/webp' } });
    const base = env.MEDIA_BASE_URL || '';
    const url = base ? `${base}/${key}` : `/${key}`;
    return new Response(JSON.stringify({ ok:true, url, key }), { headers:{'Content-Type':'application/json'} });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e.message || 'upload failed' }), { status:500 });
  }
};

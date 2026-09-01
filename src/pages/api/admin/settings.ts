import type { APIRoute } from 'astro';
import { setSetting } from '../../../lib/admin-data';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!env.DB) return new Response(JSON.stringify({ ok:false, error:'no db' }), { status:503 });
  try {
    if (typeof b.razorpay_key_id === 'string' && b.razorpay_key_id) await setSetting(env, 'razorpay_key_id', b.razorpay_key_id);
    if (b.razorpay_key_secret) await setSetting(env, 'razorpay_key_secret', b.razorpay_key_secret);
    if (b.razorpay_webhook_secret) await setSetting(env, 'razorpay_webhook_secret', b.razorpay_webhook_secret);
    return new Response(JSON.stringify({ ok:true }), { headers:{'Content-Type':'application/json'} });
  } catch (e:any) { return new Response(JSON.stringify({ ok:false, error:e.message }), { status:500 }); }
};

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
    if (typeof b.phonepe_client_id === 'string' && b.phonepe_client_id) await setSetting(env, 'phonepe_client_id', b.phonepe_client_id);
    if (b.phonepe_client_secret) await setSetting(env, 'phonepe_client_secret', b.phonepe_client_secret);
    if (typeof b.phonepe_client_version === 'string' && b.phonepe_client_version) await setSetting(env, 'phonepe_client_version', b.phonepe_client_version);
    if (typeof b.phonepe_test_client_id === 'string' && b.phonepe_test_client_id) await setSetting(env, 'phonepe_test_client_id', b.phonepe_test_client_id);
    if (b.phonepe_test_client_secret) await setSetting(env, 'phonepe_test_client_secret', b.phonepe_test_client_secret);
    if (typeof b.phonepe_test_client_version === 'string' && b.phonepe_test_client_version) await setSetting(env, 'phonepe_test_client_version', b.phonepe_test_client_version);
    if (typeof b.phonepe_merchant_id === 'string' && b.phonepe_merchant_id) await setSetting(env, 'phonepe_merchant_id', b.phonepe_merchant_id);
    if (b.phonepe_salt_key) await setSetting(env, 'phonepe_salt_key', b.phonepe_salt_key);
    if (typeof b.phonepe_salt_index === 'string' && b.phonepe_salt_index) await setSetting(env, 'phonepe_salt_index', b.phonepe_salt_index);
    if (b.resend_key) await setSetting(env, 'resend_key', b.resend_key);
    if (typeof b.from_email === 'string' && b.from_email) await setSetting(env, 'from_email', b.from_email);
    if (typeof b.site_mode === 'string' && ['production','construction','paused'].includes(b.site_mode)) await setSetting(env, 'site_mode', b.site_mode);
    if (typeof b.payment_mode === 'string' && ['test','live'].includes(b.payment_mode)) await setSetting(env, 'payment_mode', b.payment_mode);
    if (typeof b.razorpay_test_key_id === 'string' && b.razorpay_test_key_id) await setSetting(env, 'razorpay_test_key_id', b.razorpay_test_key_id);
    if (b.razorpay_test_key_secret) await setSetting(env, 'razorpay_test_key_secret', b.razorpay_test_key_secret);
    if (typeof b.phonepe_test_merchant_id === 'string' && b.phonepe_test_merchant_id) await setSetting(env, 'phonepe_test_merchant_id', b.phonepe_test_merchant_id);
    if (b.phonepe_test_salt_key) await setSetting(env, 'phonepe_test_salt_key', b.phonepe_test_salt_key);
    if (typeof b.phonepe_test_salt_index === 'string' && b.phonepe_test_salt_index) await setSetting(env, 'phonepe_test_salt_index', b.phonepe_test_salt_index);
    return new Response(JSON.stringify({ ok:true }), { headers:{'Content-Type':'application/json'} });
  } catch (e:any) { return new Response(JSON.stringify({ ok:false, error:e.message }), { status:500 }); }
};

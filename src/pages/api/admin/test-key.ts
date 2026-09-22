import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  let b: any = {}; try { b = await request.json(); } catch {}
  const provider = b.provider;
  try {
    if (provider === 'razorpay') {
      if (!b.key_id || !b.key_secret) return json({ ok: false, error: 'Enter both Key ID and Secret.' });
      const auth = 'Basic ' + btoa(`${b.key_id}:${b.key_secret}`);
      const r = await fetch('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: auth } });
      if (r.ok) return json({ ok: true, message: 'Razorpay keys are valid.' });
      if (r.status === 401) return json({ ok: false, error: 'Invalid Razorpay key or secret.' });
      return json({ ok: false, error: `Razorpay returned ${r.status}.` });
    }
    if (provider === 'resend') {
      if (!b.resend_key) return json({ ok: false, error: 'Enter the Resend API key.' });
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${b.resend_key}` } });
      if (r.ok) return json({ ok: true, message: 'Resend key is valid.' });
      if (r.status === 401 || r.status === 403) return json({ ok: false, error: 'Invalid Resend API key.' });
      return json({ ok: false, error: `Resend returned ${r.status}.` });
    }
    if (provider === 'phonepe') {
      if (!b.client_id || !b.client_secret) return json({ ok: false, error: 'Enter Client ID and Secret.' });
      // Sandbox OAuth token check (safe, no charge).
      try {
        const body = new URLSearchParams({ client_id: b.client_id, client_version: String(b.client_version || '1'), client_secret: b.client_secret, grant_type: 'client_credentials' });
        const r = await fetch('https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        const d: any = await r.json();
        if (r.ok && d.access_token) return json({ ok: true, message: 'PhonePe credentials valid (sandbox token issued).' });
        return json({ ok: false, error: d.message || d.code || 'PhonePe auth failed — check Client ID/Secret.' });
      } catch (e: any) { return json({ ok: false, error: 'Could not reach PhonePe: ' + (e?.message || e) }); }
    }
    return json({ ok: false, error: 'Unknown provider.' });
  } catch (e: any) {
    return json({ ok: false, error: 'Could not reach the provider: ' + (e?.message || e) });
  }
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

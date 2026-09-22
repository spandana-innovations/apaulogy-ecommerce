import type { APIRoute } from 'astro';
import { getSetting, setSetting } from '../../../lib/admin-data';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  const provider = b.provider;
  try {
    if (provider === 'razorpay') {
      b.key_id = b.key_id || (await getSetting(env, 'razorpay_key_id')) || '';
      b.key_secret = b.key_secret || (await getSetting(env, 'razorpay_key_secret')) || '';
      if (!b.key_id || !b.key_secret) return json({ ok: false, error: 'Enter both Key ID and Secret (or save them first).' });
      const auth = 'Basic ' + btoa(`${b.key_id}:${b.key_secret}`);
      const r = await fetch('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: auth } });
      if (r.ok) { await setSetting(env, 'razorpay_verified', '1'); return json({ ok: true, message: 'Razorpay keys are valid.' }); }
      if (r.status === 401) return json({ ok: false, error: 'Invalid Razorpay key or secret.' });
      return json({ ok: false, error: `Razorpay returned ${r.status}.` });
    }
    if (provider === 'resend') {
      b.resend_key = b.resend_key || (await getSetting(env, 'resend_key')) || '';
      if (!b.resend_key) return json({ ok: false, error: 'Enter the Resend API key (or save it first).' });
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${b.resend_key}` } });
      if (r.ok) { await setSetting(env, 'resend_verified', '1'); return json({ ok: true, message: 'Resend key is valid.' }); }
      if (r.status === 401 || r.status === 403) return json({ ok: false, error: 'Invalid Resend API key.' });
      return json({ ok: false, error: `Resend returned ${r.status}.` });
    }
    if (provider === 'phonepe') {
      const cid = b.client_id || (await getSetting(env, 'phonepe_client_id')) || '';
      const csec = b.client_secret || (await getSetting(env, 'phonepe_client_secret')) || '';
      const cver = b.client_version || (await getSetting(env, 'phonepe_client_version')) || '1';
      if (!cid || !csec) return json({ ok: false, error: 'Enter Client ID and Secret (or save them first).' });
      b.client_id = cid; b.client_secret = csec; b.client_version = cver;
      const params = () => new URLSearchParams({ client_id: b.client_id, client_version: String(b.client_version || '1'), client_secret: b.client_secret, grant_type: 'client_credentials' });
      const hosts = [
        { name: 'live', url: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token' },
        { name: 'sandbox', url: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' },
      ];
      let lastErr = '';
      for (const h of hosts) {
        try {
          const r = await fetch(h.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: params().toString() });
          const d: any = await r.json().catch(() => ({}));
          if (r.ok && d.access_token) { if (h.name==='live') await setSetting(env, 'phonepe_verified', '1'); return json({ ok: true, message: `PhonePe credentials valid (${h.name} — token issued).` }); }
          lastErr = d.message || d.code || `HTTP ${r.status}`;
        } catch (e: any) { lastErr = String(e?.message || e); }
      }
      return json({ ok: false, error: 'PhonePe auth failed on both live & sandbox: ' + lastErr + '. Check the keys are V2 (client id/secret from Developer Settings), not old salt keys.' });
    }
    return json({ ok: false, error: 'Unknown provider.' });
  } catch (e: any) {
    return json({ ok: false, error: 'Could not reach the provider: ' + (e?.message || e) });
  }
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

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
      if (!b.merchant_id || !b.salt_key) return json({ ok: false, error: 'Enter Merchant ID and Salt Key.' });
      // PhonePe has no simple ping; validate format (real verification happens on first live payment).
      const okFmt = /^[A-Za-z0-9_-]{4,}$/.test(b.merchant_id) && b.salt_key.length >= 8;
      return okFmt ? json({ ok: true, message: 'PhonePe details look valid (verified on first payment).' })
                   : json({ ok: false, error: 'Merchant ID / Salt Key format looks off.' });
    }
    return json({ ok: false, error: 'Unknown provider.' });
  } catch (e: any) {
    return json({ ok: false, error: 'Could not reach the provider: ' + (e?.message || e) });
  }
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

import type { APIRoute } from 'astro';
import { sendEmail, renderTemplate, emailConfig } from '../../../lib/email';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.to) return json({ ok: false, error: 'No recipient.' });
  const cfg = await emailConfig(env);
  const sample = { order_number: 'APG-TEST', name: 'Test Customer',
    items: [{ name: 'Coastline', quantity: 1, price: 280000 }], subtotal: 280000, shipping: 8500, total: 288500,
    tracking_number: 'EX123456789IN', tracking_carrier: 'DTDC' };
  const t = renderTemplate(b.template || 'order_confirmation', cfg.site, sample);
  const r = await sendEmail(env, b.to, '[TEST] ' + t.subject, t.html);
  return json(r);
};
function json(o: any) { return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); }

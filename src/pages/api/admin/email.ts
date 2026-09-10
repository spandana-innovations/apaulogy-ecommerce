import type { APIRoute } from 'astro';
import { renderEmail, sampleOrder, sendEmail, orderEmailData, EMAIL_TYPES, type EmailType } from '../../../lib/email';

export const prerender = false;

const isType = (t: any): t is EmailType => EMAIL_TYPES.some((e) => e.id === t);

/** GET — render a preview of one email type (real order if `order` resolves, else sample). */
export const GET: APIRoute = async ({ url, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const type = url.searchParams.get('type') || 'order_confirmation';
  if (!isType(type)) return new Response('Unknown email type', { status: 400 });
  const orderNum = url.searchParams.get('order') || '';
  const data = (orderNum && (await orderEmailData(env, orderNum))) || sampleOrder();
  const { html } = renderEmail(type, data);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
};

/** POST — send a test of one email type to the given address. */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  const type = b.type;
  if (!isType(type)) return json({ ok: false, error: 'Unknown email type' }, 400);
  const to = String(b.to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ ok: false, error: 'Enter a valid recipient email' }, 400);
  const data = (b.order && (await orderEmailData(env, String(b.order)))) || sampleOrder();
  const { subject, html } = renderEmail(type, data);
  const r = await sendEmail(env, to, `[TEST] ${subject}`, html);
  if (r.ok) return json({ ok: true, id: r.id });
  return json({ ok: false, error: r.skipped ? 'No Resend key configured — add one above and save first.' : r.error }, r.skipped ? 400 : 502);
};

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
}

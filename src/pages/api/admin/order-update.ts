import type { APIRoute } from 'astro';
import { updateOrder, logOrderEvent } from '../../../lib/admin-data';
import { sendOrderEmail, orderEmailData, type EmailType } from '../../../lib/email';
export const prerender = false;

// Which customer email (if any) a status change should trigger.
const STATUS_EMAIL: Record<string, EmailType> = {
  shipped: 'order_shipped',
  cancelled: 'order_cancelled',
  refunded: 'order_refunded',
};
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!b.order) return new Response(JSON.stringify({ ok:false }), { status:400 });
  const fields: Record<string,any> = {};
  const allowed = ['pending','processing','on-hold','completed','shipped','cancelled','refunded','failed'];
  if (b.status && allowed.includes(b.status)) fields.status = b.status;
  if (typeof b.tracking_number === 'string') fields.tracking_number = b.tracking_number;
  if (typeof b.tracking_carrier === 'string') fields.tracking_carrier = b.tracking_carrier;
  const ok = await updateOrder(env, b.order, fields);
  let emailed: string | undefined;
  if (ok) {
    if (fields.status) await logOrderEvent(env, b.order, 'status', String(fields.status));
    if (fields.tracking_number) await logOrderEvent(env, b.order, 'tracking', `${fields.tracking_carrier || ''} ${fields.tracking_number}`.trim());
    // Notify the customer on meaningful status changes (best-effort). `notify:false`
    // from the admin UI suppresses it. Skipped silently when no Resend key is set.
    const type = fields.status ? STATUS_EMAIL[fields.status] : undefined;
    if (type && b.notify !== false) {
      try {
        const data = await orderEmailData(env, b.order);
        if (data) { const r = await sendOrderEmail(env, type, data); if (r.ok) emailed = type; }
      } catch {}
    }
  }
  return new Response(JSON.stringify({ ok, emailed }), { status: ok?200:500, headers:{'Content-Type':'application/json'} });
};

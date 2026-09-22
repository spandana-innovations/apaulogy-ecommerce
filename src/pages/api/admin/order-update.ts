import type { APIRoute } from 'astro';
import { updateOrder, logOrderEvent, getOrder } from '../../../lib/admin-data';
import { sendEmail, shippingUpdateEmail, emailConfig } from '../../../lib/email';
export const prerender = false;
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
  if (ok) {
    if (fields.status) await logOrderEvent(env, b.order, 'status', String(fields.status));
    if (fields.tracking_number) {
      await logOrderEvent(env, b.order, 'tracking', `${fields.tracking_carrier || ''} ${fields.tracking_number}`.trim());
      try {
        const o: any = await getOrder(env, b.order);
        const bill = o?.billing_json ? JSON.parse(o.billing_json) : {};
        if (o?.email) { const cfg = await emailConfig(env); const t = shippingUpdateEmail(cfg.site, { order_number: b.order, name: bill.name, tracking_number: fields.tracking_number, tracking_carrier: fields.tracking_carrier }); await sendEmail(env, o.email, t.subject, t.html); }
      } catch {}
    }
  }
  return new Response(JSON.stringify({ ok }), { status: ok?200:500, headers:{'Content-Type':'application/json'} });
};

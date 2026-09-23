import { getSetting, setSetting } from './admin-data';
import { sendEmail, orderConfirmationEmail, shippingUpdateEmail, emailConfig } from './email';
type Env = Record<string, any>;

/* ------------------------------------------------------------------ *
 * Notifications: Email (Resend), SMS (MSG91), WhatsApp (MSG91/Meta).
 * Each event (order_confirmation, shipping_update) can be enabled per
 * channel from Settings → Notifications.
 * ------------------------------------------------------------------ */

export const CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export const EVENTS = ['order_confirmation', 'shipping_update'] as const;

export async function eventEnabled(env: Env, event: string) {
  const v = await getSetting(env, `notify_evt_${event}`);
  return v !== '0'; // default on
}

export async function notifyConfig(env: Env) {
  const g = (k: string) => getSetting(env, k);
  return {
    email: { enabled: (await g('notify_email_enabled')) !== '0', key: env.RESEND_KEY || (await g('resend_key')) || '', admin: (await g('admin_notify_email')) || 'apaulogygallery@gmail.com', adminOn: (await g('admin_notify_enabled')) !== '0' },
    sms: {
      enabled: (await g('notify_sms_enabled')) === '1',
      authkey: env.MSG91_AUTHKEY || (await g('msg91_authkey')) || '',
      sender: (await g('msg91_sender_id')) || '',
      tplOrder: (await g('msg91_tpl_order')) || '',
      tplShipping: (await g('msg91_tpl_shipping')) || '',
    },
    whatsapp: {
      enabled: (await g('notify_wa_enabled')) === '1',
      authkey: env.MSG91_AUTHKEY || (await g('msg91_authkey')) || '',
      number: (await g('wa_integrated_number')) || '',
      tplOrder: (await g('wa_tpl_order')) || '',
      tplShipping: (await g('wa_tpl_shipping')) || '',
    },
  };
}

/* ---- SMS via MSG91 Flow API (v5). DLT-registered template required. ---- */
export async function sendSMS(env: Env, mobile: string, templateId: string, vars: Record<string, string>) {
  const cfg = (await notifyConfig(env)).sms;
  if (!cfg.authkey) return { ok: false, error: 'MSG91 auth key not set.' };
  if (!templateId) return { ok: false, error: 'No DLT template id for this event.' };
  const m = mobile.replace(/\D/g, '');
  const mobiles = m.length === 10 ? '91' + m : m;
  try {
    const r = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: cfg.authkey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles, ...vars }] }),
    });
    const d: any = await r.json().catch(() => ({}));
    if (r.ok && (d?.type === 'success' || d?.message)) return { ok: true, id: d?.request_id || '' };
    return { ok: false, error: d?.message || `MSG91 error ${r.status}` };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

/* ---- WhatsApp via MSG91 (v5). Requires an approved template + integrated number. ---- */
export async function sendWhatsApp(env: Env, mobile: string, templateName: string, components: string[]) {
  const cfg = (await notifyConfig(env)).whatsapp;
  if (!cfg.authkey || !cfg.number) return { ok: false, error: 'WhatsApp not configured (MSG91 auth key + integrated number).' };
  if (!templateName) return { ok: false, error: 'No approved WhatsApp template for this event.' };
  const m = mobile.replace(/\D/g, ''); const to = m.length === 10 ? '91' + m : m;
  try {
    const r = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey: cfg.authkey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrated_number: cfg.number,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp', type: 'template',
          template: { name: templateName, language: { code: 'en', policy: 'deterministic' },
            to_and_components: [{ to: [to], components: components.reduce((a, v, i) => ({ ...a, ['body_' + (i + 1)]: { type: 'text', value: v } }), {}) }] },
        },
      }),
    });
    const d: any = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, id: d?.request_id || '' };
    return { ok: false, error: d?.message || `WhatsApp error ${r.status}` };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

/* ---- Admin new-order alert (plain, informative) ---- */
function adminOrderAlert(site: string, o: any) {
  const rupees = (p: number) => '₹' + (Math.round(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const items = (o.items || []).map((it: any) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-family:Georgia,serif">${it.name}${it.quantity>1?` &times; ${it.quantity}`:''}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-family:Arial,sans-serif">${rupees(it.price*it.quantity)}</td></tr>`).join('');
  const b = o.billing || {};
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <h2 style="font-family:Georgia,serif">New order · ${o.order_number}</h2>
    <p><strong>${o.name || ''}</strong><br/>${o.email || ''} &middot; ${o.phone || ''}<br/>${[b.address,b.city,b.state,b.postcode].filter(Boolean).join(', ')}</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">${items}
      <tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${rupees(o.total||0)}</td></tr>
    </table>
    <p style="font-size:13px;color:#666">Payment: ${o.payment_method || ''} &middot; <a href="${site}/apaulogy-admin/orders/${o.order_number}/">Open in admin</a></p>
  </div>`;
}

/* ---- Dispatcher: send an event across all enabled channels. ---- */
export async function notify(env: Env, event: 'order_confirmation' | 'shipping_update', o: any) {
  if (!(await eventEnabled(env, event))) return { skipped: true };
  const cfg = await notifyConfig(env);
  const site = (await emailConfig(env)).site;
  const results: Record<string, any> = {};
  // Email
  if (cfg.email.enabled && cfg.email.key && o.email) {
    const t = event === 'shipping_update' ? shippingUpdateEmail(site, o) : orderConfirmationEmail(site, o);
    results.email = await sendEmail(env, o.email, t.subject, t.html, event);
    // Admin copy — new order alert
    if (event === 'order_confirmation' && cfg.email.adminOn && cfg.email.admin) {
      const adminHtml = adminOrderAlert(site, o);
      results.adminEmail = await sendEmail(env, cfg.email.admin, `New order ${o.order_number} — ${o.name || ''} · ${'₹' + ((o.total||0)/100).toLocaleString('en-IN')}`, adminHtml, 'admin_new_order');
    }
  }
  // SMS
  if (cfg.sms.enabled && o.phone) {
    const tpl = event === 'shipping_update' ? cfg.sms.tplShipping : cfg.sms.tplOrder;
    const vars = event === 'shipping_update'
      ? { var1: o.name || 'there', var2: o.order_number, var3: o.tracking_number || '' }
      : { var1: o.name || 'there', var2: o.order_number };
    results.sms = await sendSMS(env, o.phone, tpl, vars);
  }
  // WhatsApp
  if (cfg.whatsapp.enabled && o.phone) {
    const tpl = event === 'shipping_update' ? cfg.whatsapp.tplShipping : cfg.whatsapp.tplOrder;
    const comps = event === 'shipping_update' ? [o.name || 'there', o.order_number, o.tracking_number || ''] : [o.name || 'there', o.order_number];
    results.whatsapp = await sendWhatsApp(env, o.phone, tpl, comps);
  }
  return results;
}

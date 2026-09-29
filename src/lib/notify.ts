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
  const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = (o.items || []).map((it: any) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-family:Georgia,serif">${esc(it.name)}${it.variant ? `<br/><span style="color:#888;font-size:12px">${esc(it.variant)}</span>` : ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center;font-family:Arial,sans-serif">${it.quantity || 1}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-family:Arial,sans-serif">${rupees((it.price || 0) * (it.quantity || 1))}</td>
    </tr>`).join('');
  // Match the admin order-detail page's address handling (line1||address, line2, city/state, postcode||pin||zip, country).
  const b = o.billing || {};
  const name = b.name || o.name || '';
  const street = [b.line1 || b.address, b.line2].filter(Boolean).join(', ');
  const cityLine = [b.city, b.state].filter(Boolean).join(', ');
  const pin = b.postcode || b.pin || b.zip || '';
  const phone = o.phone || b.phone || '';
  const addr = [name, street, cityLine ? cityLine + (pin ? ` — ${pin}` : '') : pin, b.country]
    .filter(Boolean).map(esc).join('<br/>');
  const hasSub = o.subtotal != null;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <h2 style="font-family:Georgia,serif;margin:0 0 4px">New order · ${esc(o.order_number)}</h2>
    <p style="margin:0 0 16px;color:#666;font-size:13px">${esc(o.email || '')}${phone ? ` &middot; ${esc(phone)}` : ''}</p>
    <table style="width:100%;border-collapse:collapse;margin:0">
      <tr>
        <th align="left" style="font-size:11px;letter-spacing:.05em;color:#999;text-transform:uppercase;padding-bottom:6px">Item</th>
        <th style="font-size:11px;letter-spacing:.05em;color:#999;text-transform:uppercase;padding-bottom:6px">Qty</th>
        <th align="right" style="font-size:11px;letter-spacing:.05em;color:#999;text-transform:uppercase;padding-bottom:6px">Price</th>
      </tr>
      ${items}
    </table>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">
      ${hasSub ? `<tr><td style="padding:3px 0;color:#666">Subtotal</td><td style="padding:3px 0;text-align:right">${rupees(o.subtotal || 0)}</td></tr>` : ''}
      ${hasSub ? `<tr><td style="padding:3px 0;color:#666">Shipping</td><td style="padding:3px 0;text-align:right">${o.shipping ? rupees(o.shipping) : 'Free'}</td></tr>` : ''}
      <tr><td style="padding:8px 0 0;font-weight:bold;border-top:2px solid #111">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;border-top:2px solid #111">${rupees(o.total || 0)}</td></tr>
    </table>
    ${addr ? `<h3 style="font-family:Georgia,serif;font-size:15px;margin:0 0 6px">Shipping address</h3>
    <p style="margin:0 0 20px;line-height:1.7;color:#333">${addr}${phone ? `<br/>&#9742; ${esc(phone)}` : ''}</p>` : ''}
    <p style="font-size:13px;color:#666;border-top:1px solid #eee;padding-top:12px">Payment: ${esc(o.payment_method || '')} &middot; <a href="${site}/apaulogy-admin/orders/${esc(o.order_number)}/" style="color:#111">Open in admin &rarr;</a></p>
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

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

export async function notifyConfig(env: Env) {
  const g = (k: string) => getSetting(env, k);
  return {
    email: { enabled: (await g('notify_email_enabled')) !== '0', key: env.RESEND_KEY || (await g('resend_key')) || '' },
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

/* ---- Dispatcher: send an event across all enabled channels. ---- */
export async function notify(env: Env, event: 'order_confirmation' | 'shipping_update', o: any) {
  const cfg = await notifyConfig(env);
  const site = (await emailConfig(env)).site;
  const results: Record<string, any> = {};
  // Email
  if (cfg.email.enabled && cfg.email.key && o.email) {
    const t = event === 'shipping_update' ? shippingUpdateEmail(site, o) : orderConfirmationEmail(site, o);
    results.email = await sendEmail(env, o.email, t.subject, t.html, event);
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

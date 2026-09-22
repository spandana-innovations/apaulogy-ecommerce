import { getSetting } from './admin-data';
type Env = Record<string, any>;

export async function emailConfig(env: Env) {
  return {
    key: env.RESEND_KEY || (await getSetting(env, 'resend_key')) || '',
    from: (await getSetting(env, 'from_email')) || 'aPaulogy <orders@apaulogy.com>',
    site: env.SITE_URL || 'https://apaulogy.com',
  };
}

/** Send an email via Resend. Returns { ok, id?, error? }. */
async function logEmail(env: Env, to: string, subject: string, template: string, status: string, id: string) {
  if (!env?.DB) return;
  try { await env.DB.prepare(`INSERT INTO email_log (to_addr, subject, template, status, provider_id) VALUES (?,?,?,?,?)`).bind(to, subject, template || '', status, id || '').run(); } catch {}
}
export async function listEmails(env: Env, limit = 50) {
  if (!env?.DB) return [];
  try { const r: any = await env.DB.prepare(`SELECT to_addr, subject, template, status, created_at FROM email_log ORDER BY created_at DESC LIMIT ?`).bind(limit).all(); return r?.results || []; } catch { return []; }
}
export async function sendEmail(env: Env, to: string, subject: string, html: string, template = '') {
  const cfg = await emailConfig(env);
  if (!cfg.key) return { ok: false, error: 'Resend API key not set.' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
    });
    const d: any = await r.json().catch(() => ({}));
    if (r.ok && d?.id) { await logEmail(env, to, subject, template, 'sent', d.id); return { ok: true, id: d.id }; }
    await logEmail(env, to, subject, template, 'failed', '');
    return { ok: false, error: d?.message || d?.name || `Resend error ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ---- Branded template shell ---------------------------------------------- */
const rupees = (paise: number) => '₹' + (Math.round(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function shell(site, title, kicker, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'EB Garamond','Palatino Linotype',Palatino,Georgia,serif;-webkit-font-smoothing:antialiased;color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #111111">
    <!-- masthead -->
    <tr><td style="padding:36px 44px 4px;text-align:center">
      <img src="${site}/brand/logo-black.png" alt="aPaulogy — Curious Illustration" width="200" style="width:200px;max-width:64%;height:auto;display:inline-block" />
    </td></tr>
    <tr><td style="padding:26px 44px 0"><div style="border-top:1px solid #e3e3e3"></div></td></tr>
    <!-- title -->
    <tr><td style="padding:28px 44px 6px;text-align:center">
      <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#767676;margin-bottom:12px">${kicker}</div>
      <h1 style="margin:0;font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.15;color:#000000">${title}</h1>
    </td></tr>
    <tr><td style="padding:20px 44px 40px">${body}</td></tr>
    <!-- footer -->
    <tr><td style="padding:0 44px"><div style="border-top:1px solid #e3e3e3"></div></td></tr>
    <tr><td style="padding:24px 44px 36px;text-align:center">
      <div style="font-family:Georgia,serif;font-size:15px;color:#000000;margin-bottom:8px">Paul Fernandes &middot; aPaulogy Gallery</div>
      <div style="font-family:'EB Garamond',Georgia,serif;font-size:13px;color:#767676;line-height:1.8">002 Edward House, 37 Pottery Road, Richards Town, Bengaluru 560&nbsp;005<br/>
        <a href="${site}" style="color:#000000;text-decoration:underline;text-underline-offset:2px">apaulogy.com</a> &nbsp;&middot;&nbsp; Watercolours of a city that was</div>
    </td></tr>
  </table>
  <div style="font-size:11px;color:#767676;margin-top:16px;font-family:'EB Garamond',Georgia,serif">&copy; aPaulogy Gallery &middot; All artwork &copy; Paul Fernandes</div>
  </td></tr></table></body></html>`;
}

function itemsTable(items) {
  if (!items?.length) return '';
  const rows = items.map((it) => `<tr>
    <td style="padding:15px 0;border-bottom:1px solid #e3e3e3;font-family:Georgia,serif;font-size:16px;color:#000000">${it.name}${it.quantity > 1 ? `<span style="color:#767676;font-size:13px"> &times; ${it.quantity}</span>` : ''}</td>
    <td style="padding:15px 0;border-bottom:1px solid #e3e3e3;text-align:right;font-family:Georgia,serif;font-size:15px;color:#000000;white-space:nowrap">${rupees(it.price * it.quantity)}</td>
  </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function orderConfirmationEmail(site: string, o: any) {
  const body = `
    <p style="font-family:Georgia,serif;font-size:17px;line-height:1.75;color:#2b2b2b;text-align:center;margin:0 0 26px">
      Thank you, ${o.name || 'friend'}. A little piece of Paul's world is on its way to you.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #111111">
      <tr><td style="padding:22px 24px">
        <table role="presentation" width="100%"><tr>
          <td style="font-family:'EB Garamond',Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#767676">Order</td>
          <td style="text-align:right;font-family:Georgia,serif;font-size:19px;color:#000000">${o.order_number}</td>
        </tr></table>
        <div style="height:12px"></div>
        ${itemsTable(o.items || [])}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'EB Garamond',Georgia,serif;font-size:14px;color:#2b2b2b;margin-top:8px">
          <tr><td style="padding:3px 0;color:#767676">Subtotal</td><td style="padding:3px 0;text-align:right">${rupees(o.subtotal || 0)}</td></tr>
          <tr><td style="padding:3px 0;color:#767676">Shipping</td><td style="padding:3px 0;text-align:right">${rupees(o.shipping || 0)}</td></tr>
          <tr><td style="padding:11px 0 0;font-family:Georgia,serif;font-size:17px;border-top:1px solid #111111">Total</td><td style="padding:11px 0 0;text-align:right;font-family:Georgia,serif;font-size:17px;border-top:1px solid #111111">${rupees(o.total || 0)}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="font-family:'EB Garamond',Georgia,serif;font-size:14px;line-height:1.8;color:#767676;text-align:center;margin:26px 0 0">
      We'll write again with tracking once it ships — prints are dispatched within 2–5 business days.
    </p>
    <div style="text-align:center;margin-top:26px">
      <a href="${site}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;font-family:'EB Garamond',Georgia,serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:13px 34px">Visit the Gallery</a>
    </div>`;
  return { subject: `Your aPaulogy order ${o.order_number} is confirmed`, html: shell(site, 'Order Confirmed', 'Thank you for your order', body) };
}

export function shippingUpdateEmail(site: string, o: any) {
  const track = o.tracking_number
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #111111;margin:6px 0 2px"><tr><td style="padding:20px 24px;text-align:center">
         <div style="font-family:'EB Garamond',Georgia,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#767676;margin-bottom:6px">Tracking</div>
         <div style="font-family:Georgia,serif;font-size:19px;color:#000000">${o.tracking_carrier ? o.tracking_carrier + ' · ' : ''}${o.tracking_number}</div>
       </td></tr></table>` : '';
  const body = `
    <p style="font-family:Georgia,serif;font-size:17px;line-height:1.75;color:#2b2b2b;text-align:center;margin:0 0 22px">
      Good news, ${o.name || 'friend'} — order <strong>${o.order_number}</strong> has left the studio.
    </p>${track}
    <p style="font-family:'EB Garamond',Georgia,serif;font-size:14px;line-height:1.8;color:#767676;text-align:center;margin:22px 0 0">Thank you for supporting the gallery.</p>`;
  return { subject: `Your aPaulogy order ${o.order_number} has shipped`, html: shell(site, 'On Its Way', 'Shipping update', body) };
}

export const TEMPLATES = [
  { id: 'order_confirmation', name: 'Order confirmation', desc: 'Sent when an order is placed.' },
  { id: 'shipping_update', name: 'Shipping update', desc: 'Sent when tracking is added / order ships.' },
];

export function renderTemplate(id: string, site: string, sample: any) {
  if (id === 'shipping_update') return shippingUpdateEmail(site, sample);
  return orderConfirmationEmail(site, sample);
}

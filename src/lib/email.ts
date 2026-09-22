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
  <body style="margin:0;padding:0;background:#ece7dd;font-family:Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7dd"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffdf9;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(40,30,15,.12)">
    <!-- masthead -->
    <tr><td style="background:#0e0d0b;padding:34px 40px 30px;text-align:center">
      <div style="font-family:Georgia,serif;font-size:30px;font-weight:400;color:#ffffff;letter-spacing:.01em">a<span style="color:#c9a24a">P</span>aulogy</div>
      <div style="font-size:10px;letter-spacing:.42em;text-transform:uppercase;color:#8a7b52;margin-top:7px">Curious Illustration</div>
    </td></tr>
    <!-- gold rule -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#c9a24a,#e8cf95,#c9a24a)"></td></tr>
    <!-- hero title -->
    <tr><td style="padding:40px 40px 8px;text-align:center">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#b8973f;margin-bottom:12px">${kicker}</div>
      <h1 style="margin:0;font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2;color:#1a1712">${title}</h1>
    </td></tr>
    <tr><td style="padding:22px 40px 40px">${body}</td></tr>
    <!-- footer -->
    <tr><td style="background:#faf7f0;border-top:1px solid #ece7dd;padding:28px 40px;text-align:center;font-family:Arial,Helvetica,sans-serif">
      <div style="font-family:Georgia,serif;font-size:15px;color:#1a1712;margin-bottom:8px">Paul Fernandes · aPaulogy Gallery</div>
      <div style="font-size:12px;color:#9a9082;line-height:1.8">002 Edward House, 37 Pottery Road, Richards Town, Bengaluru 560&nbsp;005<br/>
        <a href="${site}" style="color:#b8973f;text-decoration:none;font-weight:bold">apaulogy.com</a> &nbsp;·&nbsp; Watercolours of a city that was</div>
    </td></tr>
  </table>
  <div style="font-size:11px;color:#a39a8a;margin-top:18px;font-family:Arial,sans-serif">© aPaulogy Gallery · All artwork © Paul Fernandes</div>
  </td></tr></table></body></html>`;
}

function itemsTable(items) {
  if (!items?.length) return '';
  const rows = items.map((it) => `<tr>
    <td style="padding:16px 0;border-bottom:1px solid #efe9dd;font-family:Georgia,serif;font-size:16px;color:#1a1712">${it.name}${it.quantity > 1 ? `<span style="color:#9a9082;font-size:13px"> &times; ${it.quantity}</span>` : ''}</td>
    <td style="padding:16px 0;border-bottom:1px solid #efe9dd;text-align:right;font-family:Arial,sans-serif;font-size:15px;color:#1a1712;white-space:nowrap">${rupees(it.price * it.quantity)}</td>
  </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function orderConfirmationEmail(site: string, o: any) {
  const body = `
    <p style="font-family:Georgia,serif;font-size:17px;line-height:1.75;color:#3d3830;text-align:center;margin:0 0 26px">
      Thank you, ${o.name || 'friend'}. A little piece of Paul's world is on its way to you.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f0;border:1px solid #ece7dd;border-radius:10px">
      <tr><td style="padding:24px 26px">
        <table role="presentation" width="100%"><tr>
          <td style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9a9082">Order</td>
          <td style="text-align:right;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#1a1712">${o.order_number}</td>
        </tr></table>
        <div style="height:14px"></div>
        ${itemsTable(o.items || [])}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#3d3830;margin-top:10px">
          <tr><td style="padding:4px 0;color:#9a9082">Subtotal</td><td style="padding:4px 0;text-align:right">${rupees(o.subtotal || 0)}</td></tr>
          <tr><td style="padding:4px 0;color:#9a9082">Shipping</td><td style="padding:4px 0;text-align:right">${rupees(o.shipping || 0)}</td></tr>
          <tr><td style="padding:12px 0 0;font-family:Georgia,serif;font-size:17px;font-weight:bold;border-top:2px solid #1a1712">Total</td><td style="padding:12px 0 0;text-align:right;font-family:Georgia,serif;font-size:17px;font-weight:bold;border-top:2px solid #1a1712">${rupees(o.total || 0)}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#6b6459;text-align:center;margin:28px 0 0">
      We'll write again with tracking once it ships — prints are dispatched within 2–5 business days.
    </p>
    <div style="text-align:center;margin-top:28px">
      <a href="${site}" style="display:inline-block;background:#0e0d0b;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.06em;padding:13px 32px;border-radius:6px">VISIT THE GALLERY</a>
    </div>`;
  return { subject: `Your aPaulogy order ${o.order_number} is confirmed`, html: shell(site, 'Order Confirmed', 'Thank you for your order', body) };
}

export function shippingUpdateEmail(site: string, o: any) {
  const track = o.tracking_number
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f0;border:1px solid #ece7dd;border-radius:10px;margin:8px 0 4px"><tr><td style="padding:22px 26px;text-align:center">
         <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9a9082;margin-bottom:6px">Tracking</div>
         <div style="font-family:Georgia,serif;font-size:20px;color:#1a1712">${o.tracking_carrier ? o.tracking_carrier + ' · ' : ''}${o.tracking_number}</div>
       </td></tr></table>` : '';
  const body = `
    <p style="font-family:Georgia,serif;font-size:17px;line-height:1.75;color:#3d3830;text-align:center;margin:0 0 22px">
      Good news, ${o.name || 'friend'} — order <strong>${o.order_number}</strong> has left the studio.
    </p>${track}
    <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#6b6459;text-align:center;margin:24px 0 0">Thank you for supporting the gallery.</p>`;
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

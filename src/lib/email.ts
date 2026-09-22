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
export async function sendEmail(env: Env, to: string, subject: string, html: string) {
  const cfg = await emailConfig(env);
  if (!cfg.key) return { ok: false, error: 'Resend API key not set.' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
    });
    const d: any = await r.json().catch(() => ({}));
    if (r.ok && d?.id) return { ok: true, id: d.id };
    return { ok: false, error: d?.message || d?.name || `Resend error ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ---- Branded template shell ---------------------------------------------- */
const rupees = (paise: number) => '₹' + (Math.round(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function shell(site: string, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Georgia,'Times New Roman',serif;color:#1a1712">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#0e0d0b;padding:26px 32px;text-align:center">
      <div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:.02em;font-family:Georgia,serif">aPaulogy</div>
      <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#c9a24a;margin-top:4px">Curious Illustration</div>
    </div>
    <div style="padding:34px 32px">
      <h1 style="font-size:22px;margin:0 0 14px;color:#1a1712;font-weight:600">${title}</h1>
      ${body}
    </div>
    <div style="background:#faf8f3;border-top:1px solid #ece7dd;padding:22px 32px;text-align:center;font-family:Arial,sans-serif">
      <div style="font-size:12px;color:#8a847a;line-height:1.7">
        aPaulogy Gallery · 002 Edward House, 37 Pottery Road, Richards Town, Bengaluru 560&nbsp;005<br/>
        Watercolours by Paul Fernandes · <a href="${site}" style="color:#b8973f;text-decoration:none">apaulogy.com</a>
      </div>
    </div>
  </div></body></html>`;
}

function itemsTable(items: { name: string; quantity: number; price: number }[]) {
  if (!items?.length) return '';
  const rows = items.map((it) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px">${it.name}${it.quantity > 1 ? ` &times; ${it.quantity}` : ''}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-family:Arial,sans-serif;font-size:14px">${rupees(it.price * it.quantity)}</td>
  </tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">${rows}</table>`;
}

export function orderConfirmationEmail(site: string, o: any) {
  const body = `
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d3830">
      Thank you for your order, ${o.name || 'friend'} — we're delighted a piece of Paul's world is on its way to you.
    </p>
    <div style="background:#faf8f3;border:1px solid #ece7dd;border-radius:8px;padding:18px 20px;margin:18px 0">
      <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8a847a">Order</div>
      <div style="font-size:18px;font-weight:700;color:#1a1712;font-family:Arial,sans-serif">${o.order_number}</div>
      ${itemsTable(o.items || [])}
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;margin-top:6px">
        <tr><td style="padding:3px 0;color:#8a847a">Subtotal</td><td style="padding:3px 0;text-align:right">${rupees(o.subtotal || 0)}</td></tr>
        <tr><td style="padding:3px 0;color:#8a847a">Shipping</td><td style="padding:3px 0;text-align:right">${rupees(o.shipping || 0)}</td></tr>
        <tr><td style="padding:8px 0 0;font-weight:700;border-top:1px solid #ddd">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;border-top:1px solid #ddd">${rupees(o.total || 0)}</td></tr>
      </table>
    </div>
    <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#3d3830">
      We'll send another note with tracking once it ships. Prints are dispatched within 2–5 business days.
    </p>`;
  return { subject: `Your aPaulogy order ${o.order_number} is confirmed`, html: shell(site, 'Order confirmed', body) };
}

export function shippingUpdateEmail(site: string, o: any) {
  const track = o.tracking_number
    ? `<div style="background:#faf8f3;border:1px solid #ece7dd;border-radius:8px;padding:16px 20px;margin:16px 0;font-family:Arial,sans-serif">
         <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8a847a">Tracking</div>
         <div style="font-size:16px;font-weight:700">${o.tracking_carrier ? o.tracking_carrier + ' · ' : ''}${o.tracking_number}</div>
       </div>` : '';
  const body = `
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d3830">
      Good news, ${o.name || 'friend'} — your order <strong>${o.order_number}</strong> is on its way.
    </p>${track}
    <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#3d3830">Thank you for supporting the gallery.</p>`;
  return { subject: `Your aPaulogy order ${o.order_number} has shipped`, html: shell(site, 'On its way', body) };
}

export const TEMPLATES = [
  { id: 'order_confirmation', name: 'Order confirmation', desc: 'Sent when an order is placed.' },
  { id: 'shipping_update', name: 'Shipping update', desc: 'Sent when tracking is added / order ships.' },
];

export function renderTemplate(id: string, site: string, sample: any) {
  if (id === 'shipping_update') return shippingUpdateEmail(site, sample);
  return orderConfirmationEmail(site, sample);
}

/**
 * Transactional email for the storefront — Resend REST API only (edge-safe).
 *
 * Every customer-facing email the site sends is defined here as a single
 * template function so the admin can preview and test each one from
 * Settings → Emails. Sending is best-effort: if no Resend key is configured
 * the helpers no-op, and callers never block an order on a failed send.
 */
import { getSetting } from './admin-data';
import { formatINR } from './format';

type Env = Record<string, any>;

/** The email types the site can send, in the order shown in the admin. */
export const EMAIL_TYPES = [
  { id: 'order_confirmation', label: 'Order confirmation', when: 'Payment received' },
  { id: 'order_shipped',      label: 'Order shipped',      when: 'Status → shipped (with tracking)' },
  { id: 'order_cancelled',    label: 'Order cancelled',    when: 'Status → cancelled' },
  { id: 'order_refunded',     label: 'Order refunded',     when: 'Status → refunded' },
  { id: 'payment_failed',     label: 'Payment failed',     when: 'Payment could not be completed' },
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number]['id'];

const STORE = 'aPaulogy Gallery';

export interface OrderEmailData {
  order_number: string;
  name?: string;
  email?: string;
  items?: { name: string; variant?: string; quantity: number; price: number }[];
  subtotal?: number;
  discount?: number;
  shipping?: number;
  total?: number;
  tracking_number?: string;
  tracking_carrier?: string;
  city?: string;
}

/** Sample order used for previews and test sends. */
export function sampleOrder(): OrderEmailData {
  return {
    order_number: 'APG-100042',
    name: 'Priya Nair',
    email: 'priya@example.com',
    items: [
      { name: 'Bengaluru Then & Now — Framed Print', variant: 'A3', quantity: 1, price: 320000 },
      { name: 'City of Gardens — Postcard Set', variant: 'Pack of 6', quantity: 2, price: 45000 },
    ],
    subtotal: 410000,
    discount: 20000,
    shipping: 14000,
    total: 404000,
    tracking_number: 'EX123456789IN',
    tracking_carrier: 'DTDC',
    city: 'Bengaluru',
  };
}

/* ---- Shared HTML shell -------------------------------------------------- */
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c2530">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="text-align:center;padding:8px 0 20px">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:.02em;color:#0e1620">aPaulogy</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e2d6;border-radius:12px;overflow:hidden">
      <div style="padding:26px 28px">
        <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;color:#0e1620">${title}</h1>
        ${bodyHtml}
      </div>
    </div>
    <p style="text-align:center;color:#8a8577;font-size:12px;line-height:1.6;margin:20px 0 0">
      ${STORE} · Bengaluru · All artwork © Paul Fernandes<br/>
      This is a transactional email about your order.
    </p>
  </div>
</body></html>`;
}

function itemsTable(o: OrderEmailData): string {
  const rows = (o.items || []).map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #efeadd">
        <strong style="color:#0e1620">${esc(it.name)}</strong>
        ${it.variant ? `<br/><span style="color:#8a8577;font-size:13px">${esc(it.variant)}</span>` : ''}
        <span style="color:#8a8577;font-size:13px"> × ${it.quantity}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #efeadd;text-align:right;white-space:nowrap">${formatINR(it.price * it.quantity)}</td>
    </tr>`).join('');
  const line = (label: string, val: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:${strong ? '#0e1620' : '#6b6558'};${strong ? 'font-weight:700;border-top:1px solid #e7e2d6;padding-top:8px' : ''}">${label}</td>
     <td style="padding:4px 0;text-align:right;${strong ? 'font-weight:700;color:#0e1620;border-top:1px solid #e7e2d6;padding-top:8px' : ''}">${val}</td></tr>`;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0 4px">${rows}</table>
    <table style="width:100%;border-collapse:collapse;font-size:14px;max-width:260px;margin-left:auto">
      ${o.subtotal != null ? line('Subtotal', formatINR(o.subtotal)) : ''}
      ${o.discount ? line('Discount', '– ' + formatINR(o.discount)) : ''}
      ${o.shipping != null ? line('Shipping', o.shipping ? formatINR(o.shipping) : 'Free') : ''}
      ${o.total != null ? line('Total', formatINR(o.total), true) : ''}
    </table>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/* ---- Templates ---------------------------------------------------------- */
export function renderEmail(type: EmailType, o: OrderEmailData): { subject: string; html: string } {
  const hi = `Hi ${esc(o.name || 'there')},`;
  switch (type) {
    case 'order_confirmation':
      return {
        subject: `Order confirmed — ${o.order_number}`,
        html: shell('Thank you for your order', `
          <p style="margin:0 0 12px;color:#3d4653;font-size:14px;line-height:1.6">${hi}<br/>
            We've received your payment and your order <strong>${o.order_number}</strong> is confirmed. We'll email you again as soon as it ships.</p>
          ${itemsTable(o)}
        `),
      };
    case 'order_shipped':
      return {
        subject: `Your order has shipped — ${o.order_number}`,
        html: shell('Your order is on its way', `
          <p style="margin:0 0 12px;color:#3d4653;font-size:14px;line-height:1.6">${hi}<br/>
            Good news — order <strong>${o.order_number}</strong> has been dispatched${o.city ? ` to ${esc(o.city)}` : ''}.</p>
          ${o.tracking_number ? `<div style="background:#f7f5ee;border:1px solid #e7e2d6;border-radius:8px;padding:14px 16px;margin:6px 0 14px">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8a8577">Tracking</div>
            <div style="font-size:16px;font-weight:700;color:#0e1620">${esc(o.tracking_number)}</div>
            ${o.tracking_carrier ? `<div style="font-size:13px;color:#6b6558">via ${esc(o.tracking_carrier)}</div>` : ''}
          </div>` : ''}
          ${itemsTable(o)}
        `),
      };
    case 'order_cancelled':
      return {
        subject: `Order cancelled — ${o.order_number}`,
        html: shell('Your order was cancelled', `
          <p style="margin:0 0 12px;color:#3d4653;font-size:14px;line-height:1.6">${hi}<br/>
            Your order <strong>${o.order_number}</strong> has been cancelled. If a payment was captured, any refund will follow to your original payment method. Reply to this email if you have any questions.</p>
          ${itemsTable(o)}
        `),
      };
    case 'order_refunded':
      return {
        subject: `Refund issued — ${o.order_number}`,
        html: shell('Your refund is on the way', `
          <p style="margin:0 0 12px;color:#3d4653;font-size:14px;line-height:1.6">${hi}<br/>
            We've refunded order <strong>${o.order_number}</strong>. Refunds typically take 5–7 business days to appear on your statement.</p>
          ${itemsTable(o)}
        `),
      };
    case 'payment_failed':
      return {
        subject: `Payment could not be completed — ${o.order_number}`,
        html: shell('Your payment did not go through', `
          <p style="margin:0 0 12px;color:#3d4653;font-size:14px;line-height:1.6">${hi}<br/>
            We couldn't complete the payment for order <strong>${o.order_number}</strong>, so it hasn't been placed. No money has been taken. You're welcome to try again from your cart.</p>
        `),
      };
    default:
      return { subject: `Update on ${o.order_number}`, html: shell('Order update', `<p>${hi}</p>`) };
  }
}

/* ---- Sending ------------------------------------------------------------ */
export interface SendResult { ok: boolean; skipped?: boolean; error?: string; id?: string }

/** Send one email through Resend. No-ops (skipped) when no key is configured. */
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<SendResult> {
  const key = env.RESEND_API_KEY || (await getSetting(env, 'resend_key'));
  if (!key) return { ok: false, skipped: true, error: 'No Resend key configured' };
  const from = env.RESEND_FROM || (await getSetting(env, 'from_email')) || 'orders@apaulogy.com';
  if (!to) return { ok: false, error: 'No recipient' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${STORE} <${from}>`, to: [to], subject, html }),
    });
    if (!r.ok) {
      let msg = `Error ${r.status}`;
      try { const d: any = await r.json(); msg = d?.message || d?.error?.message || msg; } catch {}
      return { ok: false, error: msg };
    }
    const d: any = await r.json().catch(() => ({}));
    return { ok: true, id: d?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Render + send a typed order email to the customer. Best-effort. */
export async function sendOrderEmail(env: Env, type: EmailType, o: OrderEmailData): Promise<SendResult> {
  if (!o.email) return { ok: false, error: 'No customer email' };
  const { subject, html } = renderEmail(type, o);
  return sendEmail(env, o.email, subject, html);
}

/** Load an order from D1 and shape it for the email templates. */
export async function orderEmailData(env: Env, orderNumber: string): Promise<OrderEmailData | null> {
  if (!env?.DB) return null;
  try {
    const o: any = await env.DB.prepare(`SELECT * FROM orders WHERE order_number=?`).bind(orderNumber).first();
    if (!o) return null;
    const items = ((await env.DB.prepare(`SELECT name,variant,price,quantity FROM order_items WHERE order_number=?`).bind(orderNumber).all()).results) || [];
    let bill: any = {}; try { bill = JSON.parse(o.billing_json || '{}'); } catch {}
    return {
      order_number: o.order_number,
      name: bill.name || '',
      email: o.email,
      items,
      subtotal: o.subtotal,
      discount: o.discount,
      shipping: o.shipping,
      total: o.total,
      tracking_number: o.tracking_number,
      tracking_carrier: o.tracking_carrier,
      city: bill.city,
    };
  } catch { return null; }
}

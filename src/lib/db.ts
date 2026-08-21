/** Thin D1 helpers for orders. Catalogue is served statically from JSON;
 *  D1 holds orders, customers and (imported) history. */

export interface CartLine {
  slug: string;
  name: string;
  variant?: string;
  quantity: number;
  /** unit price in paise */
  price: number;
}

export interface Address {
  name?: string;
  email?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface CreateOrderInput {
  email: string;
  phone?: string;
  items: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  billing?: Address;
  shipping_address?: Address;
  razorpay_order_id?: string | null;
  payment_method?: string; // 'razorpay' | 'bank'
}

function orderNumber(): string {
  // Human-friendly, time-based reference. Uniqueness backstopped by DB.
  const n = Math.floor(Date.now() / 1000) % 1000000;
  return `APG-${n}`;
}

export async function createPendingOrder(
  db: D1Database,
  input: CreateOrderInput,
): Promise<{ id: number; orderNumber: string }> {
  const number = orderNumber();
  const res = await db
    .prepare(
      `INSERT INTO orders
        (order_number, email, phone, status, currency, subtotal, shipping, total,
         billing_json, shipping_json, razorpay_order_id, notes, source)
       VALUES (?, ?, ?, 'pending', 'INR', ?, ?, ?, ?, ?, ?, ?, 'web')`,
    )
    .bind(
      number,
      input.email,
      input.phone ?? null,
      input.subtotal,
      input.shipping,
      input.total,
      input.billing ? JSON.stringify(input.billing) : null,
      input.shipping_address ? JSON.stringify(input.shipping_address) : null,
      input.razorpay_order_id ?? null,
      input.payment_method ? `payment_method:${input.payment_method}` : null,
    )
    .run();

  const orderId = Number(res.meta.last_row_id);

  const stmts = input.items.map((it) =>
    db
      .prepare(
        `INSERT INTO order_items
          (order_id, product_slug, name, variant, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        it.slug,
        it.name,
        it.variant ?? null,
        it.quantity,
        it.price,
        it.price * it.quantity,
      ),
  );
  if (stmts.length) await db.batch(stmts);
  return { id: orderId, orderNumber: number };
}

export async function markOrderPaid(
  db: D1Database,
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders
         SET status = 'paid', razorpay_payment_id = ?, updated_at = datetime('now')
       WHERE razorpay_order_id = ? AND status = 'pending'`,
    )
    .bind(razorpayPaymentId, razorpayOrderId)
    .run();
}

/** Record a webhook event id; returns false if already seen (idempotency). */
export async function recordEventOnce(
  db: D1Database,
  eventId: string,
  eventType: string,
  payload: string,
): Promise<boolean> {
  try {
    await db
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload) VALUES (?, ?, ?)`,
      )
      .bind(eventId, eventType, payload)
      .run();
    return true;
  } catch {
    return false; // UNIQUE violation -> duplicate delivery
  }
}

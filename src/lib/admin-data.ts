type Env = Record<string, any>;

async function q<T = any>(env: Env, sql: string, ...bind: any[]): Promise<{ ok: boolean; rows: T[]; error?: string }> {
  if (!env?.DB) return { ok: false, rows: [] };
  try {
    const stmt = bind.length ? env.DB.prepare(sql).bind(...bind) : env.DB.prepare(sql);
    const res = await stmt.all();
    return { ok: true, rows: (res?.results as T[]) || [] };
  } catch (e: any) {
    return { ok: false, rows: [], error: String(e?.message || e) };
  }
}
async function one<T = any>(env: Env, sql: string, ...bind: any[]): Promise<T | null> {
  if (!env?.DB) return null;
  try {
    const stmt = bind.length ? env.DB.prepare(sql).bind(...bind) : env.DB.prepare(sql);
    return (await stmt.first()) as T;
  } catch {
    return null;
  }
}

export async function getStats(env: Env) {
  const dbBound = !!env?.DB;
  const orders = await one<{ n: number; revenue: number; pending: number }>(env,
    `SELECT COUNT(*) n,
            COALESCE(SUM(CASE WHEN status IN ('paid','shipped','fulfilled') THEN total END),0) revenue,
            COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) pending
     FROM orders`);
  const customers = await one<{ n: number }>(env, `SELECT COUNT(*) n FROM customers`);
  const requests = await one<{ n: number }>(env, `SELECT COUNT(*) n FROM data_requests`);
  const messages = await one<{ n: number }>(env, `SELECT COUNT(*) n FROM messages`);
  return {
    dbBound,
    orders: orders?.n ?? 0,
    revenue: orders?.revenue ?? 0,
    pending: orders?.pending ?? 0,
    customers: customers?.n ?? 0,
    requests: requests?.n ?? 0,
    messages: messages?.n ?? 0,
  };
}

export async function recentOrders(env: Env, limit = 8) {
  return (await q(env,
    `SELECT order_number, email, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT ?`, limit)).rows;
}
export async function listOrders(env: Env, opts: { status?: string; search?: string; year?: string; page?: number; per?: number } = {}) {
  const per = Math.min(100, opts.per || 50);
  const page = Math.max(1, opts.page || 1);
  const where: string[] = [];
  const bind: any[] = [];
  if (opts.status && opts.status !== 'all') { where.push('status=?'); bind.push(opts.status); }
  if (opts.year && opts.year !== 'all') { where.push("substr(created_at,1,4)=?"); bind.push(opts.year); }
  if (opts.search) { where.push('(order_number LIKE ? OR email LIKE ? OR phone LIKE ?)'); const s = `%${opts.search}%`; bind.push(s, s, s); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one<{ n: number }>(env, `SELECT COUNT(*) n FROM orders ${clause}`, ...bind))?.n ?? 0;
  const rows = (await q(env,
    `SELECT order_number, email, phone, status, total, shipping, tracking_number, notes, created_at
     FROM orders ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...bind, per, (page - 1) * per)).rows;
  return { rows, total, page, per, pages: Math.max(1, Math.ceil(total / per)) };
}
export async function orderYears(env: Env) {
  return (await q(env, `SELECT DISTINCT substr(created_at,1,4) yr FROM orders ORDER BY yr DESC`)).rows.map((r: any) => r.yr).filter(Boolean);
}
export async function listCustomers(env: Env, opts: { search?: string; page?: number; per?: number } = {}) {
  const per = Math.min(100, opts.per || 50); const page = Math.max(1, opts.page || 1);
  const where: string[] = []; const bind: any[] = [];
  if (opts.search) { where.push('(email LIKE ? OR name LIKE ? OR phone LIKE ?)'); const s = `%${opts.search}%`; bind.push(s, s, s); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one<{ n: number }>(env, `SELECT COUNT(*) n FROM customers ${clause}`, ...bind))?.n ?? 0;
  const rows = (await q(env, `SELECT c.email, c.name, c.phone, c.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.email=c.email) orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.email=c.email AND o.status IN ('completed','processing','shipped')) spend
    FROM customers c ${clause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, ...bind, per, (page - 1) * per)).rows;
  return { rows, total, page, per, pages: Math.max(1, Math.ceil(total / per)) };
}
export async function listRequests(env: Env, limit = 200) {
  return (await q(env, `SELECT reference, name, email, phone, scope, details, created FROM data_requests ORDER BY created DESC LIMIT ?`, limit)).rows;
}
export async function listMessages(env: Env, limit = 200) {
  return (await q(env, `SELECT name, email, subject, body, created_at FROM messages ORDER BY created_at DESC LIMIT ?`, limit)).rows;
}
export async function revenueByDay(env: Env, days = 14) {
  return (await q(env,
    `SELECT date(created_at) d, COALESCE(SUM(total),0) total FROM orders
     WHERE status IN ('paid','shipped','fulfilled') AND created_at >= date('now', ?)
     GROUP BY date(created_at) ORDER BY d`, `-${days} days`)).rows;
}
export async function setOrderStatus(env: Env, orderNumber: string, status: string) {
  if (!env?.DB) return false;
  try { await env.DB.prepare(`UPDATE orders SET status=? WHERE order_number=?`).bind(status, orderNumber).run(); return true; }
  catch { return false; }
}

/* ---- Order detail + updates -------------------------------------------- */
export async function getOrder(env: Env, orderNumber: string) {
  if (!env?.DB) return null;
  try {
    const o = await env.DB.prepare(`SELECT * FROM orders WHERE order_number=?`).bind(orderNumber).first();
    if (!o) return null;
    const items = (await env.DB.prepare(`SELECT slug,name,variant,price,quantity FROM order_items WHERE order_number=?`).bind(orderNumber).all()).results || [];
    return { ...o, items };
  } catch { return null; }
}
export async function updateOrder(env: Env, orderNumber: string, fields: Record<string, any>) {
  if (!env?.DB) return false;
  const cols = Object.keys(fields);
  if (!cols.length) return false;
  const set = cols.map((c) => `${c}=?`).join(', ');
  try {
    await env.DB.prepare(`UPDATE orders SET ${set}, updated_at=datetime('now') WHERE order_number=?`)
      .bind(...cols.map((c) => fields[c]), orderNumber).run();
    return true;
  } catch { return false; }
}

/* ---- Discounts & coupons ------------------------------------------------ */
export async function listDiscounts(env: Env) {
  return (await q(env, `SELECT id,label,scope,target,kind,value,active,starts,ends FROM discounts ORDER BY created_at DESC`)).rows;
}
export async function upsertDiscount(env: Env, d: any) {
  if (!env?.DB) return false;
  try {
    if (d.id) {
      await env.DB.prepare(`UPDATE discounts SET label=?,scope=?,target=?,kind=?,value=?,active=?,starts=?,ends=? WHERE id=?`)
        .bind(d.label, d.scope, d.target || '', d.kind, d.value || 0, d.active ? 1 : 0, d.starts || null, d.ends || null, d.id).run();
    } else {
      await env.DB.prepare(`INSERT INTO discounts (label,scope,target,kind,value,active,starts,ends) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(d.label, d.scope, d.target || '', d.kind, d.value || 0, d.active ? 1 : 0, d.starts || null, d.ends || null).run();
    }
    return true;
  } catch { return false; }
}
export async function deleteDiscount(env: Env, id: number) {
  if (!env?.DB) return false;
  try { await env.DB.prepare(`DELETE FROM discounts WHERE id=?`).bind(id).run(); return true; } catch { return false; }
}
export async function listCoupons(env: Env) {
  return (await q(env, `SELECT code,kind,value,min_order,active,uses,max_uses,ends,product_slug FROM coupons ORDER BY created_at DESC`)).rows;
}
export async function upsertCoupon(env: Env, c: any) {
  if (!env?.DB) return false;
  try {
    await env.DB.prepare(`INSERT INTO coupons (code,kind,value,min_order,active,ends,product_slug) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,min_order=excluded.min_order,active=excluded.active,ends=excluded.ends,product_slug=excluded.product_slug`)
      .bind(String(c.code).toUpperCase(), c.kind, c.value || 0, c.min_order || 0, c.active ? 1 : 0, c.ends || null, c.product_slug || null).run();
    return true;
  } catch { return false; }
}
export async function deleteCoupon(env: Env, code: string) {
  if (!env?.DB) return false;
  try { await env.DB.prepare(`DELETE FROM coupons WHERE code=?`).bind(code).run(); return true; } catch { return false; }
}

/* ---- Category overrides ------------------------------------------------- */
export async function listCategoryOverrides(env: Env) {
  const r = await q(env, `SELECT slug,name,description,meta_title,meta_description,hidden,sort FROM category_overrides`);
  return Object.fromEntries((r.rows || []).map((c: any) => [c.slug, c]));
}
export async function upsertCategory(env: Env, c: any) {
  if (!env?.DB) return false;
  try {
    await env.DB.prepare(`INSERT INTO category_overrides (slug,name,description,meta_title,meta_description,hidden,sort,updated_at)
      VALUES (?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,meta_title=excluded.meta_title,
        meta_description=excluded.meta_description,hidden=excluded.hidden,sort=excluded.sort,updated_at=datetime('now')`)
      .bind(c.slug, c.name || null, c.description || null, c.meta_title || null, c.meta_description || null, c.hidden ? 1 : 0, c.sort || 0).run();
    return true;
  } catch { return false; }
}

/* ---- Product overrides -------------------------------------------------- */
export async function getProductOverride(env: Env, slug: string) {
  if (!env?.DB) return null;
  try { return await env.DB.prepare(`SELECT * FROM product_overrides WHERE slug=?`).bind(slug).first(); } catch { return null; }
}
export async function listProductOverrides(env: Env) {
  const r = await q(env, `SELECT slug,title,price,sale_price,featured,active,meta_title,updated_at FROM product_overrides`);
  return Object.fromEntries((r.rows || []).map((p: any) => [p.slug, p]));
}
export async function upsertProduct(env: Env, p: any) {
  if (!env?.DB) return false;
  try {
    await env.DB.prepare(`INSERT INTO product_overrides
      (slug,title,short_html,description_html,price,sale_price,price_max,meta_title,meta_description,images_json,variations_json,featured,active,weight,ship_flat,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET title=excluded.title,short_html=excluded.short_html,description_html=excluded.description_html,
        price=excluded.price,sale_price=excluded.sale_price,price_max=excluded.price_max,meta_title=excluded.meta_title,
        meta_description=excluded.meta_description,images_json=excluded.images_json,variations_json=excluded.variations_json,
        featured=excluded.featured,active=excluded.active,weight=excluded.weight,ship_flat=excluded.ship_flat,updated_at=datetime('now')`)
      .bind(p.slug, p.title || null, p.short_html || null, p.description_html || null,
        p.price ?? null, p.sale_price ?? null, p.price_max ?? null, p.meta_title || null, p.meta_description || null,
        p.images_json || null, p.variations_json || null,
        p.featured == null ? null : (p.featured ? 1 : 0), p.active == null ? 1 : (p.active ? 1 : 0),
        p.weight ?? null, p.ship_flat ?? null).run();
    return true;
  } catch { return false; }
}

/* ---- Stats & analytics -------------------------------------------------- */
const PAID = "status IN ('completed','processing','shipped')";
export async function statsSummary(env: Env) {
  const s = await one<any>(env, `SELECT
      COALESCE(SUM(CASE WHEN ${PAID} THEN total END),0) revenue,
      COUNT(*) orders,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) processing,
      SUM(CASE WHEN status='on-hold' THEN 1 ELSE 0 END) onhold,
      SUM(CASE WHEN ${PAID} THEN 1 ELSE 0 END) paid_orders
    FROM orders`);
  return s || { revenue: 0, orders: 0, pending: 0, processing: 0, onhold: 0, paid_orders: 0 };
}
export async function revenueByMonth(env: Env, months = 12) {
  return (await q(env,
    `SELECT substr(created_at,1,7) m, COALESCE(SUM(total),0) total, COUNT(*) n
     FROM orders WHERE ${PAID} AND created_at >= date('now', ?)
     GROUP BY m ORDER BY m`, `-${months} months`)).rows;
}
export async function topProducts(env: Env, limit = 10) {
  return (await q(env,
    `SELECT name, SUM(quantity) qty, SUM(price*quantity) revenue
     FROM order_items oi JOIN orders o ON o.order_number=oi.order_number
     WHERE o.${PAID} GROUP BY name ORDER BY revenue DESC LIMIT ?`, limit)).rows;
}
export async function topCustomers(env: Env, limit = 10) {
  return (await q(env,
    `SELECT o.email, c.name, COUNT(*) orders, SUM(o.total) spend
     FROM orders o LEFT JOIN customers c ON c.email=o.email
     WHERE o.${PAID} GROUP BY o.email ORDER BY spend DESC LIMIT ?`, limit)).rows;
}
export async function newOrders(env: Env, limit = 8) {
  return (await q(env,
    `SELECT order_number, email, status, total, created_at FROM orders
     WHERE status IN ('pending','processing','on-hold') ORDER BY created_at DESC LIMIT ?`, limit)).rows;
}

/* ---- Key/value settings (Razorpay keys, etc.) --------------------------- */
export async function getSetting(env: Env, key: string): Promise<string | null> {
  if (!env?.DB) return null;
  try { const r = await env.DB.prepare(`SELECT value FROM settings WHERE key=?`).bind(key).first(); return r?.value ?? null; }
  catch { return null; }
}
export async function setSetting(env: Env, key: string, value: string) {
  if (!env?.DB) return false;
  try { await env.DB.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(key, value).run(); return true; }
  catch { return false; }
}

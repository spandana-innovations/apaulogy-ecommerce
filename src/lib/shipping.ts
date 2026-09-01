import catalog from '../data/catalog.json';
type Env = Record<string, any>;
const WEIGHTS: Record<string, number> = Object.fromEntries(
  (catalog as any).products.filter((p: any) => p.weight).map((p: any) => [p.slug, p.weight]));

const DEFAULT_DOMESTIC = [
  { up_to_kg: 0.5, price: 8500, per_kg_over: 0 },
  { up_to_kg: 1.0, price: 14000, per_kg_over: 0 },
  { up_to_kg: 2.0, price: 25000, per_kg_over: 0 },
  { up_to_kg: 5.0, price: 48000, per_kg_over: 0 },
  { up_to_kg: null, price: 64000, per_kg_over: 12000 },
];

export function cartWeight(items: { slug: string; qty: number }[]): number {
  return items.reduce((w, it) => w + (WEIGHTS[it.slug] || 0.3) * (it.qty || 1), 0);
}

export async function freeShippingSlugs(env: Env): Promise<Set<string>> {
  if (!env?.DB) return new Set();
  try { const r = await env.DB.prepare(`SELECT slug FROM free_shipping_products`).all(); return new Set((r.results||[]).map((x:any)=>x.slug)); }
  catch { return new Set(); }
}

export async function getRates(env: Env, zone = 'domestic') {
  if (env?.DB) {
    try {
      const r = await env.DB.prepare(
        `SELECT up_to_kg,price,per_kg_over FROM shipping_rates WHERE zone=? ORDER BY sort`).bind(zone).all();
      if (r.results?.length) return r.results as any[];
    } catch {}
  }
  return DEFAULT_DOMESTIC;
}

export function shippingFor(weightKg: number, rates: any[]): number {
  for (const b of rates) {
    if (b.up_to_kg == null) {
      const over = Math.max(0, Math.ceil(weightKg - (rates[rates.length - 2]?.up_to_kg || 0)));
      return b.price + over * (b.per_kg_over || 0);
    }
    if (weightKg <= b.up_to_kg) return b.price;
  }
  return rates.length ? rates[rates.length - 1].price : 0;
}

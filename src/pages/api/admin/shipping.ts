import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  if (!env.DB || !b.zone || !Array.isArray(b.rates)) return new Response(JSON.stringify({ ok:false }), { status: env.DB?400:503 });
  try {
    await env.DB.prepare(`DELETE FROM shipping_rates WHERE zone=?`).bind(b.zone).run();
    for (const r of b.rates) {
      await env.DB.prepare(`INSERT INTO shipping_rates (zone,up_to_kg,price,per_kg_over,sort) VALUES (?,?,?,?,?)`)
        .bind(b.zone, r.up_to_kg ?? null, r.price||0, r.per_kg_over||0, r.sort||0).run();
    }
    return new Response(JSON.stringify({ ok:true }), { headers:{'Content-Type':'application/json'} });
  } catch (e:any) { return new Response(JSON.stringify({ ok:false, error:e.message }), { status:500 }); }
};

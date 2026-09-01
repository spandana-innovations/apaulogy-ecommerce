import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b:any={}; try{ b=await request.json(); }catch{}
  if (!env.DB) return new Response(JSON.stringify({ok:false}),{status:503});
  try {
    if (b.add) await env.DB.prepare(`INSERT OR IGNORE INTO free_shipping_products (slug) VALUES (?)`).bind(b.add).run();
    if (b.remove) await env.DB.prepare(`DELETE FROM free_shipping_products WHERE slug=?`).bind(b.remove).run();
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
  } catch(e:any){ return new Response(JSON.stringify({ok:false,error:e.message}),{status:500}); }
};

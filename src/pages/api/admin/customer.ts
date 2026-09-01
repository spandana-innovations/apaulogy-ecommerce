import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b:any={}; try{ b=await request.json(); }catch{}
  if (!env.DB || !b.email) return new Response(JSON.stringify({ok:false}),{status:env.DB?400:503});
  try {
    await env.DB.prepare(`INSERT INTO customers (email,name,phone) VALUES (?,?,?)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone`).bind(b.email,b.name||'',b.phone||'').run();
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
  } catch(e:any){ return new Response(JSON.stringify({ok:false,error:e.message}),{status:500}); }
};

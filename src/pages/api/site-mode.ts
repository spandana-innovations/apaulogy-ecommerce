import type { APIRoute } from 'astro';
import { getSiteMode } from '../../lib/admin-data';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let mode = 'production';
  try { mode = await getSiteMode(env); } catch {}
  return new Response(JSON.stringify({ mode }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
};

import type { APIRoute } from 'astro';
import { getSiteMode, getSetting } from '../../lib/admin-data';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let mode = 'production'; let heroSpeed = 1;
  try { mode = await getSiteMode(env); } catch {}
  try { const hs = await getSetting(env, 'hero_speed'); if (hs) heroSpeed = Math.max(0.25, Math.min(2, Number(hs) || 1)); } catch {}
  return new Response(JSON.stringify({ mode, heroSpeed }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
};

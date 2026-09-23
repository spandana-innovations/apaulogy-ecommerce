import type { APIRoute } from 'astro';
import { getSiteMode, getSetting } from '../../lib/admin-data';
import { gatewaySettings } from '../../lib/payments';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let mode = 'production';
  try { mode = await getSiteMode(env); } catch {}
  let heroSpeed = 1; try { const hs = await getSetting(env, 'hero_speed'); if (hs) heroSpeed = Math.max(0.25, Math.min(2, Number(hs) || 1)); } catch {}
  let gateways: any = null; try { gateways = await gatewaySettings(env); } catch {}
  return new Response(JSON.stringify({ mode, heroSpeed, gateways }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } });
};

import type { APIRoute } from 'astro';
import { gatewaySettings } from '../../lib/payments';

export const prerender = false;

/**
 * Public, non-secret payment configuration for the storefront checkout:
 * which gateways are enabled and which regions each serves. Never returns keys.
 */
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const g = await gatewaySettings(env);
  return new Response(JSON.stringify({
    razorpay: { enabled: g.razorpay.enabled, scope: g.razorpay.scope },
    phonepe: { enabled: g.phonepe.enabled, scope: g.phonepe.scope },
  }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

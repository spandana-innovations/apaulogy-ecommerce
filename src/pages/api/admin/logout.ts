import type { APIRoute } from 'astro';
import { clearCookie, clearRoleHint } from '../../../lib/admin-auth';
export const prerender = false;
export const POST: APIRoute = async () => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearCookie());
  headers.append('Set-Cookie', clearRoleHint());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};

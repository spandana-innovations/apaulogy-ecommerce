import type { APIRoute } from 'astro';
import { clearCookie } from '../../../lib/admin-auth';
export const prerender = false;
export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie() } });

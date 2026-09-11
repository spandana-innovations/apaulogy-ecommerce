import { defineMiddleware } from 'astro:middleware';
import { verifySession, readCookie, ADMIN_COOKIE } from './lib/admin-auth';
import { tursoDB, tursoConfigured } from './lib/turso';

const PUBLIC = ['/apaulogy-admin/login', '/api/admin/login', '/api/admin/logout'];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const env = (context.locals as any)?.runtime?.env ?? {};

  // Database: use Turso when configured (D1-compatible shim); else fall back to D1.
  try { if (tursoConfigured(env) && !env.__dbInjected) { env.DB = tursoDB(env); env.__dbInjected = true; } } catch {}

  const guarded = path.startsWith('/apaulogy-admin') || path.startsWith('/api/admin');
  if (!guarded || PUBLIC.includes(path)) return next();

  const token = readCookie(context.request, ADMIN_COOKIE);
  const ok = await verifySession(token, env);
  if (ok) return next();

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return context.redirect('/apaulogy-admin/login');
});

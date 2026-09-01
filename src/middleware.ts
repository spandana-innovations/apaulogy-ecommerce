import { defineMiddleware } from 'astro:middleware';
import { verifySession, readCookie, ADMIN_COOKIE } from './lib/admin-auth';

const PUBLIC = ['/apaulogy-admin/login', '/api/admin/login', '/api/admin/logout'];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const guarded = path.startsWith('/apaulogy-admin') || path.startsWith('/api/admin');
  if (!guarded || PUBLIC.includes(path)) return next();

  const env = (context.locals as any)?.runtime?.env ?? {};
  const token = readCookie(context.request, ADMIN_COOKIE);
  const ok = await verifySession(token, env);
  if (ok) return next();

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return context.redirect('/apaulogy-admin/login');
});

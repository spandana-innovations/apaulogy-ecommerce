import { defineMiddleware } from 'astro:middleware';
import { verifySession, readCookie, ADMIN_COOKIE } from './lib/admin-auth';

const PUBLIC = ['/apaulogy-admin/login', '/api/admin/login', '/api/admin/logout'];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const guarded = path.startsWith('/apaulogy-admin') || path.startsWith('/api/admin');
  if (!guarded || PUBLIC.includes(path)) return next();

  // #16 — the admin is desktop-only; block phones.
  const ua = context.request.headers.get('user-agent') || '';
  const isMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua) && !/iPad|Tablet/i.test(ua);
  if (isMobile && path.startsWith('/apaulogy-admin')) {
    return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:Georgia,serif;max-width:420px;margin:22vh auto;padding:0 1.5rem;text-align:center;color:#111"><h1 style="font-weight:600">Desktop only</h1><p style="color:#666;font-family:system-ui">The aPaulogy admin is available on a computer, not on mobile. Please sign in from a desktop.</p><a href="/" style="color:#111">← Back to the store</a></div>',
      { status: 403, headers: { 'Content-Type': 'text/html' } });
  }

  const env = (context.locals as any)?.runtime?.env ?? {};
  const token = readCookie(context.request, ADMIN_COOKIE);
  const ok = await verifySession(token, env);
  if (ok) return next();

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return context.redirect('/apaulogy-admin/login');
});

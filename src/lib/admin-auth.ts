/* Minimal, dependency-free admin auth for the Cloudflare edge.
   Session = base64url(payload).base64url(HMAC-SHA256(payload, secret)).
   Credentials & secret come from env with safe defaults for first run. */

const COOKIE = 'apaulogy_admin';
const TTL_SECONDS = 60 * 60 * 8; // 8 hours

type Env = Record<string, any>;

function creds(env: Env) {
  return {
    user: env.ADMIN_USER || 'admin',
    pass: env.ADMIN_PASS || 'admin123',
    secret: env.ADMIN_SECRET || 'apaulogy-dev-secret-change-me',
  };
}

const enc = new TextEncoder();
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToStr(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(s);
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return b64url(sig);
}

export async function createSession(env: Env): Promise<string> {
  const { secret } = creds(env);
  const payload = JSON.stringify({ u: 'admin', exp: Math.floor(Date.now() / 1000) + TTL_SECONDS });
  const p64 = b64url(enc.encode(payload));
  const sig = await sign(p64, secret);
  return `${p64}.${sig}`;
}

export async function verifySession(token: string | undefined, env: Env): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [p64, sig] = token.split('.');
  const { secret } = creds(env);
  const expected = await sign(p64, secret);
  if (sig !== expected) return false;
  try {
    const data = JSON.parse(b64urlToStr(p64));
    return typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function checkCredentials(user: string, pass: string, env: Env): boolean {
  const c = creds(env);
  return user === c.user && pass === c.pass;
}

export function readCookie(request: Request, name = COOKIE): string | undefined {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_SECONDS}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export const ADMIN_COOKIE = COOKIE;

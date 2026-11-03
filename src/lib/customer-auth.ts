/* Customer accounts for the storefront — dependency-free, edge-safe.
   Passwords: PBKDF2-SHA256 (100k iters) with a per-user random salt.
   Session: base64url(payload).HMAC-SHA256(payload, secret), like the admin. */

const COOKIE = 'apaulogy_customer';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PBKDF2_ITERS = 100_000;

type Env = Record<string, any>;
const enc = new TextEncoder();

function secretOf(env: Env): string {
  return env.CUSTOMER_SECRET || env.ADMIN_SECRET || 'apaulogy-dev-secret-change-me';
}

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToStr(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

/* ---- Password hashing ---- */
async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return { hash: b64(bits), salt: b64(salt) };
}
export async function verifyPassword(password: string, hashB64: string, saltB64: string): Promise<boolean> {
  if (!hashB64 || !saltB64) return false;
  try {
    const bits = await derive(password, fromB64(saltB64));
    const want = fromB64(hashB64);
    if (bits.length !== want.length) return false;
    let diff = 0; for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ want[i];
    return diff === 0;
  } catch { return false; }
}

/* ---- Session cookie ---- */
async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return b64url(sig);
}
export async function createCustomerSession(env: Env, email: string, name: string): Promise<string> {
  const payload = JSON.stringify({ e: email, n: name, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS });
  const p64 = b64url(enc.encode(payload));
  return `${p64}.${await sign(p64, secretOf(env))}`;
}
export async function readCustomerSession(token: string | undefined, env: Env): Promise<{ email: string; name: string } | null> {
  if (!token || !token.includes('.')) return null;
  const [p64, sig] = token.split('.');
  if (sig !== await sign(p64, secretOf(env))) return null;
  try {
    const d = JSON.parse(b64urlToStr(p64));
    if (typeof d.exp !== 'number' || d.exp <= Math.floor(Date.now() / 1000)) return null;
    return { email: d.e, name: d.n };
  } catch { return null; }
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
export const CUSTOMER_COOKIE = COOKIE;

/* ---- Table bootstrap (idempotent; works whether or not the table pre-exists) ---- */
export async function ensureCustomerAuth(db: any): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS customers (
      email TEXT PRIMARY KEY, name TEXT, phone TEXT,
      password_hash TEXT, password_salt TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch {}
  // Existing installs already have the table without the password columns — add them.
  for (const col of ['password_hash TEXT', 'password_salt TEXT']) {
    try { await db.prepare(`ALTER TABLE customers ADD COLUMN ${col}`).run(); } catch {}
  }
}

export async function getCustomer(db: any, email: string): Promise<any | null> {
  try { return await db.prepare(`SELECT email, name, phone, password_hash, password_salt FROM customers WHERE LOWER(email)=LOWER(?)`).bind(email).first(); }
  catch { return null; }
}

/* ---- Password-reset tokens ----
   Stateless + single-use: the token binds to the account's current password
   hash, so once the password changes the token no longer validates. 1h TTL. */
const RESET_TTL = 60 * 60;
export async function createResetToken(env: Env, email: string, pwHash: string): Promise<string> {
  const payload = JSON.stringify({ e: email.toLowerCase(), h: (pwHash || '').slice(0, 24), exp: Math.floor(Date.now() / 1000) + RESET_TTL });
  const p64 = b64url(enc.encode(payload));
  return `${p64}.${await sign(p64, secretOf(env))}`;
}
export async function verifyResetToken(token: string | undefined, env: Env): Promise<{ email: string; hashPrefix: string } | null> {
  if (!token || !token.includes('.')) return null;
  const [p64, sig] = token.split('.');
  if (sig !== await sign(p64, secretOf(env))) return null;
  try {
    const d = JSON.parse(b64urlToStr(p64));
    if (typeof d.exp !== 'number' || d.exp <= Math.floor(Date.now() / 1000)) return null;
    return { email: d.e, hashPrefix: d.h };
  } catch { return null; }
}

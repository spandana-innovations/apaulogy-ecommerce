/* Non-text captcha using Paul's artwork. The server names a place; the visitor
   must click the matching watercolour. The correct tile index is encoded only
   in an HMAC signature (never exposed in the DOM), so a scraper can't cheat. */
import catalog from '../data/catalog.json';

type Env = Record<string, any>;
const enc = new TextEncoder();

// Curated, visually-distinct Bangalore subjects with clear imagery.
const POOL = [
  'plaza-theatre','coffee-house','victoria-hotel','only-place','brigade-road',
  'ulsoor-lake','russel-market','commercial-street','vidhana-soudha','airlines-hotel',
  'bangalore-club','cubbon-park-rocks','holy-ghost-church','south-parade','west-end-hotel',
  'dewars-bar','shoolay-police-station','museum-road-post-office',
];

function b64url(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function secretOf(env: Env) { return env.ADMIN_SECRET || 'apaulogy-dev-secret-change-me'; }

export interface Captcha {
  prompt: string;
  tiles: { i: number; img: string }[];
  nonce: string; exp: number; sig: string;
}

export async function makeCaptcha(env: Env): Promise<Captcha> {
  const byslug = new Map((catalog as any).products.map((p: any) => [p.slug, p]));
  const avail = POOL.filter((s) => byslug.get(s)?.images?.[0]?.url);
  // shuffle & take 6
  const pick = [...avail].sort(() => Math.random() - 0.5).slice(0, 6);
  const targetPos = Math.floor(Math.random() * pick.length);
  const targetSlug = pick[targetPos];
  const target = byslug.get(targetSlug);
  const tiles = pick.map((slug, i) => ({ i, img: byslug.get(slug).images[0].url }));
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)).buffer);
  const exp = Math.floor(Date.now() / 1000) + 600; // 10 min
  const sig = await hmac(`${targetPos}|${nonce}|${exp}`, secretOf(env));
  return { prompt: target.name, tiles, nonce, exp, sig };
}

export async function verifyCaptcha(env: Env, chosen: number, nonce: string, exp: number, sig: string): Promise<boolean> {
  if (!Number.isInteger(chosen) || !nonce || !sig) return false;
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(`${chosen}|${nonce}|${exp}`, secretOf(env));
  return expected === sig;
}

import { getSetting } from './admin-data';
type Env = Record<string, any>;

export async function paymentMode(env: Env): Promise<'test' | 'live'> {
  const m = await getSetting(env, 'payment_mode');
  // The store is live by default; switch to TEST explicitly from Settings → Payment mode.
  return m === 'test' ? 'test' : 'live';
}

export async function razorpayKeys(env: Env) {
  const mode = await paymentMode(env);
  if (mode === 'test') {
    return {
      mode,
      keyId: (await getSetting(env, 'razorpay_test_key_id')) || '',
      keySecret: (await getSetting(env, 'razorpay_test_key_secret')) || '',
    };
  }
  return {
    mode,
    keyId: env.RAZORPAY_KEY_ID || (await getSetting(env, 'razorpay_key_id')) || '',
    keySecret: env.RAZORPAY_KEY_SECRET || (await getSetting(env, 'razorpay_key_secret')) || '',
  };
}

/** Webhook signing secret — env first, then the value saved in admin Settings. */
export async function razorpayWebhookSecret(env: Env): Promise<string> {
  return env.RAZORPAY_WEBHOOK_SECRET || (await getSetting(env, 'razorpay_webhook_secret')) || '';
}

/* ---- Per-gateway availability (enabled + region scope) ------------------- */
export type Scope = 'domestic' | 'international' | 'both';
export interface GatewayRule { enabled: boolean; scope: Scope; }
export interface GatewaySettings { mode: 'test' | 'live'; razorpay: GatewayRule; phonepe: GatewayRule; }

const asScope = (v: any, d: Scope): Scope => (v === 'domestic' || v === 'international' || v === 'both') ? v : d;
const asBool = (v: any, d: boolean): boolean => v == null ? d : (v === '1' || v === 'true' || v === 1 || v === true);

/** Read enable/scope for every gateway (with sensible defaults). No secrets. */
export async function gatewaySettings(env: Env): Promise<GatewaySettings> {
  const [mode, rzE, rzS, ppE, ppS] = await Promise.all([
    paymentMode(env),
    getSetting(env, 'razorpay_enabled'),
    getSetting(env, 'razorpay_scope'),
    getSetting(env, 'phonepe_enabled'),
    getSetting(env, 'phonepe_scope'),
  ]);
  return {
    mode,
    razorpay: { enabled: asBool(rzE, true), scope: asScope(rzS, 'both') },      // default: on, both regions
    phonepe:  { enabled: asBool(ppE, true), scope: asScope(ppS, 'domestic') },  // default: on, domestic only
  };
}

/** 'domestic' for India (or blank), 'international' otherwise. */
export function zoneOf(country?: string): 'domestic' | 'international' {
  return (country && !/india/i.test(country)) ? 'international' : 'domestic';
}

/** Does a gateway's region scope cover this zone? */
export function scopeAllows(scope: Scope, zone: 'domestic' | 'international'): boolean {
  return scope === 'both' || scope === zone;
}

/** Is a gateway usable for this zone right now (enabled + in-scope)? */
export function gatewayAllowed(rule: GatewayRule, zone: 'domestic' | 'international'): boolean {
  return rule.enabled && scopeAllows(rule.scope, zone);
}

export async function phonepeConfig(env: Env) {
  const mode = await paymentMode(env);
  if (mode === 'test') {
    return {
      mode,
      host: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      merchantId: (await getSetting(env, 'phonepe_test_merchant_id')) || 'PGTESTPAYUAT',
      saltKey: (await getSetting(env, 'phonepe_test_salt_key')) || '',
      saltIndex: (await getSetting(env, 'phonepe_test_salt_index')) || '1',
    };
  }
  return {
    mode,
    host: 'https://api.phonepe.com/apis/hermes',
    merchantId: (await getSetting(env, 'phonepe_merchant_id')) || '',
    saltKey: (await getSetting(env, 'phonepe_salt_key')) || '',
    saltIndex: (await getSetting(env, 'phonepe_salt_index')) || '1',
  };
}

// SHA256 hex (Web Crypto) — used for PhonePe X-VERIFY checksums.
export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

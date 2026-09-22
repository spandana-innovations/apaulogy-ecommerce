import { getSetting } from './admin-data';
type Env = Record<string, any>;

export async function paymentMode(env: Env): Promise<'test' | 'live'> {
  const m = await getSetting(env, 'payment_mode');
  return m === 'live' ? 'live' : 'test';   // default to TEST until explicitly set live
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

export async function phonepeConfig(env: Env) {
  const mode = await paymentMode(env);
  if (mode === 'test') {
    return {
      mode,
      // v2 Standard Checkout — Sandbox
      authHost: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      payHost: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      clientId: (await getSetting(env, 'phonepe_test_client_id')) || '',
      clientSecret: (await getSetting(env, 'phonepe_test_client_secret')) || '',
      clientVersion: (await getSetting(env, 'phonepe_test_client_version')) || '1',
    };
  }
  return {
    mode,
    // v2 Standard Checkout — Production (auth + pay live on different hosts)
    authHost: 'https://api.phonepe.com/apis/identity-manager',
    payHost: 'https://api.phonepe.com/apis/pg',
    clientId: env.PHONEPE_CLIENT_ID || (await getSetting(env, 'phonepe_client_id')) || '',
    clientSecret: env.PHONEPE_CLIENT_SECRET || (await getSetting(env, 'phonepe_client_secret')) || '',
    clientVersion: (await getSetting(env, 'phonepe_client_version')) || '1',
  };
}

// --- OAuth token (v2). Cached in module scope until shortly before expiry. ---
let _ppToken: { token: string; exp: number; key: string } | null = null;
export async function phonepeToken(env: Env, cfg: any): Promise<string> {
  const key = cfg.clientId + '|' + cfg.mode;
  if (_ppToken && _ppToken.key === key && Date.now() < _ppToken.exp - 60000) return _ppToken.token;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_version: String(cfg.clientVersion || '1'),
    client_secret: cfg.clientSecret,
    grant_type: 'client_credentials',
  });
  const r = await fetch(cfg.authHost + '/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const d: any = await r.json();
  if (!r.ok || !d?.access_token) throw new Error(d?.message || d?.code || `PhonePe auth failed (${r.status})`);
  const expMs = d.expires_at ? d.expires_at * 1000 : Date.now() + 600000;
  _ppToken = { token: d.access_token, exp: expMs, key };
  return d.access_token;
}

// SHA256 hex (Web Crypto) — used for PhonePe X-VERIFY checksums.
export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

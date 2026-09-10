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

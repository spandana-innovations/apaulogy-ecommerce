import type { APIRoute } from 'astro';
import { ensureCustomerAuth, getCustomer, createResetToken } from '../../../lib/customer-auth';
import { sendEmail, emailConfig } from '../../../lib/email';
export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  let b: any = {}; try { b = await request.json(); } catch {}
  const email = String(b.email || '').trim().toLowerCase();
  // Always respond the same way — never reveal whether an account exists.
  const done = j({ ok: true });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !env.DB) return done;

  try {
    await ensureCustomerAuth(env.DB);
    const c = await getCustomer(env.DB, email);
    if (c && c.password_hash) {
      const token = await createResetToken(env, email, c.password_hash);
      const { site } = await emailConfig(env);
      const link = `${site}/account/reset/?token=${encodeURIComponent(token)}`;
      const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:'EB Garamond',Georgia,serif;color:#000">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" style="max-width:480px">
          <tr><td style="font-family:Georgia,serif;font-size:22px;padding-bottom:8px">Reset your password</td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;padding-bottom:20px">
            We received a request to reset the password for your aPaulogy account. Click the button below to choose a new one. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.
          </td></tr>
          <tr><td style="padding-bottom:24px"><a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:12px 22px">Reset password</a></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:12px;color:#888;word-break:break-all">Or paste this link into your browser:<br/>${link}</td></tr>
        </table></td></tr></table></body></html>`;
      await sendEmail(env, email, 'Reset your aPaulogy password', html, 'password_reset');
    }
  } catch {}
  return done;
};

import 'server-only';

/**
 * Typed, lazy access to configuration. Nothing here throws at import time: every integration
 * degrades gracefully when its variables are missing (see /api/health and docs/DEPLOY.md).
 */

const str = (name: string): string | undefined => {
  const v = process.env[name];
  if (!v || v.trim() === '' || /REPLACE_ME|REPLACE_WITH/.test(v)) return undefined;
  return v;
};

export type MonetizationMode = 'validation' | 'stripe';

export const isProduction = (): boolean =>
  process.env.VERCEL_ENV === 'production' || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && process.env.CI !== 'true' && process.env.E2E !== '1');

export const env = {
  /** `validation` is the default; Stripe is completely unreachable unless this is `stripe`. */
  monetizationMode(): MonetizationMode {
    return process.env.MONETIZATION_MODE === 'stripe' ? 'stripe' : 'validation';
  },
  ownerEmail: () => str('OWNER_EMAIL'),
  adminEmails: (): string[] =>
    (str('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),

  supabaseUrl: () => str('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => str('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: () => str('SUPABASE_SERVICE_ROLE_KEY'),
  encryptionKeyB64: () => str('DATA_ENCRYPTION_KEY_BASE64'),

  driveFolderId: () => str('GOOGLE_DRIVE_FOLDER_ID'),
  driveServiceEmail: () => str('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  drivePrivateKey: () => str('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n'),

  resendKey: () => str('RESEND_API_KEY'),
  resendFrom: () => str('RESEND_FROM_EMAIL') ?? 'ChronoSleep <onboarding@resend.dev>',

  turnstileSecret: () => str('TURNSTILE_SECRET_KEY'),
  turnstileSiteKey: () => str('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
  allowNoTurnstile: () => process.env.ALLOW_NO_TURNSTILE === '1',

  upstashUrl: () => str('UPSTASH_REDIS_REST_URL'),
  upstashToken: () => str('UPSTASH_REDIS_REST_TOKEN'),

  stripeSecret: () => str('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => str('STRIPE_WEBHOOK_SECRET'),
  stripePriceId: () => str('STRIPE_PRICE_USD'),

  posthogKey: () => str('NEXT_PUBLIC_POSTHOG_KEY'),
  posthogHost: () => str('NEXT_PUBLIC_POSTHOG_HOST') ?? 'https://us.i.posthog.com',

  cronSecret: () => str('CRON_SECRET'),
  /** Test-only admin login (never honoured on Vercel production). */
  adminTestSecret: () => (process.env.VERCEL_ENV === 'production' ? undefined : str('ADMIN_TEST_LOGIN_SECRET')),

  retention: () => ({
    calculationDays: Number(process.env.RETENTION_CALCULATION_DAYS ?? 30),
    leadDays: Number(process.env.RETENTION_LEAD_DAYS ?? 90),
    reportTokenDays: Number(process.env.REPORT_TOKEN_DAYS ?? 30),
  }),

  /** E2E/dev helpers (outbox inspection, memory store dumps) — never on in production. */
  devToolsEnabled: () => process.env.E2E === '1' || process.env.NODE_ENV === 'development',
};

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes('localhost')) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, '');
  return (explicit ?? 'http://localhost:3000').replace(/\/$/, '');
}

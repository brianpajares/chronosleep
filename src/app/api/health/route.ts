import { MODEL_VERSION } from '@/domain/chronosleep';
import { json, withApi } from '@/server/api';
import { adminAuthConfigured } from '@/server/auth/admin';
import { encryptionConfigured } from '@/server/crypto';
import { driveHealth } from '@/server/drive';
import { env } from '@/server/env';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

/**
 * Health = app + DB (spec) plus a secret-free `integrations` block (playbook §8): which pieces are
 * configured, never their values. Drive only degrades the status when a last-known-good copy is being
 * served; it never fails production (the calculator does not depend on Drive per request).
 */
export const GET = withApi({ name: 'health' }, async (_req, { requestId }) => {
  const store = getStore();
  try {
    await store.ping();
  } catch {
    return json({ status: 'degraded', db: 'error', drive: 'unknown', model_version: MODEL_VERSION }, requestId, { status: 503 });
  }
  const drive = await driveHealth();
  const key = env.resendKey();
  return json(
    {
      status: drive.status === 'ok' ? 'ok' : 'degraded',
      db: 'ok',
      drive: drive.status,
      model_version: MODEL_VERSION,
      db_driver: store.driver,
      drive_source: drive.source,
      drive_configured: drive.configured,
      mode: env.monetizationMode(),
      integrations: {
        email: Boolean(key && env.ownerEmail()),
        resend_api_key: !key ? 'missing' : key.startsWith('re_') ? 'ok' : 'unexpected_format',
        database_persistent: store.driver === 'supabase',
        encryption_key: encryptionConfigured(),
        payments: env.monetizationMode() === 'stripe' ? Boolean(env.stripeSecret() && env.stripeWebhookSecret()) : false,
        stripe_live_blocked: Boolean(env.stripeSecret()?.startsWith('sk_live_')) && process.env.STRIPE_LIVE_APPROVED !== 'true',
        turnstile: Boolean(env.turnstileSecret()),
        rate_limit: env.upstashUrl() ? 'redis' : 'memory',
        admin: adminAuthConfigured(),
        cron: Boolean(env.cronSecret()),
        analytics: { posthog: Boolean(env.posthogKey()), ga4: Boolean(process.env.NEXT_PUBLIC_GA_ID) },
        deployment: process.env.VERCEL_ENV ?? 'local',
      },
      build: {
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
    },
    requestId,
  );
});

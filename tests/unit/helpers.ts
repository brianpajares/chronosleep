import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import vectors from '../../spec/test_vectors.json';
import { devOutbox } from '@/server/email/send';
import { resetRateLimitsForTests } from '@/server/ratelimit';
import { resetStoreForTests } from '@/server/store';

export const TV01 = vectors[0]!.inputs;

export function setupEnv(extra: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = {
    E2E: '1',
    OWNER_EMAIL: 'owner@example.test',
    ADMIN_EMAILS: 'admin@example.test',
    DATA_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'),
    NEXT_PUBLIC_APP_URL: 'https://chronosleep.test',
    MONETIZATION_MODE: undefined,
    RESEND_API_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    TURNSTILE_SECRET_KEY: undefined,
    UPSTASH_REDIS_REST_URL: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    CRON_SECRET: undefined,
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetStoreForTests();
  resetRateLimitsForTests();
  devOutbox.clear();
}

export function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://chronosleep.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://chronosleep.test${path}`, { headers });
}

export const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });

/** Extracts the report token from the delivery email link. */
export function tokenFromEmail(html: string): { id: string; token: string } {
  const m = html.match(/\/informe\/([0-9a-f-]{36})\?token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('no report link in email');
  return { id: m[1]!, token: m[2]! };
}

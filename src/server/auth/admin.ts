import 'server-only';
import { createHmac } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApiError } from '../api';
import { safeEqualHex } from '../crypto';
import { env } from '../env';

export const TEST_COOKIE = 'cs_admin_test';

export interface AdminSession {
  userId: string;
  email: string;
  via: 'supabase' | 'test';
}

export function adminAuthConfigured(): boolean {
  return Boolean(env.supabaseUrl() && env.supabaseAnonKey()) || Boolean(env.adminTestSecret());
}

export function testCookieValue(secret: string): string {
  return createHmac('sha256', secret).update('chronosleep-admin-test').digest('hex');
}

/** Supabase client bound to the request cookies (PKCE magic-link session). */
export async function createSupabaseServerClient() {
  const url = env.supabaseUrl();
  const key = env.supabaseAnonKey();
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component: the proxy/route handlers refresh cookies */
        }
      },
    },
  });
}

/**
 * FR-17/FR-18: only ADMIN_EMAILS may enter, and only with a verified Supabase session
 * (magic link). A test-only cookie login exists for e2e/staging and is never honoured in production.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const allowed = env.adminEmails();

  const testSecret = env.adminTestSecret();
  if (testSecret) {
    const c = (await cookies()).get(TEST_COOKIE)?.value;
    if (c && safeEqualHex(c, testCookieValue(testSecret))) {
      return { userId: 'test-admin', email: allowed[0] ?? 'test-admin@example.test', via: 'test' };
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(); // verified against Supabase Auth, not just the cookie
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  if (!allowed.includes(email)) return null;
  return { userId: data.user.id, email, via: 'supabase' };
}

export async function requireAdminApi(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new ApiError(401, 'unauthorized', 'Admin session required');
  return session;
}

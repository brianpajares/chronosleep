import { NextResponse, type NextRequest } from 'next/server';
import { TEST_COOKIE, testCookieValue } from '@/server/auth/admin';
import { safeEqualHex, sha256Hex } from '@/server/crypto';
import { appOrigin, env } from '@/server/env';

export const runtime = 'nodejs';

/**
 * Test-only login for e2e/staging: requires ADMIN_TEST_LOGIN_SECRET (never honoured when
 * VERCEL_ENV=production — see env.adminTestSecret). 404 whenever the secret is not configured.
 */
export async function GET(req: NextRequest) {
  const secret = env.adminTestSecret();
  const given = new URL(req.url).searchParams.get('secret') ?? '';
  if (!secret || !safeEqualHex(sha256Hex(given), sha256Hex(secret))) {
    return new NextResponse('Not found', { status: 404 });
  }
  const res = NextResponse.redirect(`${appOrigin()}/admin`);
  res.cookies.set(TEST_COOKIE, testCookieValue(secret), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 3600 });
  return res;
}

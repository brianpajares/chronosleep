import 'server-only';
import { safeEqualHex, sha256Hex } from './crypto';
import { env } from './env';

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Never open when the secret is unset. */
export function cronAuthorized(req: Request): boolean {
  const secret = env.cronSecret();
  if (!secret) return false;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return safeEqualHex(sha256Hex(given), sha256Hex(secret));
}

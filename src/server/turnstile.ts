import 'server-only';
import { env, isProduction } from './env';
import { log } from './logger';

export type TurnstileResult = { ok: true } | { ok: false; code: 'botcheck_failed' | 'botcheck_not_configured' | 'botcheck_unavailable' };

/**
 * Cloudflare Turnstile verification. Test keys (1x000…AA) always pass.
 * When no secret is configured: allowed outside production (or with ALLOW_NO_TURNSTILE=1),
 * rejected in production so the gate can never be left open by accident.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<TurnstileResult> {
  const secret = env.turnstileSecret();
  if (!secret) {
    if (!isProduction() || env.allowNoTurnstile()) return { ok: true };
    return { ok: false, code: 'botcheck_not_configured' };
  }
  if (!token) return { ok: false, code: 'botcheck_failed' };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? { ok: true } : { ok: false, code: 'botcheck_failed' };
  } catch {
    log.warn('turnstile_unavailable', { error_category: 'network' });
    return { ok: false, code: 'botcheck_unavailable' };
  }
}

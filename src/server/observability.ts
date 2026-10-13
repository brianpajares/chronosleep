import 'server-only';
import * as Sentry from '@sentry/nextjs';

/**
 * Thin, PII-safe wrappers around Sentry. They are no-ops when Sentry is not initialised
 * (no DSN), and only ever carry categorical tags — never inputs, emails or payloads.
 */

const SAFE_TAG = /^[A-Za-z0-9_.:-]{1,64}$/;

function safeTags(tags: Record<string, string | number | boolean | undefined> = {}) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v === undefined) continue;
    const s = String(v);
    if (SAFE_TAG.test(s)) out[k] = s;
  }
  return out;
}

export function reportMessage(
  message: string,
  tags?: Record<string, string | number | boolean | undefined>,
  level: 'info' | 'warning' | 'error' = 'warning',
): void {
  try {
    if (!Sentry.getClient()) return;
    Sentry.captureMessage(message, { level, tags: safeTags(tags) });
  } catch {
    /* observability must never break a request */
  }
}

export function reportError(
  error: unknown,
  tags?: Record<string, string | number | boolean | undefined>,
): void {
  try {
    if (!Sentry.getClient()) return;
    // Only the error class and a scrubbed message travel to Sentry.
    const err = error instanceof Error ? error : new Error('non-error thrown');
    Sentry.withScope((scope) => {
      scope.setTags(safeTags(tags));
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}

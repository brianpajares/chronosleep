import 'server-only';
import { isKnownEvent, sanitizeProps } from '@/lib/analytics-catalog';
import { env } from './env';
import { log } from './logger';

/**
 * Server-side analytics for events the browser cannot observe (e.g. `payment_succeeded` from the
 * Stripe webhook). Same allow-list and sanitiser as the client; anonymous distinct id.
 */
export async function serverTrack(event: string, props: Record<string, unknown> = {}): Promise<void> {
  const key = env.posthogKey();
  if (!key || !isKnownEvent(event)) return;
  try {
    await fetch(`${env.posthogHost().replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: 'server',
        properties: { ...sanitizeProps(event, props), $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    log.warn('server_analytics_failed', { provider: 'posthog', error_category: 'network' });
  }
}

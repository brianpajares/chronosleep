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

/**
 * GA4 Measurement Protocol `purchase` (server-side, authoritative). Sent only when the buyer shared a
 * GA client id (i.e. consented to analytics) and GA_API_SECRET is configured; the secret never
 * leaves the server. GA deduplicates by `transaction_id`.
 */
export async function sendGaPurchase(args: { transactionId: string; currency: string; value: number; clientId?: string }): Promise<void> {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const secret = process.env.GA_API_SECRET;
  if (!id || !secret || !args.clientId) return;
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: args.clientId,
        events: [
          {
            name: 'purchase',
            params: {
              transaction_id: args.transactionId,
              currency: args.currency,
              value: args.value,
              items: [{ item_id: 'chronosleep_full_report', item_name: 'ChronoSleep full report', item_category: 'report', price: args.value, quantity: 1 }],
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    log.warn('server_analytics_failed', { provider: 'ga4', error_category: 'network' });
  }
}

import { ApiError, json, withApi } from '@/server/api';
import { env } from '@/server/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** FR-23: signature verified over the RAW body; idempotent via webhook_events; 404 unless stripe mode. */
export const POST = withApi({ name: 'stripe-webhook' }, async (req, { requestId }) => {
  if (env.monetizationMode() !== 'stripe') throw new ApiError(404, 'feature_disabled', 'Not found');
  const raw = await req.text();
  const { handleStripeWebhook } = await import('@/server/services/stripe');
  const outcome = await handleStripeWebhook(raw, req.headers.get('stripe-signature'));
  return json({ received: true, outcome }, requestId);
});

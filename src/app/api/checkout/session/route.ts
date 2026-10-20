import { ApiError, json, readJson, withApi } from '@/server/api';
import { env } from '@/server/env';
import { POLICIES } from '@/server/ratelimit';
import { CheckoutSessionSchema } from '@/server/schemas';

export const runtime = 'nodejs';

/**
 * FR-22 / FR-24: only reachable with MONETIZATION_MODE=stripe — otherwise a plain 404 and the
 * Stripe module is never even imported.
 */
export const POST = withApi({ name: 'checkout-session', rateLimit: POLICIES.checkout }, async (req, { requestId }) => {
  if (env.monetizationMode() !== 'stripe') throw new ApiError(404, 'feature_disabled', 'Not found');
  const body = CheckoutSessionSchema.parse(await readJson(req));
  const { createCheckoutSession } = await import('@/server/services/stripe');
  const geo = req.headers.get('x-vercel-ip-country');
  const { defaultCountryFor } = await import('@/lib/pricing');
  const out = await createCheckoutSession({
    leadId: body.report_request_id,
    locale: body.locale ?? 'en',
    countryCode: body.country_code ?? defaultCountryFor(body.locale ?? 'en', geo),
    gaClientId: body.ga_client_id,
  });
  return json(out, requestId, { status: 201 });
});

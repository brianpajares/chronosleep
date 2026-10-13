import { NextResponse } from 'next/server';
import { ApiError, readJson, REQUEST_ID_HEADER, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { PrivacyRequestSchema } from '@/server/schemas';
import { createPrivacyRequest } from '@/server/services/privacy';
import { verifyTurnstile } from '@/server/turnstile';

export const runtime = 'nodejs';

/** FR-16/FR-31: data-rights intake. Always the same 202 so the endpoint cannot be used to probe for emails. */
export const POST = withApi({ name: 'privacy-requests', rateLimit: POLICIES.privacy }, async (req, { requestId, ip }) => {
  const body = PrivacyRequestSchema.parse(await readJson(req));
  const bot = await verifyTurnstile(body.turnstile_token, ip);
  if (!bot.ok) throw new ApiError(bot.code === 'botcheck_unavailable' ? 503 : 400, bot.code, 'Bot verification failed');
  const { reference } = await createPrivacyRequest({ email: body.email, request_type: body.request_type, locale: body.locale });
  const res = NextResponse.json({ ok: true, reference, request_id: requestId }, { status: 202 });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
});

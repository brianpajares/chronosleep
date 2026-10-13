import { ApiError, json, readJson, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { ReportRequestSchema } from '@/server/schemas';
import { createReportRequest } from '@/server/services/report-requests';
import { verifyTurnstile } from '@/server/turnstile';

export const runtime = 'nodejs';
export const maxDuration = 60; // PDF render + two emails

/** FR-07/FR-08/FR-31: Turnstile + rate limit, then lead + PDF + emails (validation) or pending payment (stripe). */
export const POST = withApi({ name: 'report-requests', rateLimit: POLICIES.reportRequest }, async (req, { requestId, ip }) => {
  const body = ReportRequestSchema.parse(await readJson(req));
  const bot = await verifyTurnstile(body.turnstile_token, ip);
  if (!bot.ok) throw new ApiError(bot.code === 'botcheck_unavailable' ? 503 : 400, bot.code, 'Bot verification failed');

  const result = await createReportRequest({
    calculation_id: body.calculation_id,
    email: body.email,
    consent_report: body.consent_report,
    consent_owner_copy: body.consent_owner_copy,
    waitlist_subscription: body.waitlist_subscription,
    locale: body.locale,
    requestId,
  });
  return json(result, requestId, { status: 201 });
});

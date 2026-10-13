import { createTranslator, type AbstractIntlMessages } from 'use-intl/core';
import { buildIcs, verificationIdFromUuid } from '@/domain/chronosleep';
import { ApiError, REQUEST_ID_HEADER, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { UuidParam } from '@/server/schemas';
import { resolveReportAccess } from '@/server/services/artifacts';
import { getMessages } from '@/messages';

export const runtime = 'nodejs';

/** FR-14 / AT-14: ICS export of the simulated 7-day plan (floating local times, starts tomorrow). */
export const GET = withApi<{ id: string }>({ name: 'reports-ics', rateLimit: POLICIES.report }, async (req, { params, requestId }) => {
  const id = UuidParam.safeParse(params.id);
  if (!id.success) throw new ApiError(404, 'not_found', 'Not found');
  const url = new URL(req.url);
  const { lead, report } = await resolveReportAccess(id.data, url.searchParams.get('token'));

  const startParam = url.searchParams.get('start');
  let start = new Date(Date.now() + 86_400_000);
  if (startParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam)) throw new ApiError(400, 'invalid_start', 'start must be YYYY-MM-DD');
    start = new Date(`${startParam}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) throw new ApiError(400, 'invalid_start', 'start must be a valid date');
  }

  const t = createTranslator({ locale: lead.locale, messages: getMessages(lead.locale) as unknown as AbstractIntlMessages, namespace: 'report' }) as unknown as (k: string) => string;
  const ics = buildIcs(report.full.plan_7d, {
    startDate: start,
    id: verificationIdFromUuid(lead.id),
    labels: { workSummary: t('ics_work'), freeSummary: t('ics_free'), description: t('ics_description') },
  });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="chronosleep-${verificationIdFromUuid(lead.id)}.ics"`,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      [REQUEST_ID_HEADER]: requestId,
    },
  });
});

import { ApiError, json, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { UuidParam } from '@/server/schemas';
import { resolveReportAccess } from '@/server/services/artifacts';

export const runtime = 'nodejs';

/** FR-12/FR-13: full report as JSON, authorised by an opaque expiring token. */
export const GET = withApi<{ id: string }>({ name: 'reports-get', rateLimit: POLICIES.report }, async (req, { params, requestId }) => {
  const id = UuidParam.safeParse(params.id);
  if (!id.success) throw new ApiError(404, 'not_found', 'Not found');
  const token = new URL(req.url).searchParams.get('token');
  const { lead, report } = await resolveReportAccess(id.data, token);
  const q = `?token=${encodeURIComponent(token as string)}`;
  return json(
    {
      id: lead.id,
      model_version: report.model_version,
      report_version: report.report_version,
      outputs: {
        social_jetlag_hours: report.preview.social_jetlag_hours,
        weekly_timing_chart: report.preview.weekly_timing_chart,
        one_insight: report.preview.one_insight,
        ...report.full,
      },
      pdf_url: `/api/reports/${lead.id}/pdf${q}`,
      ics_url: `/api/reports/${lead.id}/ics${q}`,
    },
    requestId,
    { headers: { 'Referrer-Policy': 'no-referrer' } },
  );
});

import { verificationIdFromUuid } from '@/domain/chronosleep';
import { ApiError, REQUEST_ID_HEADER, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { UuidParam } from '@/server/schemas';
import { ensureArtifact, resolveReportAccess } from '@/server/services/artifacts';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** FR-13/FR-32: private PDF download (same token as the web report). */
export const GET = withApi<{ id: string }>({ name: 'reports-pdf', rateLimit: POLICIES.report }, async (req, { params, requestId }) => {
  const id = UuidParam.safeParse(params.id);
  if (!id.success) throw new ApiError(404, 'not_found', 'Not found');
  const { lead } = await resolveReportAccess(id.data, new URL(req.url).searchParams.get('token'));
  const artifact = await ensureArtifact(lead);
  const bytes = await getStore().getBlob(artifact.storage_path);
  if (!bytes) throw new ApiError(404, 'not_found', 'Not found');
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="chronosleep-${verificationIdFromUuid(lead.id)}.pdf"`,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      [REQUEST_ID_HEADER]: requestId,
    },
  });
});

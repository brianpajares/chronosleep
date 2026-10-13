import { ApiError, json, withApi } from '@/server/api';
import { requireAdminApi } from '@/server/auth/admin';
import { POLICIES } from '@/server/ratelimit';
import { UuidParam } from '@/server/schemas';
import { completePrivacyRequest, exportPrivacyData, markVerified } from '@/server/services/privacy';

export const runtime = 'nodejs';

/** Extension (FR-16): verify → export (access/portability) → complete (deletion executes erasure). */
export const POST = withApi<{ id: string; action: string }>(
  { name: 'admin-privacy-action', rateLimit: POLICIES.admin },
  async (_req, { params, requestId }) => {
    const admin = await requireAdminApi();
    const id = UuidParam.safeParse(params.id);
    if (!id.success) throw new ApiError(404, 'not_found', 'Not found');

    switch (params.action) {
      case 'verify':
        await markVerified(id.data, admin.userId);
        return json({ ok: true, id: id.data }, requestId);
      case 'complete': {
        const result = await completePrivacyRequest(id.data, admin.userId);
        return json({ ok: true, id: id.data, deleted: result?.deleted ?? 0, scrubbed: result?.scrubbed ?? 0 }, requestId);
      }
      case 'export': {
        const data = await exportPrivacyData(id.data, admin.userId);
        return json(data, requestId, {
          headers: { 'Content-Disposition': `attachment; filename="chronosleep-data-${id.data.slice(0, 8)}.json"` },
        });
      }
      default:
        throw new ApiError(404, 'not_found', 'Not found');
    }
  },
);

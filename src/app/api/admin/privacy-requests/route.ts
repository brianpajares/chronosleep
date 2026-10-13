import { json, withApi } from '@/server/api';
import { requireAdminApi } from '@/server/auth/admin';
import { POLICIES } from '@/server/ratelimit';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

/** Extension of the OpenAPI contract (FR-16): the data-rights queue. No email is returned. */
export const GET = withApi({ name: 'admin-privacy-list', rateLimit: POLICIES.admin }, async (_req, { requestId }) => {
  await requireAdminApi();
  const rows = await getStore().listPrivacyRequests(50);
  return json(
    {
      items: rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        request_type: r.request_type,
        status: r.status,
        locale: r.locale,
        verified_at: r.verified_at,
        completed_at: r.completed_at,
      })),
    },
    requestId,
  );
});

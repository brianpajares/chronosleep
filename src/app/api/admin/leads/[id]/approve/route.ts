import { ApiError, json, withApi } from '@/server/api';
import { requireAdminApi } from '@/server/auth/admin';
import { POLICIES } from '@/server/ratelimit';
import { UuidParam } from '@/server/schemas';
import { approveLead } from '@/server/services/admin-actions';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = withApi<{ id: string }>({ name: 'admin-approve', rateLimit: POLICIES.admin }, async (_req, { params, requestId }) => {
  const admin = await requireAdminApi();
  const id = UuidParam.safeParse(params.id);
  if (!id.success) throw new ApiError(404, 'not_found', 'Not found');
  await approveLead(id.data, admin.userId);
  return json({ ok: true, id: id.data }, requestId);
});

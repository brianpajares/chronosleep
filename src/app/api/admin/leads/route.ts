import { json, withApi } from '@/server/api';
import { requireAdminApi } from '@/server/auth/admin';
import { POLICIES } from '@/server/ratelimit';
import { toAdminLead } from '@/server/services/admin-actions';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

/** FR-17: paginated lead list with masked emails (admin session only). */
export const GET = withApi({ name: 'admin-leads', rateLimit: POLICIES.admin }, async (req, { requestId }) => {
  await requireAdminApi();
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const page = await getStore().listLeads({ status, cursor, limit: 25 });
  const items = await Promise.all(page.items.map(toAdminLead));
  return json({ items, next_cursor: page.next_cursor }, requestId);
});

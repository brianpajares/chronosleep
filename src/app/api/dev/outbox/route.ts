import { ApiError, json, withApi } from '@/server/api';
import { devOutbox } from '@/server/email/send';
import { env } from '@/server/env';

export const runtime = 'nodejs';

/** E2E/dev only (E2E=1 or `next dev`): read-only view of the in-memory email outbox. 404 otherwise. */
export const GET = withApi({ name: 'dev-outbox' }, async (_req, { requestId }) => {
  if (!env.devToolsEnabled()) throw new ApiError(404, 'not_found', 'Not found');
  return json({ items: devOutbox.all() }, requestId);
});

export const DELETE = withApi({ name: 'dev-outbox-clear' }, async (_req, { requestId }) => {
  if (!env.devToolsEnabled()) throw new ApiError(404, 'not_found', 'Not found');
  devOutbox.clear();
  return json({ ok: true }, requestId);
});

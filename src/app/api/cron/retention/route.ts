import { ApiError, json, withApi } from '@/server/api';
import { cronAuthorized } from '@/server/cron';
import { retryFailedDeliveries } from '@/server/services/delivery';
import { runRetention } from '@/server/services/retention';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Daily (vercel.json): retention purge + one retry pass over failed deliveries. */
export const GET = withApi({ name: 'cron-retention' }, async (req, { requestId }) => {
  if (!cronAuthorized(req)) throw new ApiError(401, 'unauthorized', 'Unauthorized');
  const retention = await runRetention();
  const deliveries = await retryFailedDeliveries();
  return json({ ok: true, retention, deliveries }, requestId);
});

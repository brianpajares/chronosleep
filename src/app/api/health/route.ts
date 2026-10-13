import { MODEL_VERSION } from '@/domain/chronosleep';
import { json, withApi } from '@/server/api';
import { driveHealth } from '@/server/drive';
import { env } from '@/server/env';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

/**
 * Health = app + DB. Drive only degrades the status when a last-known-good copy is being served;
 * it never fails production (the calculator does not depend on Drive per request).
 */
export const GET = withApi({ name: 'health' }, async (_req, { requestId }) => {
  const store = getStore();
  try {
    await store.ping();
  } catch {
    return json({ status: 'degraded', db: 'error', drive: 'unknown', model_version: MODEL_VERSION }, requestId, { status: 503 });
  }
  const drive = await driveHealth();
  return json(
    {
      status: drive.status === 'ok' ? 'ok' : 'degraded',
      db: 'ok',
      drive: drive.status,
      model_version: MODEL_VERSION,
      db_driver: store.driver,
      drive_source: drive.source,
      drive_configured: drive.configured,
      mode: env.monetizationMode(),
    },
    requestId,
  );
});

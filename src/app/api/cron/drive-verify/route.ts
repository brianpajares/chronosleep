import { ApiError, json, withApi } from '@/server/api';
import { getDriveArtifacts } from '@/server/drive';
import { manifest } from '@/server/drive/manifest';
import { cronAuthorized } from '@/server/cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Daily Drive check: refreshes every artifact (checksum → cache); degrades without failing. */
export const GET = withApi({ name: 'cron-drive-verify' }, async (req, { requestId }) => {
  if (!cronAuthorized(req)) throw new ApiError(401, 'unauthorized', 'Unauthorized');
  const drive = getDriveArtifacts();
  const files: Record<string, string> = {};
  for (const f of manifest.files) {
    const a = await drive.get(f.file);
    files[f.file] = `${a.source}${a.degraded ? ':degraded' : ''}`;
  }
  return json({ ok: true, degraded: drive.state.degraded, configured: drive.state.configured, files }, requestId);
});

import 'server-only';
import { DEFAULT_ENGINE_PARAMS, EngineParamsSchema, type EngineParams } from '@/domain/chronosleep';
import { env } from '../env';
import { log } from '../logger';
import { reportMessage } from '../observability';
import { DriveArtifacts, type ArtifactResult } from './cache';
import { DriveClient } from './client';

let instance: DriveArtifacts | undefined;

export function getDriveArtifacts(): DriveArtifacts {
  if (instance) return instance;
  const clientEmail = env.driveServiceEmail();
  const privateKey = env.drivePrivateKey();
  const folderId = env.driveFolderId();
  const configured = Boolean(clientEmail && privateKey && folderId);
  const client = configured
    ? new DriveClient({ clientEmail: clientEmail as string, privateKey: privateKey as string, folderId: folderId as string })
    : null;

  instance = new DriveArtifacts({
    remote: client
      ? async (_entry, segments) => {
          const file = await client.resolve(segments);
          if (!file) throw new Error('drive: file not found');
          return client.download(file.id);
        }
      : undefined,
    onDegraded: (file, reason) => {
      log.warn('drive_degraded', { error_category: reason, source: file });
      reportMessage('drive_degraded', { reason, file });
    },
  });
  return instance;
}

export function resetDriveForTests(): void {
  instance = undefined;
}

let paramsMemo: { sha: string; params: EngineParams } | undefined;

/** Engine parameters (model_params.json) from Drive → cache → bundled; defaults as a last resort. */
export async function getEngineParams(): Promise<{ params: EngineParams; artifact: ArtifactResult | null }> {
  try {
    const artifact = await getDriveArtifacts().get('model_params.json');
    if (paramsMemo?.sha === artifact.sha256) return { params: paramsMemo.params, artifact };
    const json = JSON.parse(new TextDecoder().decode(artifact.bytes)) as Record<string, unknown>;
    const parsed = EngineParamsSchema.safeParse({ ...DEFAULT_ENGINE_PARAMS, ...json });
    if (parsed.success) {
      paramsMemo = { sha: artifact.sha256, params: parsed.data };
      return { params: parsed.data, artifact };
    }
  } catch {
    log.warn('engine_params_fallback', { error_category: 'params_unreadable' });
  }
  return { params: DEFAULT_ENGINE_PARAMS, artifact: null };
}

export async function getModelCard(): Promise<{ markdown: string; source: ArtifactResult['source']; degraded: boolean; version: string }> {
  const a = await getDriveArtifacts().get('model_card.md');
  return {
    markdown: new TextDecoder().decode(a.bytes),
    source: a.source,
    degraded: a.degraded,
    version: a.version,
  };
}

export async function driveHealth(): Promise<{ status: 'ok' | 'degraded'; source: string; configured: boolean }> {
  const drive = getDriveArtifacts();
  try {
    const a = await drive.get('model_params.json');
    return { status: drive.state.degraded ? 'degraded' : 'ok', source: a.source, configured: drive.state.configured };
  } catch {
    return { status: 'degraded', source: 'none', configured: drive.state.configured };
  }
}

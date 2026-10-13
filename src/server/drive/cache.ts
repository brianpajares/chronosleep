import { manifestEntry, readBundled, sha256, driveSegments, type ManifestFile } from './manifest';

export type ArtifactSource = 'drive' | 'cache' | 'bundled';

export interface ArtifactResult {
  bytes: Uint8Array;
  source: ArtifactSource;
  /** True when the last refresh failed and an older valid copy is being served. */
  degraded: boolean;
  sha256: string;
  version: string;
}

export interface DriveState {
  configured: boolean;
  degraded: boolean;
  lastError: string | null;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
}

export interface DriveArtifactsDeps {
  /** Downloads the artifact from Drive; absent when Drive is not configured. */
  remote?: (entry: ManifestFile, segments: string[]) => Promise<Uint8Array>;
  ttlMs?: number;
  now?: () => number;
  bundled?: (file: string) => Uint8Array;
  onDegraded?: (file: string, reason: string) => void;
}

export const DRIVE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Drive artifact reader — FR-19/FR-20:
 *  - verifies SHA-256 against spec/drive_manifest.json before promoting anything to cache;
 *  - caches valid copies for 24 h (never one Drive call per user request);
 *  - on Drive failure or checksum mismatch keeps serving the last valid copy;
 *  - the bundled `drive/` folder (verified at build/CI by `npm run drive:verify`) is the baseline.
 */
export class DriveArtifacts {
  private readonly cache = new Map<string, { bytes: Uint8Array; fetchedAt: number; sha256: string }>();
  private readonly inflight = new Map<string, Promise<ArtifactResult>>();
  readonly state: DriveState;

  constructor(private readonly deps: DriveArtifactsDeps = {}) {
    this.state = {
      configured: Boolean(deps.remote),
      degraded: false,
      lastError: null,
      lastSuccessAt: null,
      lastAttemptAt: null,
    };
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private bundled(file: string): Uint8Array {
    return (this.deps.bundled ?? readBundled)(file);
  }

  get(file: string): Promise<ArtifactResult> {
    const pending = this.inflight.get(file);
    if (pending) return pending;
    const p = this.resolve(file).finally(() => this.inflight.delete(file));
    this.inflight.set(file, p);
    return p;
  }

  private async resolve(file: string): Promise<ArtifactResult> {
    const entry = manifestEntry(file);
    const ttl = this.deps.ttlMs ?? DRIVE_TTL_MS;
    const cached = this.cache.get(file);

    if (cached && this.now() - cached.fetchedAt < ttl) {
      return { bytes: cached.bytes, source: 'cache', degraded: this.state.degraded, sha256: cached.sha256, version: entry.version };
    }

    if (this.deps.remote) {
      this.state.lastAttemptAt = this.now();
      try {
        const bytes = await this.deps.remote(entry, driveSegments(entry));
        const actual = sha256(bytes);
        if (actual !== entry.sha256) throw new Error('checksum_mismatch');
        this.cache.set(file, { bytes, fetchedAt: this.now(), sha256: actual });
        this.state.degraded = false;
        this.state.lastError = null;
        this.state.lastSuccessAt = this.now();
        return { bytes, source: 'drive', degraded: false, sha256: actual, version: entry.version };
      } catch (err) {
        const reason = err instanceof Error && err.message === 'checksum_mismatch' ? 'checksum_mismatch' : 'drive_error';
        this.state.degraded = true;
        this.state.lastError = reason;
        this.deps.onDegraded?.(file, reason);
        // A failed/invalid refresh never replaces a valid cache: serve the last valid copy.
        if (cached) {
          return { bytes: cached.bytes, source: 'cache', degraded: true, sha256: cached.sha256, version: entry.version };
        }
      }
    }

    const bytes = this.bundled(file);
    return {
      bytes,
      source: 'bundled',
      degraded: this.state.degraded,
      sha256: sha256(bytes),
      version: entry.version,
    };
  }

  reset(): void {
    this.cache.clear();
    this.inflight.clear();
    this.state.degraded = false;
    this.state.lastError = null;
  }
}

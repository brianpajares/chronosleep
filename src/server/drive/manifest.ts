import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import manifestJson from '../../../spec/drive_manifest.json';

export interface ManifestFile {
  file: string;
  drive_path: string;
  purpose: string;
  format: string;
  sha256: string;
  version: string;
  reader: string;
}

export const DRIVE_ROOT_PREFIX = '/Apps/chronosleep/';

export const manifest = manifestJson as { app: string; version: string; files: ManifestFile[] };

export const sha256 = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex');

export function manifestEntry(file: string): ManifestFile {
  const entry = manifest.files.find((f) => f.file === file);
  if (!entry) throw new Error(`drive: "${file}" is not in spec/drive_manifest.json`);
  return entry;
}

/** `/Apps/chronosleep/base/x.xlsx` -> ['base', 'x.xlsx'] (path segments below the shared folder). */
export function driveSegments(entry: ManifestFile): string[] {
  if (!entry.drive_path.startsWith(DRIVE_ROOT_PREFIX)) {
    throw new Error(`drive: unexpected drive_path ${entry.drive_path}`);
  }
  return entry.drive_path.slice(DRIVE_ROOT_PREFIX.length).split('/');
}

/** Directory with the bundled, checksum-verified copy of `drive/` (last-known-good baseline). */
export function bundledRoot(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'drive');
}

export function readBundled(file: string): Uint8Array {
  const entry = manifestEntry(file);
  const bytes = readFileSync(path.join(bundledRoot(), ...driveSegments(entry)));
  const actual = sha256(bytes);
  if (actual !== entry.sha256) {
    throw new Error(`drive: bundled ${file} checksum mismatch (${actual.slice(0, 12)}… != ${entry.sha256.slice(0, 12)}…)`);
  }
  return new Uint8Array(bytes);
}

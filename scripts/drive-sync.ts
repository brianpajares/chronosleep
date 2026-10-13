/**
 * `npm run drive:sync` — FR-21 / AT-21.
 * Uploads `drive/` to the shared Google Drive folder (GOOGLE_DRIVE_FOLDER_ID), preserving subfolders:
 *  - recursively walks `drive/`, creating missing subfolders;
 *  - uploads/updates files by name inside the right folder;
 *  - prints local and Drive SHA-256, and fails if it cannot verify them;
 *  - never deletes remote files.
 * Requires the service account to be Editor on the folder (see docs/DRIVE_SETUP.md).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { DriveClient } from '../src/server/drive/client';
import { sha256 } from '../src/server/drive/manifest';

try {
  process.loadEnvFile?.('.env.local');
} catch {
  /* optional */
}

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!email || !key || !folderId || /REPLACE_ME/.test(`${email}${key}${folderId}`)) {
  console.error('drive:sync needs GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_DRIVE_FOLDER_ID');
  process.exit(1);
}

const client = new DriveClient({ clientEmail: email, privateKey: key, folderId }, { timeoutMs: 30000, scope: 'write' });
const root = path.join(process.cwd(), 'drive');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function main() {
  let failures = 0;
  for (const file of walk(root).sort()) {
    const rel = path.relative(root, file).split(path.sep);
    const bytes = new Uint8Array(readFileSync(file));
    let parent = folderId as string;
    for (const dir of rel.slice(0, -1)) parent = await client.ensureFolder(parent, dir);
    const name = rel[rel.length - 1] as string;
    const uploaded = await client.upsertFile(parent, name, bytes, MIME[path.extname(name)] ?? 'application/octet-stream');
    const local = sha256(bytes);
    const remote = sha256(await client.download(uploaded.id));
    const ok = local === remote;
    if (!ok) failures++;
    console.log(`${ok ? '✓' : '✗'} ${rel.join('/')}  local ${local.slice(0, 12)}…  drive ${remote.slice(0, 12)}…`);
  }
  if (failures) {
    console.error(`drive:sync verification failed for ${failures} file(s)`);
    process.exit(1);
  }
  console.log('drive:sync OK (nothing deleted remotely)');
}

main().catch((e: Error) => {
  console.error(`drive:sync failed: ${e.message}`);
  process.exit(1);
});

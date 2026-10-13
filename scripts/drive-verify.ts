/**
 * `npm run drive:verify` — FR-19 / AT-19.
 * Compares the 7 artifacts of spec/drive_manifest.json with the bundled `drive/` folder
 * (always) and, when Drive credentials are configured or `--remote` is passed, with Drive itself.
 * Exits non-zero if any artifact is missing or its SHA-256 differs.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DriveClient } from '../src/server/drive/client';
import { driveSegments, manifest, sha256 } from '../src/server/drive/manifest';

try {
  process.loadEnvFile?.('.env.local');
} catch {
  /* optional */
}

const root = path.join(process.cwd(), 'drive');
const wantRemote = process.argv.includes('--remote');
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const remoteConfigured = Boolean(email && key && folderId && !/REPLACE_ME/.test(`${email}${key}${folderId}`));

async function main() {
  let failures = 0;
  const client =
    (wantRemote || remoteConfigured) && remoteConfigured
      ? new DriveClient({ clientEmail: email as string, privateKey: key as string, folderId: folderId as string }, { timeoutMs: 15000 })
      : null;
  if (wantRemote && !client) {
    console.error('drive:verify --remote needs GOOGLE_* credentials');
    process.exit(1);
  }

  console.log(`Manifest v${manifest.version}: ${manifest.files.length} files`);
  for (const f of manifest.files) {
    const segs = driveSegments(f);
    const local = path.join(root, ...segs);
    let status = 'ok';
    if (!existsSync(local)) {
      status = 'MISSING (local)';
      failures++;
    } else if (sha256(readFileSync(local)) !== f.sha256) {
      status = 'CHECKSUM MISMATCH (local)';
      failures++;
    }
    let remote = '';
    if (client && status === 'ok') {
      try {
        const file = await client.resolve(segs);
        if (!file) {
          remote = ' | drive: MISSING';
          failures++;
        } else {
          const ok = sha256(await client.download(file.id)) === f.sha256;
          remote = ok ? ' | drive: ok' : ' | drive: CHECKSUM MISMATCH';
          if (!ok) failures++;
        }
      } catch (e) {
        remote = ` | drive: ERROR ${(e as Error).message}`;
        failures++;
      }
    }
    console.log(`${status === 'ok' ? '✓' : '✗'} ${f.drive_path}  sha256 ${f.sha256.slice(0, 12)}…  ${status}${remote}`);
  }

  if (failures > 0) {
    console.error(`\ndrive:verify failed (${failures} problem${failures > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log('\ndrive:verify OK');
}

void main();

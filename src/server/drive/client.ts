import { createSign } from 'node:crypto';

/**
 * Minimal Google Drive v3 client for a service account (no googleapis dependency).
 * Pure Node: usable from the app (read-only scope) and from scripts/drive-sync.ts (write scope).
 */

export interface DriveCredentials {
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  size?: string;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

export class DriveClient {
  private token: { value: string; exp: number; scope: string } | null = null;
  private readonly folderCache = new Map<string, string>();

  constructor(
    private readonly creds: DriveCredentials,
    private readonly opts: { timeoutMs?: number; scope?: 'readonly' | 'write' } = {},
  ) {}

  private get scope(): string {
    return this.opts.scope === 'write'
      ? 'https://www.googleapis.com/auth/drive'
      : 'https://www.googleapis.com/auth/drive.readonly';
  }

  private get timeout(): number {
    return this.opts.timeoutMs ?? 4000;
  }

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now && this.token.scope === this.scope) return this.token.value;
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(
      JSON.stringify({
        iss: this.creds.clientEmail,
        scope: this.scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${claims}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.creds.privateKey);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${b64url(signature)}`,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`drive auth failed: HTTP ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, exp: now + data.expires_in, scope: this.scope };
    return data.access_token;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`drive request failed: HTTP ${res.status}`);
    return res;
  }

  async findChild(parentId: string, name: string, kind: 'folder' | 'file'): Promise<DriveFile | null> {
    const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const mime = kind === 'folder' ? `mimeType = '${FOLDER_MIME}'` : `mimeType != '${FOLDER_MIME}'`;
    const q = `'${parentId}' in parents and name = '${escaped}' and trashed = false and ${mime}`;
    const url = `${API}/files?${new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType,md5Checksum,size)',
      pageSize: '5',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })}`;
    const data = (await (await this.request(url)).json()) as { files: DriveFile[] };
    return data.files[0] ?? null;
  }

  /** Resolves ['base', 'file.xlsx'] under the shared folder; folders are cached per client. */
  async resolve(segments: string[]): Promise<DriveFile | null> {
    let parent = this.creds.folderId;
    for (const [i, seg] of segments.entries()) {
      const last = i === segments.length - 1;
      const key = `${parent}/${seg}`;
      if (!last) {
        const cached = this.folderCache.get(key);
        if (cached) {
          parent = cached;
          continue;
        }
        const folder = await this.findChild(parent, seg, 'folder');
        if (!folder) return null;
        this.folderCache.set(key, folder.id);
        parent = folder.id;
      } else {
        return this.findChild(parent, seg, 'file');
      }
    }
    return null;
  }

  async download(fileId: string): Promise<Uint8Array> {
    const res = await this.request(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async ensureFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.findChild(parentId, name, 'folder');
    if (existing) return existing.id;
    const res = await this.request(`${API}/files?supportsAllDrives=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return ((await res.json()) as { id: string }).id;
  }

  /** Creates or updates a file by name inside `parentId`. Never deletes anything. */
  async upsertFile(parentId: string, name: string, bytes: Uint8Array, mimeType: string): Promise<DriveFile> {
    const existing = await this.findChild(parentId, name, 'file');
    const boundary = `cs-${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify(existing ? { name } : { name, parents: [parentId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const url = existing
      ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,md5Checksum,size`
      : `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,md5Checksum,size`;
    const res = await this.request(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await res.json()) as DriveFile;
  }
}

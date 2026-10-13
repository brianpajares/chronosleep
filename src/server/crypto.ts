import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { env } from './env';

/**
 * AES-256-GCM for every sensitive payload (emails, schedules, results).
 * Key = DATA_ENCRYPTION_KEY_BASE64 (32 random bytes). When a persistent store is configured the key is
 * mandatory; with the in-memory store an ephemeral per-process key is used.
 */

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super('DATA_ENCRYPTION_KEY_BASE64 is required when a persistent database is configured');
    this.name = 'EncryptionNotConfiguredError';
  }
}

const globalForKey = globalThis as unknown as { __csEphemeralKey?: Buffer };

export function persistentStoreConfigured(): boolean {
  return Boolean(env.supabaseUrl() && env.supabaseServiceKey());
}

export function encryptionConfigured(): boolean {
  const b64 = env.encryptionKeyB64();
  return Boolean(b64 && Buffer.from(b64, 'base64').length === 32);
}

function masterKey(): Buffer {
  const b64 = env.encryptionKeyB64();
  if (b64) {
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes');
    return key;
  }
  // A persistent store (Supabase) needs a durable key; the in-memory store does not.
  if (persistentStoreConfigured()) throw new EncryptionNotConfiguredError();
  globalForKey.__csEphemeralKey ??= randomBytes(32);
  return globalForKey.__csEphemeralKey;
}

export interface Sealed {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function seal(plaintext: string, aad?: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function open(sealed: Sealed, aad?: string): string {
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(sealed.iv, 'base64'));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

export const sealJson = (value: unknown, aad?: string): Sealed => seal(JSON.stringify(value), aad);
export const openJson = <T>(sealed: Sealed, aad?: string): T => JSON.parse(open(sealed, aad)) as T;

/**
 * `calculations` has a single `payload_iv` / `payload_tag` pair for two ciphertexts, so we store
 * "ivA.ivB" and "tagA.tagB" (two independent GCM encryptions, never a reused nonce).
 */
export function sealPair(a: unknown, b: unknown, aad: string) {
  const sa = sealJson(a, `${aad}:inputs`);
  const sb = sealJson(b, `${aad}:result`);
  return {
    inputs_ciphertext: sa.ciphertext,
    result_ciphertext: sb.ciphertext,
    payload_iv: `${sa.iv}.${sb.iv}`,
    payload_tag: `${sa.tag}.${sb.tag}`,
  };
}

export function openPair<A, B>(
  row: { inputs_ciphertext: string; result_ciphertext: string; payload_iv: string; payload_tag: string },
  aad: string,
): { inputs: A; result: B } {
  const [ivA = '', ivB = ''] = row.payload_iv.split('.');
  const [tagA = '', tagB = ''] = row.payload_tag.split('.');
  return {
    inputs: openJson<A>({ ciphertext: row.inputs_ciphertext, iv: ivA, tag: tagA }, `${aad}:inputs`),
    result: openJson<B>({ ciphertext: row.result_ciphertext, iv: ivB, tag: tagB }, `${aad}:result`),
  };
}

/** Deterministic, non-reversible email fingerprint (HMAC, so leaked hashes resist dictionary attacks). */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const key = Buffer.from(hkdfSync('sha256', masterKey(), Buffer.alloc(0), 'chronosleep-email-hash', 32));
  return createHmac('sha256', key).update(normalized).digest('hex');
}

/** Generic HMAC used to pseudonymise IPs in rate-limit keys. */
export function hmacShort(value: string, purpose: string): string {
  const key = Buffer.from(hkdfSync('sha256', masterKey(), Buffer.alloc(0), `chronosleep-${purpose}`, 32));
  return createHmac('sha256', key).update(value).digest('hex').slice(0, 32);
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Opaque URL-safe token (256 bits). Only its SHA-256 is stored. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const hashToken = (token: string): string => sha256Hex(token);

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

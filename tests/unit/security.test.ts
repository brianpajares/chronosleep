import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSafeValue, sanitizeProps, bucketMinutes, referrerGroup, allowedProps } from '@/lib/analytics-catalog';
import analyticsCatalog from '../../spec/analytics_events.json';
import { hashEmail, hashToken, maskEmail, open, openJson, randomToken, seal, sealJson, sealPair, openPair, EncryptionNotConfiguredError } from '@/server/crypto';
import { log } from '@/server/logger';
import { checkRateLimit, POLICIES, resetRateLimitsForTests } from '@/server/ratelimit';
import { verifyTurnstile } from '@/server/turnstile';
import { post, setupEnv } from './helpers';
import { POST as calculatePOST } from '@/app/api/calculate/route';
import { TV01 } from './helpers';

describe('AES-256-GCM + hashing (NFR-05, AT-08)', () => {
  beforeEach(() => setupEnv());

  it('round-trips and never reuses an IV', () => {
    const a = seal('hola');
    const b = seal('hola');
    expect(open(a)).toBe('hola');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(openJson<{ x: number }>(sealJson({ x: 1 }))).toEqual({ x: 1 });
  });

  it('detects tampering and wrong AAD', () => {
    const s = sealJson({ a: 1 }, 'lead-1');
    expect(() => openJson(s, 'lead-2')).toThrow();
    const flipped = { ...s, ciphertext: Buffer.from(s.ciphertext, 'base64').map((b, i) => (i === 0 ? b ^ 1 : b)).toString('base64') };
    expect(() => open(flipped, 'lead-1')).toThrow();
  });

  it('sealPair uses two independent nonces and round-trips', () => {
    const row = { ...sealPair({ in: 1 }, { out: 2 }, 'calc-1') };
    const [ivA, ivB] = row.payload_iv.split('.');
    expect(ivA).not.toBe(ivB);
    expect(openPair<{ in: number }, { out: number }>(row, 'calc-1')).toEqual({ inputs: { in: 1 }, result: { out: 2 } });
  });

  it('email hash is deterministic, case-insensitive and keyed', () => {
    const h = hashEmail('Persona@Example.test ');
    expect(h).toBe(hashEmail('persona@example.test'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    setupEnv(); // new key
    expect(hashEmail('persona@example.test')).not.toBe(h);
  });

  it('tokens are 256-bit opaque and only their hash is comparable', () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(maskEmail('persona@example.test')).toBe('p***@example.test');
  });

  it('refuses to persist PII with an ephemeral key when a durable database is configured', () => {
    setupEnv({ DATA_ENCRYPTION_KEY_BASE64: undefined, NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' });
    expect(() => seal('x')).toThrow(EncryptionNotConfiguredError);
  });

  it('rejects a malformed key', () => {
    setupEnv({ DATA_ENCRYPTION_KEY_BASE64: Buffer.from('short').toString('base64') });
    expect(() => seal('x')).toThrow(/32 bytes/);
  });
});

describe('analytics allow-list (FR-29, AT-29)', () => {
  it('drops unknown props, emails and exact clock times', () => {
    const out = sanitizeProps('step_complete', { step: 4, field: 'free_wake_time', elapsed_ms_bucket: 'lt_2s', email: 'a@b.co', value: '23:30' });
    expect(out).toEqual({ step: 4, field: 'free_wake_time', elapsed_ms_bucket: 'lt_2s' });
    expect(isSafeValue('user@example.test')).toBe(false);
    expect(isSafeValue('23:30')).toBe(false);
    expect(isSafeValue('at 7:05 pm')).toBe(false);
    expect(isSafeValue('lt_30m')).toBe(true);
    expect(sanitizeProps('not_an_event', { a: 1 })).toEqual({});
    expect(sanitizeProps('input_changed', { field: 'work_bedtime', bucket_optional: '23:30' })).toEqual({ field: 'work_bedtime' });
  });

  it('only whitelisted properties exist for every catalog event', () => {
    for (const e of analyticsCatalog.events) expect(allowedProps(e.event).sort()).toEqual([...e.props].sort());
    expect(analyticsCatalog.events.some((e) => e.props.some((p) => /email|time|hhmm/i.test(p) && p !== 'elapsed_ms_bucket' && p !== 'compute_ms_bucket'))).toBe(false);
  });

  it('buckets never expose exact values', () => {
    expect([0, 10, 45, 100].map(bucketMinutes)).toEqual(['0', '1-30', '31-60', '61-120']);
    expect(referrerGroup('https://www.google.com/search?q=x', 'chronosleep.app')).toBe('search');
    expect(referrerGroup('', 'chronosleep.app')).toBe('direct');
    expect(referrerGroup('https://news.example.org/a', 'chronosleep.app')).toBe('other');
  });
});

describe('structured logs never carry PII (NFR-05, AT-30)', () => {
  it('keeps allow-listed keys only and drops emails/clock times even in allowed keys', () => {
    const out = log.sanitize({
      route: 'calculate',
      status: 200,
      email: 'a@b.co',
      work_bedtime: '23:30',
      payload: { x: 1 },
      error_code: 'user@example.test',
      source: 'at 23:30',
      request_id: 'abc12345',
    });
    expect(out).toEqual({ route: 'calculate', status: 200, request_id: 'abc12345' });
  });

  it('api logs for a calculation contain no schedules or emails', async () => {
    setupEnv();
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((l: string) => void lines.push(String(l)));
    await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }), undefined);
    spy.mockRestore();
    const all = lines.join('\n');
    expect(all).toContain('"route":"calculate"');
    expect(all).not.toMatch(/23:30|06:45|01:00|09:00/);
  });
});

describe('rate limiting (FR-31, AT-31)', () => {
  beforeEach(() => {
    setupEnv();
    resetRateLimitsForTests();
  });

  it('allows up to the limit then returns 429 with Retry-After on the API', async () => {
    const policy = POLICIES.reportRequest;
    for (let i = 0; i < policy.limit; i++) expect((await checkRateLimit(policy, '1.2.3.4')).ok).toBe(true);
    const blocked = await checkRateLimit(policy, '1.2.3.4');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await checkRateLimit(policy, '5.6.7.8')).ok).toBe(true); // other client unaffected

    let last = 200;
    for (let i = 0; i < POLICIES.calculate.limit + 2; i++) {
      const res = await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }, { 'x-forwarded-for': '9.9.9.9' }), undefined);
      last = res.status;
      if (res.status === 429) {
        expect(res.headers.get('retry-after')).toBeTruthy();
        break;
      }
    }
    expect(last).toBe(429);
  });
});

describe('Turnstile (FR-31)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('passes outside production without a secret, rejects in production', async () => {
    setupEnv();
    expect((await verifyTurnstile(undefined)).ok).toBe(true);
    setupEnv({ VERCEL_ENV: 'production' });
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, code: 'botcheck_not_configured' });
    setupEnv({ VERCEL_ENV: 'production', ALLOW_NO_TURNSTILE: '1' });
    expect((await verifyTurnstile('tok')).ok).toBe(true);
    delete process.env.VERCEL_ENV;
    delete process.env.ALLOW_NO_TURNSTILE;
  });

  it('verifies against Cloudflare when configured', async () => {
    setupEnv({ TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' });
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
      const body = String(init?.body);
      return new Response(JSON.stringify({ success: body.includes('response=good') }));
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await verifyTurnstile('good', '1.1.1.1')).ok).toBe(true);
    expect(await verifyTurnstile('bad')).toEqual({ ok: false, code: 'botcheck_failed' });
    expect(await verifyTurnstile(undefined)).toEqual({ ok: false, code: 'botcheck_failed' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await verifyTurnstile('x')).toEqual({ ok: false, code: 'botcheck_unavailable' });
  });
});

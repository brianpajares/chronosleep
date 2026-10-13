import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';
import { hmacShort } from './crypto';
import { log } from './logger';

export interface RateLimitPolicy {
  /** Logical bucket, e.g. `calculate`. */
  name: string;
  limit: number;
  windowSec: number;
}

export const POLICIES = {
  calculate: { name: 'calculate', limit: 40, windowSec: 60 },
  reportRequest: { name: 'report-request', limit: 5, windowSec: 600 },
  privacy: { name: 'privacy', limit: 5, windowSec: 3600 },
  admin: { name: 'admin', limit: 60, windowSec: 60 },
  report: { name: 'report-read', limit: 60, windowSec: 60 },
  checkout: { name: 'checkout', limit: 10, windowSec: 600 },
} satisfies Record<string, RateLimitPolicy>;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = env.upstashUrl();
  const token = env.upstashToken();
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// In-memory sliding window (per instance) used when Upstash is not configured.
const memory = new Map<string, number[]>();

function memoryLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const windowMs = policy.windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= policy.limit) {
    const oldest = hits[0] ?? now;
    memory.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  memory.set(key, hits);
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.every((t) => now - t >= windowMs)) memory.delete(k);
  }
  return { ok: true, remaining: policy.limit - hits.length, retryAfterSec: 0 };
}

/** Keys are HMAC-pseudonymised: raw IPs never reach Redis. Fails open (and logs) if Redis is down. */
export async function checkRateLimit(policy: RateLimitPolicy, identity: string): Promise<RateLimitResult> {
  const key = `${policy.name}:${hmacShort(identity || 'unknown', 'ratelimit')}`;
  const r = getRedis();
  if (!r) return memoryLimit(key, policy);
  try {
    let limiter = limiters.get(policy.name);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSec} s`),
        prefix: 'chronosleep',
        analytics: false,
      });
      limiters.set(policy.name, limiter);
    }
    const res = await limiter.limit(key);
    return {
      ok: res.success,
      remaining: res.remaining,
      retryAfterSec: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch {
    log.warn('ratelimit_backend_error', { error_category: 'redis' });
    return memoryLimit(key, policy);
  }
}

export function resetRateLimitsForTests(): void {
  memory.clear();
}

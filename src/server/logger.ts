import 'server-only';

/**
 * Structured logs with a strict allow-list: never emails, schedules, tokens or payloads.
 * Anything that looks like an email or a clock time is dropped even if the key is allowed.
 */
const ALLOWED_KEYS = new Set([
  'request_id',
  'route',
  'method',
  'status',
  'duration_ms',
  'error_code',
  'error_category',
  'mode',
  'driver',
  'count',
  'provider',
  'attempt',
  'channel',
  'lead_id',
  'calculation_id',
  'delivery_id',
  'locale',
  'model_version',
  'source',
  'degraded',
  'event_type',
]);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const CLOCK_RE = /(?:^|[^\d])(?:[01]?\d|2[0-3]):[0-5]\d(?:[^\d]|$)/;

type Ctx = Record<string, unknown>;

function safe(ctx: Ctx): Ctx {
  const out: Ctx = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v === 'string' && (EMAIL_RE.test(v) || CLOCK_RE.test(v))) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
  }
  return out;
}

function emit(level: 'info' | 'warn' | 'error', event: string, ctx: Ctx = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe(ctx) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, ctx?: Ctx) => emit('info', event, ctx),
  warn: (event: string, ctx?: Ctx) => emit('warn', event, ctx),
  error: (event: string, ctx?: Ctx) => emit('error', event, ctx),
  /** Exposed for tests. */
  sanitize: safe,
};

import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { log } from './logger';
import { reportError } from './observability';
import { checkRateLimit, type RateLimitPolicy } from './ratelimit';

/** Error that maps 1:1 to the OpenAPI `Error` schema ({ error, code, request_id }). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly extra: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Accepts a well-formed incoming request id or creates one (all mutating endpoints). */
export function requestIdFrom(req: Request): string {
  const incoming = req.headers.get(REQUEST_ID_HEADER);
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '').trim() || 'unknown';
}

export interface ApiCtx<P> {
  params: P;
  requestId: string;
  ip: string;
}

interface Options {
  /** Logical route name for logs. */
  name: string;
  rateLimit?: RateLimitPolicy;
}

export function json(body: unknown, requestId: string, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

/**
 * Route handler wrapper: request id, optional rate limit (per pseudonymised IP), uniform JSON
 * errors, structured PII-free logging and Sentry capture for unexpected failures.
 */
export function withApi<P = Record<string, never>>(
  opts: Options,
  handler: (req: NextRequest, ctx: ApiCtx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<P> }): Promise<Response> => {
    const started = Date.now();
    const requestId = requestIdFrom(req);
    const ip = clientIp(req);
    try {
      if (opts.rateLimit) {
        const rl = await checkRateLimit(opts.rateLimit, ip);
        if (!rl.ok) {
          throw new ApiError(429, 'rate_limited', 'Too many requests', {}, { 'Retry-After': String(rl.retryAfterSec) });
        }
      }
      const params = (routeCtx?.params ? await routeCtx.params : {}) as P;
      const res = await handler(req, { params, requestId, ip });
      res.headers.set(REQUEST_ID_HEADER, requestId);
      log.info('api', { route: opts.name, method: req.method, status: res.status, duration_ms: Date.now() - started, request_id: requestId });
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        log.info('api', { route: opts.name, method: req.method, status: err.status, error_code: err.code, duration_ms: Date.now() - started, request_id: requestId });
        const res = json({ error: err.message, code: err.code, request_id: requestId, ...err.extra }, requestId, {
          status: err.status,
        });
        for (const [k, v] of Object.entries(err.headers)) res.headers.set(k, v);
        return res;
      }
      if (err instanceof ZodError) {
        log.info('api', { route: opts.name, method: req.method, status: 400, error_code: 'invalid_request', request_id: requestId });
        return json(
          {
            error: 'Invalid request',
            code: 'invalid_request',
            request_id: requestId,
            // Field paths only — never the submitted values.
            fields: err.issues.map((i) => i.path.join('.')),
          },
          requestId,
          { status: 400 },
        );
      }
      log.error('api_unhandled', { route: opts.name, method: req.method, status: 500, request_id: requestId });
      reportError(err, { route: opts.name, request_id: requestId });
      return json({ error: 'Internal error', code: 'internal_error', request_id: requestId }, requestId, { status: 500 });
    }
  };
}

/** Parses a JSON body; malformed JSON becomes a 400 instead of a 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON');
  }
}

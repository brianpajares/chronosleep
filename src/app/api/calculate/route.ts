import type { NextResponse } from 'next/server';
import { json, readJson, withApi } from '@/server/api';
import { POLICIES } from '@/server/ratelimit';
import { CalculateRequestSchema } from '@/server/schemas';
import { createCalculation } from '@/server/services/calculations';

export const runtime = 'nodejs';

/** FR-03/FR-04/FR-05: validate → engine → encrypted persistence (no email involved). */
export const POST = withApi({ name: 'calculate', rateLimit: POLICIES.calculate }, async (req, { requestId }) => {
  const body = CalculateRequestSchema.parse(await readJson(req));
  const out = await createCalculation({ inputs: body.inputs, locale: body.locale, requestId });
  return json(out, requestId) as NextResponse;
});

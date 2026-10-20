import { z } from 'zod';
import { LocaleSchema } from '@/domain/chronosleep';

/** Request bodies — mirror spec/openapi.yaml components.schemas. */

export const CalculateRequestSchema = z.object({
  inputs: z.unknown(),
  locale: LocaleSchema,
});

const email = z.string().trim().max(320).pipe(z.email());

export const ReportRequestSchema = z.object({
  calculation_id: z.uuid(),
  email,
  consent_report: z.literal(true),
  consent_owner_copy: z.boolean().default(false),
  waitlist_subscription: z.boolean().default(false),
  locale: LocaleSchema,
  turnstile_token: z.string().max(4096).default(''),
  /** Honeypot: real users never see or fill this field. */
  website: z.string().max(200).optional(),
});

export const PrivacyRequestSchema = z.object({
  email,
  request_type: z.enum(['access', 'correction', 'deletion', 'portability', 'objection']),
  locale: LocaleSchema,
  turnstile_token: z.string().max(4096).default(''),
  website: z.string().max(200).optional(),
});

export const CheckoutSessionSchema = z.object({
  report_request_id: z.uuid(),
  locale: LocaleSchema.optional(),
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** GA4 client id ("123.456"), only sent by the browser after analytics consent. */
  ga_client_id: z
    .string()
    .regex(/^\d{4,12}\.\d{4,12}$/)
    .optional(),
});

export const UuidParam = z.uuid();

import 'server-only';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../api';
import { hashEmail, sealJson } from '../crypto';
import { env, type MonetizationMode } from '../env';
import { log } from '../logger';
import { reportError } from '../observability';
import { getStore, type LeadRow, type Locale } from '../store';
import { ensureArtifact } from './artifacts';
import { loadCalculation } from './calculations';
import { sendOwnerNotification, sendUserConfirmation } from './delivery';

const DAY_MS = 86_400_000;

export interface ReportRequestInput {
  calculation_id: string;
  email: string;
  consent_report: boolean;
  consent_owner_copy: boolean;
  waitlist_subscription: boolean;
  locale: Locale;
  requestId: string;
}

export interface ReportRequestResult {
  id: string;
  status: 'requested' | 'awaiting_owner' | 'awaiting_payment' | 'ready';
  mode: MonetizationMode;
}

/**
 * FR-07..FR-11 / AT-07..AT-11. Persists the lead (email AES-GCM encrypted + HMAC hash for dedupe),
 * then — in validation mode — renders the PDF and sends the user confirmation and the owner
 * notification. In stripe mode the lead waits for payment (no PDF/email until the webhook).
 */
export async function createReportRequest(input: ReportRequestInput): Promise<ReportRequestResult> {
  if (!input.consent_report) throw new ApiError(400, 'consent_required', 'Report delivery consent is required');
  const store = getStore();
  const mode = env.monetizationMode();

  const calc = await loadCalculation(input.calculation_id);
  if (!calc) throw new ApiError(410, 'calculation_expired', 'Calculation not found or expired');

  const email = input.email.trim().toLowerCase();
  const emailHash = hashEmail(email);

  // Re-submitting the same email for the same calculation is idempotent.
  const existing = (await store.leadsByEmailHash(emailHash)).find(
    (l) => l.calculation_id === input.calculation_id && l.status !== 'deleted' && !l.deleted_at,
  );
  if (existing) {
    return { id: existing.id, status: statusFor(existing.status), mode };
  }

  const id = randomUUID();
  const now = Date.now();
  const sealed = sealJson(email, id);
  const leadExpires = new Date(now + env.retention().leadDays * DAY_MS).toISOString();
  const lead: LeadRow = {
    id,
    calculation_id: input.calculation_id,
    created_at: new Date(now).toISOString(),
    expires_at: leadExpires,
    status: mode === 'stripe' ? 'awaiting_payment' : 'requested',
    locale: input.locale,
    email_ciphertext: sealed.ciphertext,
    email_hash: emailHash,
    email_iv: sealed.iv,
    email_tag: sealed.tag,
    consent_report: true,
    consent_report_at: new Date(now).toISOString(),
    consent_owner_copy: input.consent_owner_copy,
    consent_owner_copy_at: input.consent_owner_copy ? new Date(now).toISOString() : null,
    waitlist_subscription: input.waitlist_subscription,
    owner_approved_at: null,
    delivered_at: null,
    deleted_at: null,
  };
  await store.insertLead(lead);
  // The calculation now belongs to the lead: keep it as long as the lead (90 d, not 30 d).
  await store.updateCalculation(input.calculation_id, { expires_at: leadExpires });
  await store.appendAudit({
    actor_type: 'system',
    action: 'lead_created',
    entity_type: 'lead',
    entity_id: id,
    metadata: { request_id: input.requestId, mode, consent_owner_copy: input.consent_owner_copy },
  });

  if (mode === 'stripe') return { id, status: 'awaiting_payment', mode };

  // Validation mode: PDF + confirmation + owner notification.
  try {
    await ensureArtifact(lead);
  } catch (err) {
    log.error('pdf_generation_failed', { lead_id: id, error_category: 'pdf', request_id: input.requestId });
    reportError(err, { source: 'pdf' });
    await store.updateLead(id, { status: 'failed' });
    return { id, status: 'requested', mode };
  }
  await sendUserConfirmation(lead);
  await sendOwnerNotification(lead);
  await store.updateLead(id, { status: 'awaiting_owner' });
  return { id, status: 'awaiting_owner', mode };
}

function statusFor(s: LeadRow['status']): ReportRequestResult['status'] {
  if (s === 'awaiting_payment') return 'awaiting_payment';
  if (s === 'awaiting_owner') return 'awaiting_owner';
  if (s === 'ready' || s === 'delivered') return 'ready';
  return 'requested';
}

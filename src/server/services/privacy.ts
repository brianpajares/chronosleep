import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { verificationIdFromUuid } from '@/domain/chronosleep';
import { ApiError } from '../api';
import { hashEmail, openJson, sealJson } from '../crypto';
import { appOrigin, env } from '../env';
import { sendEmail } from '../email/send';
import { ownerPrivacyEmail, privacyAckEmail } from '../email/templates';
import { getStore, type LeadRow, type Locale, type PrivacyRequestRow, type PrivacyRequestType } from '../store';
import { loadCalculation } from './calculations';
import { decryptLeadEmail, privacyUrl } from './delivery';

/**
 * FR-16 / AT-16. Public intake never reveals whether data exists for an email: identical 202 for
 * everybody; identity is verified by a human through a separate channel before anything runs.
 */
export async function createPrivacyRequest(input: {
  email: string;
  request_type: PrivacyRequestType;
  locale: Locale;
}): Promise<{ reference: string }> {
  const store = getStore();
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  const sealed = sealJson(email, id);
  const row: PrivacyRequestRow = {
    id,
    created_at: new Date().toISOString(),
    request_type: input.request_type,
    status: 'received',
    email_hash: hashEmail(email),
    email_ciphertext: sealed.ciphertext,
    email_iv: sealed.iv,
    email_tag: sealed.tag,
    locale: input.locale,
    verified_at: null,
    completed_at: null,
    notes_category: null,
  };
  await store.insertPrivacyRequest(row);
  await store.appendAudit({
    actor_type: 'system',
    action: 'privacy_request_received',
    entity_type: 'privacy_request',
    entity_id: id,
    metadata: { type: input.request_type },
  });

  const reference = verificationIdFromUuid(id);
  const ack = privacyAckEmail({ locale: input.locale, reference, privacyUrl: privacyUrl(input.locale) });
  await sendEmail({ to: email, ...ack });
  const owner = env.ownerEmail();
  if (owner) {
    await sendEmail({
      to: owner,
      ...ownerPrivacyEmail({ requestId: id, type: input.request_type, locale: input.locale, adminUrl: `${appOrigin()}/admin` }),
    });
  }
  return { reference };
}

export interface EraseResult {
  deleted: number;
  scrubbed: number;
}

/** Hard-deletes a lead (and its calculation/PDF/deliveries) — or scrubs it in place when an order must be retained. */
export async function eraseLead(lead: LeadRow): Promise<'deleted' | 'scrubbed'> {
  const store = getStore();
  const art = await store.getArtifact(lead.id);
  if (art) await store.deleteBlob(art.storage_path);

  const orders = await store.ordersByLead(lead.id);
  if (orders.length === 0) {
    await store.deleteLeadCascade(lead.id);
    return 'deleted';
  }
  const now = new Date().toISOString();
  await store.updateLead(lead.id, {
    email_ciphertext: '',
    email_iv: '',
    email_tag: '',
    email_hash: randomBytes(32).toString('hex'),
    status: 'deleted',
    deleted_at: now,
  });
  await store.updateCalculation(lead.calculation_id, {
    inputs_ciphertext: '',
    result_ciphertext: '',
    payload_iv: '',
    payload_tag: '',
    deleted_at: now,
  });
  if (art) await store.updateArtifact(lead.id, { deleted_at: now, access_token_expires_at: new Date(Date.now() - 1000).toISOString() });
  return 'scrubbed';
}

export async function eraseByEmailHash(hash: string): Promise<EraseResult> {
  const leads = await getStore().leadsByEmailHash(hash);
  const out: EraseResult = { deleted: 0, scrubbed: 0 };
  for (const lead of leads) {
    if (lead.status === 'deleted') continue;
    const r = await eraseLead(lead);
    out[r]++;
  }
  return out;
}

export async function markVerified(id: string, actor: string): Promise<void> {
  const store = getStore();
  const req = await store.getPrivacyRequest(id);
  if (!req) throw new ApiError(404, 'not_found', 'Privacy request not found');
  await store.updatePrivacyRequest(id, { status: 'verifying', verified_at: new Date().toISOString() });
  await store.appendAudit({ actor_user_id: actor, actor_type: 'admin', action: 'privacy_verified', entity_type: 'privacy_request', entity_id: id });
}

/** Access / portability: decrypted copy of the data held for the requester's email (admin-triggered, audited). */
export async function exportPrivacyData(id: string, actor: string) {
  const store = getStore();
  const req = await store.getPrivacyRequest(id);
  if (!req) throw new ApiError(404, 'not_found', 'Privacy request not found');
  if (!req.verified_at) throw new ApiError(409, 'not_verified', 'Verify the requester identity first');
  const leads = await store.leadsByEmailHash(req.email_hash);
  const items = [];
  for (const lead of leads) {
    if (lead.status === 'deleted') continue;
    const calc = await loadCalculation(lead.calculation_id);
    items.push({
      request_id: lead.id,
      created_at: lead.created_at,
      status: lead.status,
      locale: lead.locale,
      email: decryptLeadEmail(lead),
      consents: {
        report: lead.consent_report,
        owner_copy: lead.consent_owner_copy,
        waitlist_subscription: lead.waitlist_subscription,
      },
      inputs: calc?.inputs ?? null,
      result: calc?.result ?? null,
    });
  }
  await store.appendAudit({
    actor_user_id: actor,
    actor_type: 'admin',
    action: 'privacy_export',
    entity_type: 'privacy_request',
    entity_id: id,
    metadata: { items: items.length },
  });
  return { generated_at: new Date().toISOString(), requester_email: openJson<string>({ ciphertext: req.email_ciphertext, iv: req.email_iv, tag: req.email_tag }, id), items };
}

/**
 * Completes a request. For `deletion` it erases payloads + email; the request itself is then
 * scrubbed and the audit trail keeps only counts (minimal, non-reversible).
 */
export async function completePrivacyRequest(id: string, actor: string): Promise<EraseResult | null> {
  const store = getStore();
  const req = await store.getPrivacyRequest(id);
  if (!req) throw new ApiError(404, 'not_found', 'Privacy request not found');
  if (!req.verified_at) throw new ApiError(409, 'not_verified', 'Verify the requester identity first');
  if (req.status === 'completed') return null;

  let result: EraseResult | null = null;
  if (req.request_type === 'deletion') result = await eraseByEmailHash(req.email_hash);

  await store.updatePrivacyRequest(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    // Non-reversible: drop the email, keep nothing that can re-identify the requester.
    email_ciphertext: '',
    email_iv: '',
    email_tag: '',
    email_hash: randomBytes(32).toString('hex'),
  });
  await store.appendAudit({
    actor_user_id: actor,
    actor_type: 'privacy_job',
    action: `privacy_${req.request_type}_completed`,
    entity_type: 'privacy_request',
    entity_id: id,
    metadata: { deleted: result?.deleted ?? 0, scrubbed: result?.scrubbed ?? 0 },
  });
  return result;
}

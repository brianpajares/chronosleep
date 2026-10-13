import 'server-only';
import { ApiError } from '../api';
import { maskEmail } from '../crypto';
import { getStore, type LeadRow } from '../store';
import { decryptLeadEmail, sendReportReady } from './delivery';
import { loadCalculation } from './calculations';

export interface AdminLeadView {
  id: string;
  created_at: string;
  status: string;
  locale: string;
  consent_owner_copy: boolean;
  email_masked: string;
  sjl_band: string;
  owner_approved_at: string | null;
}

/** Admin list item: masked email and a coarse band — never raw schedules (UX §4.12). */
export async function toAdminLead(lead: LeadRow): Promise<AdminLeadView> {
  let email = '***';
  try {
    email = maskEmail(decryptLeadEmail(lead));
  } catch {
    /* scrubbed/legacy row */
  }
  const calc = await getStore().getCalculation(lead.calculation_id);
  return {
    id: lead.id,
    created_at: lead.created_at,
    status: lead.status,
    locale: lead.locale,
    consent_owner_copy: lead.consent_owner_copy,
    email_masked: email,
    sjl_band: calc?.sjl_band ?? 'n/a',
    owner_approved_at: lead.owner_approved_at,
  };
}

async function requireLead(id: string): Promise<LeadRow> {
  const lead = await getStore().getLead(id);
  if (!lead || lead.deleted_at || lead.status === 'deleted') throw new ApiError(404, 'not_found', 'Lead not found');
  return lead;
}

async function sendAndRecord(lead: LeadRow, actor: string, action: 'lead_approved' | 'lead_resent') {
  const store = getStore();
  if (!(await loadCalculation(lead.calculation_id))) {
    throw new ApiError(410, 'calculation_expired', 'The calculation behind this request no longer exists');
  }
  const delivery = await sendReportReady(lead);
  const ok = delivery.status === 'sent';
  await store.updateLead(lead.id, ok ? { status: 'delivered', delivered_at: new Date().toISOString() } : { status: 'failed' });
  await store.appendAudit({
    actor_user_id: actor,
    actor_type: 'admin',
    action,
    entity_type: 'lead',
    entity_id: lead.id,
    metadata: { delivered: ok, error_category: delivery.last_error_category },
  });
  if (!ok) throw new ApiError(502, 'delivery_failed', 'Email delivery failed', { category: delivery.last_error_category });
}

/** FR-17: owner approval triggers the report delivery email (link + PDF). */
export async function approveLead(id: string, actorUserId: string): Promise<void> {
  const lead = await requireLead(id);
  if (lead.status === 'awaiting_payment') {
    throw new ApiError(409, 'awaiting_payment', 'This lead is waiting for a payment');
  }
  if (!lead.owner_approved_at) {
    await getStore().updateLead(id, { owner_approved_at: new Date().toISOString() });
    lead.owner_approved_at = new Date().toISOString();
  }
  await sendAndRecord(lead, actorUserId, 'lead_approved');
}

export async function resendLead(id: string, actorUserId: string): Promise<void> {
  const lead = await requireLead(id);
  if (!lead.owner_approved_at && lead.status !== 'ready' && lead.status !== 'delivered') {
    throw new ApiError(409, 'not_approved', 'Approve the lead before resending');
  }
  await sendAndRecord(lead, actorUserId, 'lead_resent');
}
